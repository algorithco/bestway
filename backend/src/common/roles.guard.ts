import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AppException } from './app.exception';
import { ROLES_KEY } from './decorators';
import { AuthUser } from './types';

/** @Roles(...) dekoratori asosida rol tekshiruvi. Backend frontendga ishonmaydi. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) throw new AppException('UNAUTHORIZED', 'Avval tizimga kiring', 401);
    if (!roles.includes(req.user.role)) {
      throw new AppException('FORBIDDEN', 'Bu amal uchun rolingiz yetarli emas', 403);
    }
    return true;
  }
}
