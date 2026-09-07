import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GalleryImage, Prisma } from '@prisma/client';
import { Response } from 'express';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../videos/storage.service';
import { CreateGalleryDto, UpdateGalleryDto } from './dto/gallery.dto';

@Injectable()
export class GalleryService {
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

  private imageUrl(item: GalleryImage): string {
    return `${this.publicUrl()}/v1/gallery/${item.id}/image?v=${item.updatedAt.getTime()}`;
  }

  private toPublic(item: GalleryImage) {
    return {
      id: item.id,
      image: this.imageUrl(item),
      label: item.label ?? undefined,
      link: item.link ?? undefined,
      alt: item.alt ?? undefined,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      createdAt: item.createdAt,
    };
  }

  private toAdmin(item: GalleryImage) {
    return {
      ...this.toPublic(item),
      imageKey: item.imageKey,
      updatedAt: item.updatedAt,
    };
  }

  private async getOrThrow(id: string): Promise<GalleryImage> {
    const item = await this.prisma.galleryImage.findUnique({ where: { id } });
    if (!item) throw new AppException('GALLERY_NOT_FOUND', 'Galereya rasmi topilmadi', 404);
    return item;
  }

  /** GET /gallery — ochiq: faqat faol, tartib bo'yicha */
  async listPublic() {
    const rows = await this.prisma.galleryImage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.toPublic(r));
  }

  /** GET /gallery/all — admin: hammasi */
  async listAll() {
    const rows = await this.prisma.galleryImage.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.toAdmin(r));
  }

  async create(actor: AuthUser, dto: CreateGalleryDto, file?: Express.Multer.File) {
    if (!file) throw new AppException('FILE_REQUIRED', 'Rasm yuklash majburiy', 400);
    const item = await this.prisma.galleryImage.create({
      data: {
        imageKey: `gallery/${file.filename}`,
        label: dto.label?.trim() || null,
        link: dto.link?.trim() || null,
        alt: dto.alt?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'gallery.create',
      entity: 'gallery',
      entityId: item.id,
      newValue: { label: item.label, imageKey: item.imageKey },
    });
    return this.toAdmin(item);
  }

  async update(actor: AuthUser, id: string, dto: UpdateGalleryDto, file?: Express.Multer.File) {
    const existing = await this.getOrThrow(id);
    const data: Prisma.GalleryImageUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label.trim() || null;
    if (dto.link !== undefined) data.link = dto.link.trim() || null;
    if (dto.alt !== undefined) data.alt = dto.alt.trim() || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (file) data.imageKey = `gallery/${file.filename}`;

    const updated = await this.prisma.galleryImage.update({ where: { id }, data });

    if (file && existing.imageKey && existing.imageKey !== updated.imageKey) {
      this.storage.delete(existing.imageKey);
    }

    await this.audit.log({
      userId: actor.id,
      action: 'gallery.update',
      entity: 'gallery',
      entityId: id,
      oldValue: { label: existing.label, isActive: existing.isActive },
      newValue: { label: updated.label, isActive: updated.isActive },
    });
    return this.toAdmin(updated);
  }

  async remove(actor: AuthUser, id: string) {
    const item = await this.getOrThrow(id);
    await this.prisma.galleryImage.delete({ where: { id } });
    this.storage.delete(item.imageKey);
    await this.audit.log({
      userId: actor.id,
      action: 'gallery.delete',
      entity: 'gallery',
      entityId: id,
      oldValue: { label: item.label },
    });
    return { deleted: true };
  }

  async image(id: string, res: Response): Promise<void> {
    const item = await this.getOrThrow(id);
    if (!item.imageKey || !this.storage.exists(item.imageKey)) {
      throw new AppException('FILE_NOT_FOUND', 'Rasm topilmadi', 404);
    }
    const ext = path.extname(item.imageKey).toLowerCase();
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    });
    this.storage.createReadStream(item.imageKey).pipe(res);
  }
}
