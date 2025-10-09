import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '@/src/middleware/auth.middleware';
import { RolesGuard } from '@/src/guards/roles.guard';
import { Roles } from '@/src/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@UseGuards(RolesGuard)
@Controller('user')
export class UsersController {
  @Get('me')
  @Roles(['ADMIN', 'USER'])
  getMe(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}
