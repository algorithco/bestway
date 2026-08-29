import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from './app.exception';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from './decorators';
import { AuthUser } from './types';

/**
 * Global JWT guard. Har bir so'rovda tokenni tekshiradi va foydalanuvchini
 * bazadan yuklaydi — shunda rol o'zgarishi yoki bloklash darhol kuchga kiradi.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      if (isPublic || isOptional) return true;
      throw new AppException('UNAUTHORIZED', 'Avval tizimga kiring', 401);
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, { algorithms: ['HS256'] });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { studentProfile: true },
      });
      if (!user || !user.isActive) throw new Error('inactive');
      req.user = {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        studentProfile: user.studentProfile
          ? {
              userId: user.studentProfile.userId,
              groupId: user.studentProfile.groupId,
              isApproved: user.studentProfile.isApproved,
              currentPoints: user.studentProfile.currentPoints,
            }
          : null,
      };
      return true;
    } catch {
      if (isPublic || isOptional) return true;
      throw new AppException('UNAUTHORIZED', 'Token yaroqsiz yoki muddati tugagan', 401);
    }
  }
}
