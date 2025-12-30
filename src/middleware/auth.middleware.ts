import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { UsersService } from '@/src/modules/users/users.service';
import { Role } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  fullName: string | null;
  phoneNumber: string;
  role: Role;
  file: { id: string; name: string; path: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  // ✅ Public path'lar - auth'siz ishlashi kerak
  private readonly publicPaths = [
    '/click/callback/prepare',
    '/click/callback/complete',
    '/api/click/callback/prepare', // Agar prefix bilan bo'lsa
    '/api/click/callback/complete', // Agar prefix bilan bo'lsa
  ];

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async use(req: AuthenticatedRequest, _: Response, next: NextFunction) {
    // ✅ Public path tekshirish
    const requestPath = req.path || req.url.split('?')[0];

    if (this.isPublicPath(requestPath)) {
      return next(); // Auth'ni skip qilish
    }

    // Auth logic
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

  /**
   * Check if path is public
   */
  private isPublicPath(path: string): boolean {
    return this.publicPaths.some((publicPath) => {
      // Exact match
      if (path === publicPath) return true;

      // Wildcard match (e.g., /click/callback/*)
      if (publicPath.endsWith('*')) {
        const base = publicPath.slice(0, -1);
        return path.startsWith(base);
      }

      return false;
    });
  }
}
