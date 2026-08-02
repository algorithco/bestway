import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from './types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Autentifikatsiyasiz ochiq endpoint */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const OPTIONAL_AUTH_KEY = 'optionalAuth';
/** Token bo'lsa foydalanuvchi aniqlanadi, bo'lmasa ham kirish mumkin (mehmon rejimi) */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);

export const ROLES_KEY = 'roles';
/** Endpointga kirishga ruxsat berilgan rollar */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Joriy autentifikatsiyalangan foydalanuvchi */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return req.user;
  },
);
