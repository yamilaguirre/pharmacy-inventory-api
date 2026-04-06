import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Attach required roles to a route handler.
 * Usage: @Roles(Role.ADMIN, Role.PHARMACIST)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
