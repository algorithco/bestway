import { Injectable } from '@nestjs/common';
import { Prisma, StudentProfile, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../common/access.service';
import { AppException } from '../common/app.exception';
import { Paginated } from '../common/pagination';
import { AuthUser } from '../common/types';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import { CreateUserDto, QueryUsersDto, UpdateUserDto } from './dto/users.dto';

type UserWithProfile = User & {
  studentProfile?: (StudentProfile & { group?: { id: string; name: string } | null }) | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly settings: SettingsService,
  ) {}

  private shape(u: UserWithProfile, includeLinkCode: boolean) {
    return {
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      student: u.studentProfile
        ? {
            isApproved: u.studentProfile.isApproved,
            groupId: u.studentProfile.groupId,
            groupName: u.studentProfile.group?.name ?? null,
            currentPoints: u.studentProfile.currentPoints,
            ...(includeLinkCode ? { linkCode: u.studentProfile.linkCode } : {}),
          }
        : null,
    };
  }

  async list(q: QueryUsersDto) {
    const where: Prisma.UserWhereInput = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.groupId ? { studentProfile: { groupId: q.groupId } } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { studentProfile: { include: { group: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
    ]);
    return new Paginated(
      items.map((u) => this.shape(u, true)),
      { page: q.page, limit: q.limit, total },
    );
  }

  /** Admin xodim/o'quvchi/ota-ona qo'shadi. Admin rolini faqat super_admin bera oladi. */
  async create(actor: AuthUser, dto: CreateUserDto) {
    if (dto.role === 'super_admin') {
      throw new AppException('FORBIDDEN', "Super admin yaratib bo'lmaydi", 403);
    }
    if (dto.role === 'admin' && actor.role !== 'super_admin') {
      throw new AppException('FORBIDDEN', "Admin qo'shish huquqi faqat super adminda", 403);
    }
    const exists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (exists) {
      throw new AppException('PHONE_TAKEN', "Bu telefon raqam allaqachon ro'yxatdan o'tgan", 409);
    }
    if (dto.groupId) {
      const group = await this.prisma.group.findUnique({ where: { id: dto.groupId } });
      if (!group) throw new AppException('GROUP_NOT_FOUND', 'Guruh topilmadi', 404);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const initialPoints = await this.settings.getNumber(SETTING_KEYS.initialPoints);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: dto.name, phone: dto.phone, passwordHash, role: dto.role },
      });
      if (dto.role === 'student') {
        let linkCode = AuthService.generateLinkCode();
        while (await tx.studentProfile.findUnique({ where: { linkCode } })) {
          linkCode = AuthService.generateLinkCode();
        }
        await tx.studentProfile.create({
          data: {
            userId: created.id,
            groupId: dto.groupId ?? null,
            currentPoints: initialPoints,
            linkCode,
          },
        });
        await tx.pointsLog.create({
          data: { studentId: created.id, change: initialPoints, reason: "Boshlang'ich ball" },
        });
      }
      return created;
    });

    await this.audit.log({
      userId: actor.id,
      action: 'user.create',
      entity: 'user',
      entityId: user.id,
      newValue: { name: user.name, phone: user.phone, role: user.role },
    });

    return this.getOne(actor, user.id);
  }

  async getOne(viewer: AuthUser, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { studentProfile: { include: { group: { select: { id: true, name: true } } } } },
    });
    if (!user) throw new AppException('USER_NOT_FOUND', 'Foydalanuvchi topilmadi', 404);

    // Kirish nazorati: o'zi / admin / (o'quvchi bo'lsa) ota-onasi yoki guruh o'qituvchisi
    const isSelf = viewer.id === id;
    const isAdmin = viewer.role === 'admin' || viewer.role === 'super_admin';
    if (!isSelf && !isAdmin) {
      if (user.role === 'student') {
        await this.access.assertCanViewStudent(viewer, id);
      } else {
        throw new AppException('FORBIDDEN', "Bu ma'lumotni ko'rish huquqingiz yo'q", 403);
      }
    }

    const base = this.shape(user, isSelf || isAdmin);

    if (user.role === 'parent') {
      const links = await this.prisma.parentStudent.findMany({
        where: { parentUserId: id },
        include: {
          student: { include: { user: true, group: { select: { id: true, name: true } } } },
        },
      });
      return {
        ...base,
        children: links.map((l) => ({
          studentId: l.studentId,
          name: l.student.user.name,
          groupId: l.student.groupId,
          groupName: l.student.group?.name ?? null,
          isApproved: l.student.isApproved,
          currentPoints: l.student.currentPoints,
        })),
      };
    }

    if (user.role === 'teacher') {
      const groups = await this.prisma.group.findMany({
        where: { teacherId: id },
        include: { _count: { select: { students: true } } },
      });
      return {
        ...base,
        groups: groups.map((g) => ({ id: g.id, name: g.name, studentsCount: g._count.students })),
      };
    }

    return base;
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true },
    });
    if (!user) throw new AppException('USER_NOT_FOUND', 'Foydalanuvchi topilmadi', 404);

    if (user.role === 'super_admin' && actor.role !== 'super_admin') {
      throw new AppException('FORBIDDEN', 'Super adminni faqat super admin tahrirlaydi', 403);
    }
    if (dto.role !== undefined && actor.role !== 'super_admin') {
      throw new AppException('FORBIDDEN', "Rolni faqat super admin o'zgartira oladi", 403);
    }
    if (dto.role === 'super_admin') {
      throw new AppException('FORBIDDEN', "super_admin rolini berish mumkin emas", 403);
    }
    if (dto.phone && dto.phone !== user.phone) {
      const taken = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (taken) throw new AppException('PHONE_TAKEN', 'Bu telefon raqam band', 409);
    }

    const old = {
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isApproved: user.studentProfile?.isApproved,
      groupId: user.studentProfile?.groupId,
    };

    // O'quvchi profiliga tegishli maydonlar
    if (dto.isApproved !== undefined || dto.groupId !== undefined) {
      if (!user.studentProfile) {
        throw new AppException('NOT_A_STUDENT', "Bu foydalanuvchi o'quvchi emas", 400);
      }
      if (dto.groupId) {
        const group = await this.prisma.group.findUnique({ where: { id: dto.groupId } });
        if (!group) throw new AppException('GROUP_NOT_FOUND', 'Guruh topilmadi', 404);
      }
      await this.prisma.studentProfile.update({
        where: { userId: id },
        data: {
          ...(dto.isApproved !== undefined ? { isApproved: dto.isApproved } : {}),
          ...(dto.groupId !== undefined ? { groupId: dto.groupId } : {}),
        },
      });
    }

    const data: Prisma.UserUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.telegramChatId !== undefined ? { telegramChatId: dto.telegramChatId } : {}),
      ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
    };
    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id }, data });
    }

    await this.audit.log({
      userId: actor.id,
      action: 'user.update',
      entity: 'user',
      entityId: id,
      oldValue: old,
      newValue: {
        name: dto.name ?? old.name,
        phone: dto.phone ?? old.phone,
        role: dto.role ?? old.role,
        isActive: dto.isActive ?? old.isActive,
        isApproved: dto.isApproved ?? old.isApproved,
        groupId: dto.groupId === undefined ? old.groupId : dto.groupId,
        passwordChanged: Boolean(dto.password),
      },
    });

    return this.getOne(actor, id);
  }

  /** Yumshoq o'chirish: akkaunt bloklanadi, tarix saqlanib qoladi */
  async deactivate(actor: AuthUser, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppException('USER_NOT_FOUND', 'Foydalanuvchi topilmadi', 404);
    if (user.role === 'super_admin') {
      throw new AppException('FORBIDDEN', "Super adminni o'chirib bo'lmaydi", 403);
    }
    if (user.id === actor.id) {
      throw new AppException('FORBIDDEN', "O'z akkauntingizni o'chira olmaysiz", 403);
    }
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    await this.audit.log({
      userId: actor.id,
      action: 'user.deactivate',
      entity: 'user',
      entityId: id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
    });
    return { deactivated: true };
  }
}
