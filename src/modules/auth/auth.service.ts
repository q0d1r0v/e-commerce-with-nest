import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/src/prisma.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { addMinutes, isBefore, differenceInSeconds } from 'date-fns';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    let user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: { phoneNumber: dto.phoneNumber },
      });
    }

    const lastOtp = await this.prisma.otp.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp) {
      const secondsSinceLastOtp = differenceInSeconds(
        new Date(),
        lastOtp.createdAt,
      );
      if (secondsSinceLastOtp < 60) {
        throw new BadRequestException(
          `Please wait ${60 - secondsSinceLastOtp} seconds before requesting a new OTP.`,
        );
      }
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = addMinutes(new Date(), 5);

    await this.prisma.otp.create({
      data: { userId: user.id, code, expiresAt },
    });

    return { message: 'OTP sent' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
      include: { Otp: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const otp = user.Otp.find((o) => o.code === dto.code && !o.used);
    if (!otp) throw new BadRequestException('Invalid OTP');
    if (isBefore(otp.expiresAt, new Date()))
      throw new BadRequestException('OTP expired');

    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    return { message: 'OTP verified' };
  }

  async completeProfile(dto: CompleteProfileDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.update({
      where: { phoneNumber: dto.phoneNumber },
      data: {
        fullName: dto.fullName,
        password: hashedPassword,
      },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        role: true,
      },
    });

    return { message: 'Profile completed', user };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(dto.password, user.password ?? '');
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.NODE_ENV === 'production' ? '15m' : '7d',
    });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };
  }

  async refreshToken({ oldRefreshToken }: RefreshTokenDto) {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken: oldRefreshToken },
    });

    if (!user) throw new UnauthorizedException('Invalid refresh token');

    try {
      this.jwtService.verify(oldRefreshToken);

      const accessToken = this.jwtService.sign(
        { sub: user.id, role: user.role },
        { expiresIn: '15m' },
      );

      const refreshToken = this.jwtService.sign(
        { sub: user.id, role: user.role },
        { expiresIn: '7d' },
      );

      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      return { accessToken, refreshToken };
    } catch {
      throw new UnauthorizedException('Refresh token expired');
    }
  }

  async forgotPassword(dto: RequestOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });
    if (!user) throw new NotFoundException('User not found');

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = addMinutes(new Date(), 5);

    await this.prisma.otp.create({
      data: { userId: user.id, code, expiresAt },
    });

    return { message: 'OTP sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
      include: { Otp: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const otp = user.Otp.find(
      (o) => !o.used && isBefore(new Date(), o.expiresAt),
    );
    if (!otp) throw new BadRequestException('OTP invalid or expired');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({
      where: { phoneNumber: dto.phoneNumber },
      data: { password: hashedPassword },
    });

    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    return { message: 'Password reset successfully' };
  }
}
