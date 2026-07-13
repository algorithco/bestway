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

/** Faylni Range qo'llab-quvvatlagan holda oqim qilib beradi (audio/video/rasm) */
export function streamFileRange(
  storage: StorageLike,
  key: string,
  contentType: string,
  req: Request,
  res: Response,
): void {
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

/** Mock media (Listening audio, map/diagram rasm) uchun multer sozlamalari */
export function mockMediaMulterOptions() {
  return {
    storage: diskStorage({
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
    }),
    limits: { fileSize: parseInt(process.env.MAX_UPLOAD_MB ?? '500', 10) * 1024 * 1024 },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (file.fieldname === 'audio' && !file.mimetype.startsWith('audio/')) {
        return cb(new AppException('INVALID_FILE_TYPE', 'Audio fayl yuklang (mp3, m4a...)', 400), false);
      }
      if (file.fieldname === 'image' && !file.mimetype.startsWith('image/')) {
        return cb(new AppException('INVALID_FILE_TYPE', 'Rasm fayli yuklang', 400), false);
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
