import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../common/access.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { AddStudentDto, CreateGroupDto, UpdateGroupDto } from './dto/groups.dto';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  private async assertTeacher(teacherId: string): Promise<void> {
    const teacher = await this.prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'teacher') {
      throw new AppException('TEACHER_NOT_FOUND', "Bunday o'qituvchi topilmadi", 400);
    }
  }

  async create(actor: AuthUser, dto: CreateGroupDto) {
    if (dto.teacherId) await this.assertTeacher(dto.teacherId);
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        teacherId: dto.teacherId ?? null,
        schedule: dto.schedule ? (dto.schedule as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'group.create',
      entity: 'group',
      entityId: group.id,
      newValue: { name: group.name, teacherId: group.teacherId },
    });
    return this.getOne(actor, group.id);
  }

  /** Har kim faqat o'ziga tegishli guruhlarni ko'radi */
  async list(viewer: AuthUser) {
    let where: Prisma.GroupWhereInput = {};
    if (viewer.role === 'teacher') {
      where = { teacherId: viewer.id };
    } else if (viewer.role === 'student') {
      where = { students: { some: { userId: viewer.id } } };
    } else if (viewer.role === 'parent') {
      const kids = await this.access.childUserIds(viewer.id);
      where = { students: { some: { userId: { in: kids } } } };
    }
    const groups = await this.prisma.group.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      teacherId: g.teacherId,
      teacherName: g.teacher?.name ?? null,
      schedule: g.schedule,
      studentsCount: g._count.students,
      createdAt: g.createdAt,
    }));
  }

  async getOne(viewer: AuthUser, id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, name: true } },
        students: {
          include: { user: { select: { id: true, name: true, phone: true, isActive: true } } },
          orderBy: { user: { name: 'asc' } },
        },
      },
    });
    if (!group) throw new AppException('GROUP_NOT_FOUND', 'Guruh topilmadi', 404);

    if (viewer.role === 'teacher' && group.teacherId !== viewer.id) {
      throw new AppException('FORBIDDEN', 'Bu guruh sizga biriktirilmagan', 403);
    }
    if (viewer.role === 'student' && !group.students.some((s) => s.userId === viewer.id)) {
      throw new AppException('FORBIDDEN', "Siz bu guruh a'zosi emassiz", 403);
    }
    if (viewer.role === 'parent') {
      const kids = await this.access.childUserIds(viewer.id);
      if (!group.students.some((s) => kids.includes(s.userId))) {
        throw new AppException('FORBIDDEN', "Farzandingiz bu guruhda o'qimaydi", 403);
      }
    }

    return {
      id: group.id,
      name: group.name,
      teacherId: group.teacherId,
      teacherName: group.teacher?.name ?? null,
      schedule: group.schedule,
      createdAt: group.createdAt,
      students: group.students.map((s) => ({
        studentId: s.userId,
        name: s.user.name,
        phone: s.user.phone,
        isActive: s.user.isActive,
        isApproved: s.isApproved,
        currentPoints: s.currentPoints,
      })),
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdateGroupDto) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new AppException('GROUP_NOT_FOUND', 'Guruh topilmadi', 404);
    if (dto.teacherId) await this.assertTeacher(dto.teacherId);

    await this.prisma.group.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.teacherId !== undefined ? { teacherId: dto.teacherId } : {}),
        ...(dto.schedule !== undefined
          ? { schedule: dto.schedule as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'group.update',
      entity: 'group',
      entityId: id,
      oldValue: { name: group.name, teacherId: group.teacherId },
      newValue: { name: dto.name ?? group.name, teacherId: dto.teacherId ?? group.teacherId },
    });
    return this.getOne(actor, id);
  }

  async addStudent(actor: AuthUser, groupId: string, dto: AddStudentDto) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new AppException('GROUP_NOT_FOUND', 'Guruh topilmadi', 404);
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: dto.studentId },
    });
    if (!profile) throw new AppException('STUDENT_NOT_FOUND', "O'quvchi topilmadi", 404);

    await this.prisma.studentProfile.update({
      where: { userId: dto.studentId },
      data: { groupId },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'group.add_student',
      entity: 'studentProfile',
      entityId: dto.studentId,
      oldValue: { groupId: profile.groupId },
      newValue: { groupId },
    });
    return { groupId, studentId: dto.studentId, added: true };
  }

  async removeStudent(actor: AuthUser, groupId: string, studentId: string) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId: studentId } });
    if (!profile || profile.groupId !== groupId) {
      throw new AppException('STUDENT_NOT_IN_GROUP', "O'quvchi bu guruhda emas", 404);
    }
    await this.prisma.studentProfile.update({
      where: { userId: studentId },
      data: { groupId: null },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'group.remove_student',
      entity: 'studentProfile',
      entityId: studentId,
      oldValue: { groupId },
      newValue: { groupId: null },
    });
    return { removed: true };
  }
}
