import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PurchaseStatus, VideoLesson } from '@prisma/client';
import { Request, Response } from 'express';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { Paginated } from '../common/pagination';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmPurchaseDto, CreateVideoDto, QueryPurchasesDto, UpdateVideoDto } from './dto/videos.dto';
import { StorageService } from './storage.service';
import { StreamTokenService } from './stream-token.service';

type UploadedVideoFiles = {
  file?: Express.Multer.File[];
  thumbnail?: Express.Multer.File[];
};

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tokens: StreamTokenService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private publicUrl(): string {
    const url =
      this.config.get<string>('PUBLIC_URL') ??
      `http://localhost:${this.config.get<string>('PORT') ?? '3001'}`;
    return url.replace(/\/$/, '');
  }

  private thumbnailUrl(video: VideoLesson): string | null {
    return video.thumbnailKey ? `${this.publicUrl()}/v1/videos/${video.id}/thumbnail` : null;
  }

  private async getVideo(id: string): Promise<VideoLesson> {
    const video = await this.prisma.videoLesson.findUnique({ where: { id } });
    if (!video) throw new AppException('VIDEO_NOT_FOUND', 'Video topilmadi', 404);
    return video;
  }

  /**
   * Kirish qoidasi (biznes-mantiq 6-band):
   * bepul video → hamma; tasdiqlangan o'quvchi → isFreeForApproved videolar bepul;
   * qolganlar → admin tasdiqlagan xarid bo'lsa.
   */
  private accessFor(
    user: AuthUser,
    video: VideoLesson,
    purchaseStatus?: PurchaseStatus,
  ): 'granted' | 'pending_confirmation' | 'locked' {
    if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'teacher') {
      return 'granted';
    }
    if (video.price === 0) return 'granted';
    if (user.studentProfile?.isApproved && video.isFreeForApproved) return 'granted';
    if (purchaseStatus === 'purchased') return 'granted';
    if (purchaseStatus === 'pending_confirmation') return 'pending_confirmation';
    return 'locked';
  }

  /** GET /videos — mehmonlar ham ko'radi (narx bilan); login bo'lsa access holati qo'shiladi */
  async list(user?: AuthUser) {
    const videos = await this.prisma.videoLesson.findMany({ orderBy: { createdAt: 'desc' } });
    let purchases = new Map<string, PurchaseStatus>();
    if (user) {
      const rows = await this.prisma.videoPurchase.findMany({ where: { userId: user.id } });
      purchases = new Map(rows.map((r) => [r.videoId, r.status]));
    }
    return videos.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      price: v.price,
      isFreeForApproved: v.isFreeForApproved,
      thumbnailUrl: this.thumbnailUrl(v),
      createdAt: v.createdAt,
      ...(user ? { access: this.accessFor(user, v, purchases.get(v.id)) } : {}),
    }));
  }

  /** POST /videos — video yuklash (multipart: file, thumbnail?) */
  async create(actor: AuthUser, dto: CreateVideoDto, files: UploadedVideoFiles) {
    const file = files.file?.[0];
    if (!file) {
      throw new AppException('FILE_REQUIRED', 'Video fayl yuklanmadi (maydon nomi: "file")', 400);
    }
    const thumb = files.thumbnail?.[0];
    const video = await this.prisma.videoLesson.create({
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        isFreeForApproved: dto.isFreeForApproved ?? true,
        fileKey: `videos/${file.filename}`,
        mimeType: file.mimetype,
        thumbnailKey: thumb ? `thumbnails/${thumb.filename}` : null,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'video.create',
      entity: 'videoLesson',
      entityId: video.id,
      newValue: { title: video.title, price: video.price },
    });
    return {
      id: video.id,
      title: video.title,
      description: video.description,
      price: video.price,
      isFreeForApproved: video.isFreeForApproved,
      thumbnailUrl: this.thumbnailUrl(video),
      createdAt: video.createdAt,
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdateVideoDto) {
    const video = await this.getVideo(id);
    const updated = await this.prisma.videoLesson.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.isFreeForApproved !== undefined
          ? { isFreeForApproved: dto.isFreeForApproved }
          : {}),
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'video.update',
      entity: 'videoLesson',
      entityId: id,
      oldValue: { title: video.title, price: video.price },
      newValue: { title: updated.title, price: updated.price },
    });
    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      price: updated.price,
      isFreeForApproved: updated.isFreeForApproved,
      thumbnailUrl: this.thumbnailUrl(updated),
      createdAt: updated.createdAt,
    };
  }

  async remove(actor: AuthUser, id: string) {
    const video = await this.getVideo(id);
    await this.prisma.videoLesson.delete({ where: { id } });
    this.storage.delete(video.fileKey);
    if (video.thumbnailKey) this.storage.delete(video.thumbnailKey);
    await this.audit.log({
      userId: actor.id,
      action: 'video.delete',
      entity: 'videoLesson',
      entityId: id,
      oldValue: { title: video.title },
    });
    return { deleted: true };
  }

  /** GET /videos/:id/stream-url — muddati cheklangan, imzolangan havola */
  async streamUrl(user: AuthUser, videoId: string) {
    const video = await this.getVideo(videoId);
    const purchase = await this.prisma.videoPurchase.findUnique({
      where: { userId_videoId: { userId: user.id, videoId } },
    });
    const access = this.accessFor(user, video, purchase?.status);
    if (access !== 'granted') {
      throw new AppException(
        'VIDEO_ACCESS_DENIED',
        access === 'pending_confirmation'
          ? "Xaridingiz admin tasdig'ini kutmoqda"
          : 'Bu video pullik — sotib olish uchun administratsiyaga murojaat qiling',
        403,
      );
    }
    const ttl = parseInt(this.config.get<string>('STREAM_URL_TTL_SECONDS') ?? '3600', 10);
    const { token, expiresAt } = this.tokens.sign(videoId, user.id, ttl);
    return { url: `${this.publicUrl()}/v1/videos/stream?token=${token}`, expiresAt };
  }

  /** GET /videos/stream?token= — Range qo'llab-quvvatlaydigan oqim */
  async stream(token: string, req: Request, res: Response): Promise<void> {
    const { videoId } = this.tokens.verify(token);
    const video = await this.getVideo(videoId);
    if (!this.storage.exists(video.fileKey)) {
      throw new AppException('FILE_NOT_FOUND', 'Video fayl topilmadi', 404);
    }
    const size = this.storage.stat(video.fileKey).size;
    const mime = video.mimeType ?? 'video/mp4';
    const range = req.headers.range;

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
      if (Number.isNaN(start) || start < 0) start = 0;
      if (Number.isNaN(end) || end >= size) end = size - 1;
      if (start > end) {
        start = 0;
        end = size - 1;
      }
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': mime,
      });
      this.storage.createReadStream(video.fileKey, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': size,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
      });
      this.storage.createReadStream(video.fileKey).pipe(res);
    }
  }

  /** GET /videos/:id/thumbnail — muqova rasmi (ochiq) */
  async thumbnail(videoId: string, res: Response): Promise<void> {
    const video = await this.getVideo(videoId);
    if (!video.thumbnailKey || !this.storage.exists(video.thumbnailKey)) {
      throw new AppException('FILE_NOT_FOUND', 'Muqova topilmadi', 404);
    }
    const ext = path.extname(video.thumbnailKey).slice(1).toLowerCase() || 'jpeg';
    res.writeHead(200, {
      'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      'Cache-Control': 'public, max-age=86400',
    });
    this.storage.createReadStream(video.thumbnailKey).pipe(res);
  }

  /**
   * POST /videos/:id/purchase — onlayn to'lov YO'Q (8-band):
   * o'quvchi so'rov qoldiradi, pul qo'lda to'lanadi, admin tasdiqlaydi.
   */
  async purchase(user: AuthUser, videoId: string) {
    const video = await this.getVideo(videoId);
    const purchase = await this.prisma.videoPurchase.findUnique({
      where: { userId_videoId: { userId: user.id, videoId } },
    });
    const access = this.accessFor(user, video, purchase?.status);
    if (access === 'granted') {
      throw new AppException('VIDEO_ALREADY_ACCESSIBLE', 'Bu video siz uchun allaqachon ochiq', 400);
    }
    if (access === 'pending_confirmation') {
      return { status: 'pending_confirmation' };
    }
    await this.prisma.videoPurchase.upsert({
      where: { userId_videoId: { userId: user.id, videoId } },
      update: { status: 'pending_confirmation' },
      create: { userId: user.id, videoId, status: 'pending_confirmation', method: 'manual' },
    });
    return { status: 'pending_confirmation' };
  }

  /** POST /videos/:id/confirm-purchase — admin qo'lda "sotib olindi" deb belgilaydi */
  async confirmPurchase(actor: AuthUser, videoId: string, dto: ConfirmPurchaseDto) {
    await this.getVideo(videoId);
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new AppException('USER_NOT_FOUND', 'Foydalanuvchi topilmadi', 404);

    const purchase = await this.prisma.videoPurchase.upsert({
      where: { userId_videoId: { userId: dto.userId, videoId } },
      update: { status: 'purchased', confirmedById: actor.id },
      create: {
        userId: dto.userId,
        videoId,
        status: 'purchased',
        method: 'manual',
        confirmedById: actor.id,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'video.confirm_purchase',
      entity: 'videoPurchase',
      entityId: purchase.id,
      newValue: { videoId, userId: dto.userId, status: 'purchased' },
    });
    return { status: 'purchased' };
  }

  /** Admin paneli: xaridlar ro'yxati (tasdiqlash kutayotganlar: ?status=pending_confirmation) */
  async listPurchases(q: QueryPurchasesDto) {
    const where: Prisma.VideoPurchaseWhereInput = q.status ? { status: q.status } : {};
    const [total, rows] = await Promise.all([
      this.prisma.videoPurchase.count({ where }),
      this.prisma.videoPurchase.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true } },
          video: { select: { id: true, title: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
    ]);
    return new Paginated(
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name,
        userPhone: r.user.phone,
        videoId: r.videoId,
        videoTitle: r.video.title,
        price: r.video.price,
        status: r.status,
        method: r.method,
        createdAt: r.createdAt,
      })),
      { page: q.page, limit: q.limit, total },
    );
  }
}
