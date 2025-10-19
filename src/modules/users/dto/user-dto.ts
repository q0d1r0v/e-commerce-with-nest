import { Role } from '@prisma/client';

export type UserDto = {
  id: string;
  fullName: string | null;
  phoneNumber: string;
  role: Role;
  file: { id: string; name: string; path: string } | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
