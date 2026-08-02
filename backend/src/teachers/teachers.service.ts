import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Teacher } from '@prisma/client';
import { Response } from 'express';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../videos/storage.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teachers.dto';

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private publicUrl(): string {
    const url =
      this.config.get<string>('PUBLIC_URL') ??
      `http://localhost:${this.config.get<string>('PORT') ?? '3001'}`;
    return url.replace(/\/$/, '');
  }

  private photoUrl(t: Teacher): string | null {
    // ?v= — rasm almashganda brauzer keshini yangilash uchun
    return t.photoKey
      ? `${this.publicUrl()}/v1/teachers/${t.id}/photo?v=${t.updatedAt.getTime()}`
      : null;
  }

  /** Rasmiy sayt uchun ochiq shakl */
  private toPublic(t: Teacher) {
    return {
      id: t.id,
      name: t.name,
      specialty: t.specialty,
      achievement: t.achievement,
      bio: t.bio,
      experienceYears: t.experienceYears,
      photoUrl: this.photoUrl(t),
      socialUrl: t.socialUrl,
    };
  }

  /** Admin paneli uchun to'liq shakl (yashirilganlar + tartib + holat) */
  private toAdmin(t: Teacher) {
    return {
      ...this.toPublic(t),
      sortOrder: t.sortOrder,
      isActive: t.isActive,
      createdAt: t.createdAt,
    };
  }

  private async getOrThrow(id: string): Promise<Teacher> {
    const t = await this.prisma.teacher.findUnique({ where: { id } });
    if (!t) throw new AppException('TEACHER_NOT_FOUND', "O'qituvchi topilmadi", 404);
    return t;
  }

  /** GET /teachers — ochiq: faqat faol, tartib bo'yicha (sayt bosh sahifasi) */
  async listPublic() {
    const rows = await this.prisma.teacher.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((t) => this.toPublic(t));
  }

  /** GET /teachers/all — admin: yashirilganlar bilan birga hammasi */
  async listAll() {
    const rows = await this.prisma.teacher.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((t) => this.toAdmin(t));
  }

  async create(actor: AuthUser, dto: CreateTeacherDto, photo?: Express.Multer.File) {
    const teacher = await this.prisma.teacher.create({
      data: {
        name: dto.name.trim(),
        specialty: dto.specialty.trim(),
        achievement: dto.achievement?.trim() || null,
        bio: dto.bio?.trim() || null,
        experienceYears: dto.experienceYears ?? null,
        socialUrl: dto.socialUrl?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        photoKey: photo ? `teachers/${photo.filename}` : null,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'teacher.create',
      entity: 'teacher',
      entityId: teacher.id,
      newValue: { name: teacher.name, specialty: teacher.specialty },
    });
    return this.toAdmin(teacher);
  }

  async update(actor: AuthUser, id: string, dto: UpdateTeacherDto, photo?: Express.Multer.File) {
    const existing = await this.getOrThrow(id);

    const data: Prisma.TeacherUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.specialty !== undefined) data.specialty = dto.specialty.trim();
    if (dto.achievement !== undefined) data.achievement = dto.achievement.trim() || null;
    if (dto.bio !== undefined) data.bio = dto.bio.trim() || null;
    if (dto.experienceYears !== undefined) data.experienceYears = dto.experienceYears;
    if (dto.socialUrl !== undefined) data.socialUrl = dto.socialUrl.trim() || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (photo) data.photoKey = `teachers/${photo.filename}`;

    const updated = await this.prisma.teacher.update({ where: { id }, data });

    // Yangi rasm yuklangan bo'lsa — eskisini diskdan o'chiramiz
    if (photo && existing.photoKey && existing.photoKey !== updated.photoKey) {
      this.storage.delete(existing.photoKey);
    }

    await this.audit.log({
      userId: actor.id,
      action: 'teacher.update',
      entity: 'teacher',
      entityId: id,
      oldValue: { name: existing.name, isActive: existing.isActive },
      newValue: { name: updated.name, isActive: updated.isActive },
    });
    return this.toAdmin(updated);
  }

  async remove(actor: AuthUser, id: string) {
    const teacher = await this.getOrThrow(id);
    await this.prisma.teacher.delete({ where: { id } });
    if (teacher.photoKey) this.storage.delete(teacher.photoKey);
    await this.audit.log({
      userId: actor.id,
      action: 'teacher.delete',
      entity: 'teacher',
      entityId: id,
      oldValue: { name: teacher.name },
    });
    return { deleted: true };
  }

  /** GET /teachers/:id/photo — o'qituvchi rasmi (ochiq, keshlanadi) */
  async photo(id: string, res: Response): Promise<void> {
    const teacher = await this.getOrThrow(id);
    if (!teacher.photoKey || !this.storage.exists(teacher.photoKey)) {
      throw new AppException('FILE_NOT_FOUND', 'Rasm topilmadi', 404);
    }
    const ext = path.extname(teacher.photoKey).slice(1).toLowerCase() || 'jpeg';
    res.writeHead(200, {
      'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      'Cache-Control': 'public, max-age=3600',
    });
    this.storage.createReadStream(teacher.photoKey).pipe(res);
  }
}
