import { SetMetadata } from '@nestjs/common';

export type RoleType = 'ADMIN' | 'USER';
export const ROLES_KEY = 'roles';

export const Roles = (roles: RoleType[] | RoleType) => {
  if (!Array.isArray(roles)) {
    roles = [roles];
  }
  return SetMetadata(ROLES_KEY, roles);
};
