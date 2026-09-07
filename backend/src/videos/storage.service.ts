import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { AppException } from '../common/app.exception';

/**
 * Lokal disk saqlash qatlami.
 * Kelajakda S3/Bunny Stream'ga o'tishda faqat shu servis almashtiriladi
 * (backend-prompt.md, 10-band: almashtiriladigan qatlam sifatida loyihalangan).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    this.baseDir = path.resolve(config.get<string>('STORAGE_DIR') ?? './storage');
  }

  onModuleInit() {
    for (const dir of ['videos', 'thumbnails', 'teachers', 'gallery']) {
      fs.mkdirSync(path.join(this.baseDir, dir), { recursive: true });
    }
  }

  resolve(key: string): string {
    const abs = path.resolve(this.baseDir, key);
    if (abs !== this.baseDir && !abs.startsWith(this.baseDir + path.sep)) {
      throw new AppException('INVALID_FILE_KEY', "Fayl manzili noto'g'ri", 400);
    }
    return abs;
  }

  exists(key: string): boolean {
    return fs.existsSync(this.resolve(key));
  }

  stat(key: string): fs.Stats {
    return fs.statSync(this.resolve(key));
  }

  createReadStream(key: string, opts?: { start: number; end: number }): fs.ReadStream {
    return fs.createReadStream(this.resolve(key), opts);
  }

  delete(key: string): void {
    try {
      fs.unlinkSync(this.resolve(key));
    } catch {
      // fayl allaqachon yo'q bo'lsa ham davom etamiz
    }
  }
}

/** Multer sozlamalari — fayllar to'g'ridan-to'g'ri diskka yoziladi (xotira band bo'lmaydi) */
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.mkv']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function videoMulterOptions() {
  return {
    storage: diskStorage({
      destination: (
        _req: unknown,
        file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void,
      ) => {
        const base = path.resolve(process.env.STORAGE_DIR ?? './storage');
        const sub = file.fieldname === 'thumbnail' ? 'thumbnails' : 'videos';
        const dir = path.join(base, sub);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (
        _req: unknown,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void,
      ) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: {
      fileSize: parseInt(process.env.MAX_UPLOAD_MB ?? '500', 10) * 1024 * 1024,
      // GHSA-72gw-mp4g-v24j: deeply nested field names DoS — 2.2.0 requires explicit depth
      fieldNestingDepth: 5,
      fields: 20,
      files: 2,
      fieldSize: 1024 * 1024, // 1 MB per non-file field
    },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      // mimetype mijoz tomonidan keladi — kengaytmani ham tekshiramiz
      // (aks holda .html/.svg ni image/png deb niqoblab yuklash mumkin).
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.fieldname === 'file') {
        if (!file.mimetype.startsWith('video/') || !VIDEO_EXTS.has(ext)) {
          return cb(new AppException('INVALID_FILE_TYPE', 'Video fayl yuklang (mp4 va h.k.)', 400), false);
        }
      }
      if (file.fieldname === 'thumbnail') {
        if (!file.mimetype.startsWith('image/') || !IMAGE_EXTS.has(ext)) {
          return cb(new AppException('INVALID_FILE_TYPE', "Muqova rasm fayli bo'lishi kerak (jpg, png, webp)", 400), false);
        }
      }
      cb(null, true);
    },
  };
}
