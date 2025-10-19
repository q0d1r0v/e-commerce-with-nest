import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/src/prisma.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterTokenPayload } from './entities/auth-token-payload.entity';
import * as bcrypt from 'bcrypt';
import { addMinutes, differenceInSeconds } from 'date-fns';
import { randomInt } from 'crypto';

@Injectable()
export class AuthService {
  private readonly OTP_LENGTH: number;
  private readonly OTP_EXPIRY_MINUTES: number;
  private readonly OTP_REQUEST_COOLDOWN_SECONDS: number;
  private readonly MAX_OTP_ATTEMPTS: number;
  private readonly BCRYPT_ROUNDS: number;
  private readonly ACCESS_TOKEN_EXPIRY: string;
  private readonly REFRESH_TOKEN_EXPIRY: string;
  private readonly TEMP_TOKEN_EXPIRY: string;
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.OTP_LENGTH = this.configService.get<number>('OTP_LENGTH', 6);
    this.OTP_EXPIRY_MINUTES = this.configService.get<number>(
      'OTP_EXPIRY_MINUTES',
      5,
    );
    this.OTP_REQUEST_COOLDOWN_SECONDS = this.configService.get<number>(
      'OTP_REQUEST_COOLDOWN_SECONDS',
      60,
    );
    this.MAX_OTP_ATTEMPTS = this.configService.get<number>(
      'MAX_OTP_ATTEMPTS',
      5,
    );
    this.BCRYPT_ROUNDS = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    this.ACCESS_TOKEN_EXPIRY = this.configService.get<string>(
      'JWT_ACCESS_TOKEN_EXPIRY',
      '15m',
    );
    this.REFRESH_TOKEN_EXPIRY = this.configService.get<string>(
      'JWT_REFRESH_TOKEN_EXPIRY',
      '7d',
    );
    this.TEMP_TOKEN_EXPIRY = this.configService.get<string>(
      'JWT_TEMP_TOKEN_EXPIRY',
      '10m',
    );
    this.JWT_SECRET = this.configService.get<string>('JWT_SECRET') ?? '';
    this.JWT_REFRESH_SECRET =
      this.configService.get<string>('JWT_REFRESH_SECRET') ?? '';

    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    if (!this.JWT_REFRESH_SECRET) {
      throw new Error(
        'JWT_REFRESH_SECRET is not defined in environment variables',
      );
    }
  }

  private generateSecureOtp(): string {
    const min = Math.pow(10, this.OTP_LENGTH - 1);
    const max = Math.pow(10, this.OTP_LENGTH) - 1;
    return randomInt(min, max).toString();
  }

  private validatePassword(password: string): void {
    const minLength = this.configService.get<number>('PASSWORD_MIN_LENGTH', 8);

    if (password.length < minLength) {
      throw new BadRequestException(
        `Password must be at least ${minLength} characters long`,
      );
    }

    const requireUppercase = this.configService.get<boolean>(
      'PASSWORD_REQUIRE_UPPERCASE',
      true,
    );
    const requireLowercase = this.configService.get<boolean>(
      'PASSWORD_REQUIRE_LOWERCASE',
      true,
    );
    const requireNumber = this.configService.get<boolean>(
      'PASSWORD_REQUIRE_NUMBER',
      true,
    );
    const requireSpecialChar = this.configService.get<boolean>(
      'PASSWORD_REQUIRE_SPECIAL_CHAR',
      true,
    );

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors: string[] = [];
    if (requireUppercase && !hasUpperCase) errors.push('uppercase letter');
    if (requireLowercase && !hasLowerCase) errors.push('lowercase letter');
    if (requireNumber && !hasNumbers) errors.push('number');
    if (requireSpecialChar && !hasSpecialChar) errors.push('special character');

    if (errors.length > 0) {
      throw new BadRequestException(
        `Password must contain ${errors.join(', ')}`,
      );
    }
  }

  private async checkOtpAttempts(userId: string): Promise<void> {
    const windowMinutes = this.configService.get<number>(
      'OTP_ATTEMPTS_WINDOW_MINUTES',
      15,
    );
    const recentAttempts = await this.prisma.otpAttempt.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - windowMinutes * 60 * 1000),
        },
      },
    });

    if (recentAttempts >= this.MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        `Too many OTP verification attempts. Please try again in ${windowMinutes} minutes.`,
      );
    }
  }

  private async logOtpAttempt(userId: string, success: boolean): Promise<void> {
    await this.prisma.otpAttempt.create({
      data: {
        userId,
        success,
        attemptedAt: new Date(),
      },
    });
  }

  async requestOtp(dto: RequestOtpDto) {
    let user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber, deletedAt: null },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: { phoneNumber: dto.phoneNumber },
      });
    }

    const lastOtp = await this.prisma.otp.findFirst({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp) {
      const secondsSinceLastOtp = differenceInSeconds(
        new Date(),
        lastOtp.createdAt,
      );
      if (secondsSinceLastOtp < this.OTP_REQUEST_COOLDOWN_SECONDS) {
        const waitTime =
          this.OTP_REQUEST_COOLDOWN_SECONDS - secondsSinceLastOtp;
        throw new BadRequestException(
          `Please wait ${waitTime} seconds before requesting a new OTP`,
        );
      }
    }

    await this.prisma.otp.updateMany({
      where: {
        userId: user.id,
        used: false,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    const code = this.generateSecureOtp();
    const expiresAt = addMinutes(new Date(), this.OTP_EXPIRY_MINUTES);

    await this.prisma.otp.create({
      data: {
        userId: user.id,
        code: parseInt(code, 10),
        expiresAt,
      },
    });

    return {
      message: 'OTP sent successfully',
      expiresIn: this.OTP_EXPIRY_MINUTES * 60,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.checkOtpAttempts(user.id);

    const otp = await this.prisma.otp.findFirst({
      where: {
        userId: user.id,
        code: dto.code,
        used: false,
        deletedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      await this.logOtpAttempt(user.id, false);
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.$transaction([
      this.prisma.otp.update({
        where: { id: otp.id },
        data: { used: true },
      }),
      this.prisma.otpAttempt.create({
        data: {
          userId: user.id,
          success: true,
          attemptedAt: new Date(),
        },
      }),
    ]);

    const tempToken = this.jwtService.sign(
      {
        phoneNumber: dto.phoneNumber,
        purpose: 'register',
        userId: user.id,
      } as RegisterTokenPayload,
      {
        expiresIn: this.TEMP_TOKEN_EXPIRY,
        secret: this.JWT_SECRET,
      },
    );

    return {
      message: 'OTP verified successfully',
      tempToken,
    };
  }

  async completeProfile(dto: CompleteProfileDto, token: string) {
    let payload: RegisterTokenPayload;

    try {
      payload = this.jwtService.verify<RegisterTokenPayload>(token, {
        secret: this.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.purpose !== 'register') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: payload.phoneNumber, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.password) {
      throw new BadRequestException('Profile already completed');
    }

    this.validatePassword(dto.password);

    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: dto.fullName,
        password: hashedPassword,
      },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
      },
    });

    return {
      message: 'Profile completed successfully',
      user: updatedUser,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber, deletedAt: null },
    });

    const passwordToCompare =
      user?.password ?? '$2b$12$invalidHashToPreventTimingAttack';
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new BadRequestException('Please complete your profile first');
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      secret: this.JWT_SECRET,
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      secret: this.JWT_REFRESH_SECRET,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    };
  }

  async refreshToken({ oldRefreshToken }: RefreshTokenDto) {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken: oldRefreshToken, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      this.jwtService.verify(oldRefreshToken, {
        secret: this.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token expired');
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      secret: this.JWT_SECRET,
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      secret: this.JWT_REFRESH_SECRET,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };
  }

  async forgotPassword(dto: RequestOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber, deletedAt: null },
    });

    if (!user) {
      return {
        message: 'If this phone number exists, an OTP has been sent',
      };
    }

    if (!user.password) {
      throw new BadRequestException('Please complete your registration first');
    }

    const lastOtp = await this.prisma.otp.findFirst({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp) {
      const secondsSinceLastOtp = differenceInSeconds(
        new Date(),
        lastOtp.createdAt,
      );
      if (secondsSinceLastOtp < this.OTP_REQUEST_COOLDOWN_SECONDS) {
        const waitTime =
          this.OTP_REQUEST_COOLDOWN_SECONDS - secondsSinceLastOtp;
        throw new BadRequestException(
          `Please wait ${waitTime} seconds before requesting a new OTP`,
        );
      }
    }

    await this.prisma.otp.updateMany({
      where: {
        userId: user.id,
        used: false,
        deletedAt: null,
      },
      data: { used: true, deletedAt: new Date() },
    });

    const code = this.generateSecureOtp();
    const expiresAt = addMinutes(new Date(), this.OTP_EXPIRY_MINUTES);

    await this.prisma.otp.create({
      data: {
        userId: user.id,
        code: parseInt(code, 10),
        expiresAt,
      },
    });

    return {
      message: 'OTP sent successfully',
      expiresIn: this.OTP_EXPIRY_MINUTES * 60,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.checkOtpAttempts(user.id);

    const otp = await this.prisma.otp.findFirst({
      where: {
        userId: user.id,
        code: dto.code,
        used: false,
        deletedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      await this.logOtpAttempt(user.id, false);
      throw new BadRequestException('Invalid or expired OTP');
    }

    this.validatePassword(dto.password);

    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          refreshToken: null,
        },
      }),
      this.prisma.otp.update({
        where: { id: otp.id },
        data: { used: true },
      }),
      this.prisma.otpAttempt.create({
        data: {
          userId: user.id,
          success: true,
          attemptedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Password reset successfully',
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return {
      message: 'Logged out successfully',
    };
  }
}
