import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { Request, Response } from 'express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { AppException } from '../common/app.exception';

/** StorageService ning shu yerda kerak bo'lgan qismi */
export interface StorageLike {
  exists(key: string): boolean;
  stat(key: string): { size: number };
  createReadStream(key: string, opts?: { start: number; end: number }): NodeJS.ReadableStream;
}

function assertContainedKey(key: string): void {
  const normalized = path.posix.normalize(key.replace(/\\/g, '/'));
  if (path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new AppException('INVALID_FILE_KEY', "Fayl manzili noto'g'ri", 400);
  }
}

/** Faylni Range qo'llab-quvvatlagan holda oqim qilib beradi (audio/video/rasm) */
export function streamFileRange(
  storage: StorageLike,
  key: string,
  contentType: string,
  req: Request,
  res: Response,
): void {
  assertContainedKey(key);
  const stat = storage.stat(key);
  const range = req.headers.range;
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match && match[1] ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) {
      res.status(416).set({ 'Content-Range': `bytes */${stat.size}` }).end();
      return;
    }
    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
    });
    storage.createReadStream(key, { start, end }).pipe(res);
  } else {
    res.status(200).set({
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    storage.createReadStream(key).pipe(res);
  }
}

function mockDiskStorage() {
  return diskStorage({
    destination: (
      _req: unknown,
      _file: Express.Multer.File,
      cb: (error: Error | null, destination: string) => void,
    ) => {
      const dir = path.join(path.resolve(process.env.STORAGE_DIR ?? './storage'), 'mock');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  });
}

/** Mock media (Listening audio, map/diagram rasm) uchun multer sozlamalari */
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.webm', '.mp4']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function mockMediaMulterOptions() {
  return {
    storage: mockDiskStorage(),
    limits: {
      fileSize: parseInt(process.env.MAX_UPLOAD_MB ?? '500', 10) * 1024 * 1024,
      fieldNestingDepth: 5,
      fields: 20,
      files: 2,
      fieldSize: 1024 * 1024,
    },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.fieldname === 'audio' && (!file.mimetype.startsWith('audio/') || !AUDIO_EXTS.has(ext))) {
        return cb(new AppException('INVALID_FILE_TYPE', 'Audio fayl yuklang (mp3, m4a...)', 400), false);
      }
      if (file.fieldname === 'image' && (!file.mimetype.startsWith('image/') || !IMAGE_EXTS.has(ext))) {
        return cb(new AppException('INVALID_FILE_TYPE', 'Rasm fayli yuklang', 400), false);
      }
      cb(null, true);
    },
  };
}

/** AI JSON import staged upload — bitta `file` maydoni, audio yoki rasm. */
export function stagedImportMulterOptions() {
  return {
    storage: mockDiskStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024,
      fieldNestingDepth: 3,
      fields: 10,
      files: 1,
      fieldSize: 1024 * 1024,
    },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const audio = file.mimetype.startsWith('audio/') && AUDIO_EXTS.has(ext);
      const image = file.mimetype.startsWith('image/') && IMAGE_EXTS.has(ext);
      if (!audio && !image) {
        return cb(new AppException('INVALID_FILE_TYPE', 'Audio yoki rasm yuklang', 400), false);
      }
      cb(null, true);
    },
  };
}

const SPEAKING_AUDIO_MAX_MB = 25;

/** Speaking javob audio uchun alohida profil — kichik limit va faqat audio/* */
export function speakingAudioMulterOptions() {
  return {
    storage: mockDiskStorage(),
    limits: {
      fileSize: SPEAKING_AUDIO_MAX_MB * 1024 * 1024,
      fieldNestingDepth: 3,
      fields: 20,
      files: 1,
      fieldSize: 1024 * 1024,
    },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!file.mimetype.startsWith('audio/') || !AUDIO_EXTS.has(ext)) {
        return cb(new AppException('INVALID_FILE_TYPE', 'Audio fayl yuklang (mp3, m4a...)', 400), false);
      }
      cb(null, true);
    },
  };
}

/** Kalitdan (fayl kengaytmasi bo'yicha) audio Content-Type */
export function audioContentType(key: string): string {
  const ext = path.extname(key).toLowerCase();
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
    case '.mp4':
      return 'audio/mp4';
    case '.ogg':
      return 'audio/ogg';
    case '.wav':
      return 'audio/wav';
    case '.aac':
      return 'audio/aac';
    default:
      return 'audio/mpeg';
  }
}
