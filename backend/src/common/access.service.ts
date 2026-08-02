import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from './app.exception';
import { AuthUser } from './types';

/**
 * Rol bo'yicha ma'lumotga kirish qoidalari (backend-prompt.md, 3-band):
 * har bir rol faqat o'ziga tegishli ma'lumotni ko'radi.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * viewer shu o'quvchining ma'lumotini ko'ra oladimi:
   * o'zi / bog'langan ota-onasi / o'z guruhining o'qituvchisi / admin / super admin
   */
  async assertCanViewStudent(viewer: AuthUser, studentUserId: string): Promise<void> {
    if (viewer.role === 'admin' || viewer.role === 'super_admin') return;
    if (viewer.role === 'student' && viewer.id === studentUserId) return;
    if (viewer.role === 'parent') {
      const link = await this.prisma.parentStudent.findUnique({
        where: {
          parentUserId_studentId: { parentUserId: viewer.id, studentId: studentUserId },
        },
      });
      if (link) return;
    }
    if (viewer.role === 'teacher') {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: studentUserId },
        include: { group: { select: { teacherId: true } } },
      });
      if (profile?.group?.teacherId === viewer.id) return;
    }
    throw new AppException('FORBIDDEN', "Bu ma'lumotni ko'rish huquqingiz yo'q", 403);
  }

  /** O'qituvchi faqat o'ziga biriktirilgan guruhda ishlay oladi; admin — hammasida */
  async assertCanManageGroup(viewer: AuthUser, groupId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new AppException('GROUP_NOT_FOUND', 'Guruh topilmadi', 404);
    if (viewer.role === 'admin' || viewer.role === 'super_admin') return;
    if (viewer.role === 'teacher' && group.teacherId === viewer.id) return;
    throw new AppException('FORBIDDEN', 'Bu guruh sizga biriktirilmagan', 403);
  }

  /** Ota-onaga bog'langan farzandlar (user id ro'yxati) */
  async childUserIds(parentUserId: string): Promise<string[]> {
    const links = await this.prisma.parentStudent.findMany({ where: { parentUserId } });
    return links.map((l) => l.studentId);
  }

  /** O'qituvchiga biriktirilgan guruh idlari */
  async teacherGroupIds(teacherUserId: string): Promise<string[]> {
    const groups = await this.prisma.group.findMany({
      where: { teacherId: teacherUserId },
      select: { id: true },
    });
    return groups.map((g) => g.id);
  }
}
