import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { UsersService } from '@/src/modules/users/users.service';
import { User } from '@prisma/client';

export type AuthenticatedUser = Omit<User, 'password' | 'refreshToken'>;

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedException('Token is missing');
      }

      const token = authHeader.split(' ')[1];
      const decoded = this.jwtService.verify<{
        sub: string;
        password: string;
        refreshToken: string;
      }>(token);

      const user = await this.usersService.findById(decoded.sub);
      if (!user) throw new UnauthorizedException('User not found');

      req.user = user;
      next();
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
