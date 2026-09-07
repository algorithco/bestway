import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { Request, Response } from 'express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { AppException } from '../common/app.exception';

/** Storage kaliti xavfsizligi — directory traversal oldini olish */
function assertContainedKey(key: string): void {
  const normalized = path.posix.normalize(key.replace(/\\/g, '/'));
  if (path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new AppException('INVALID_FILE_KEY', "Fayl manzili noto'g'ri", 400);
  }
}

/** Fayl mavjudligini va oqimini ta'minlovchi minimal helper — StorageService ga o'xshash */
export function resolveTestStoragePath(key: string): string {
  const base = path.resolve(process.env.STORAGE_DIR ?? './storage');
  assertContainedKey(key);
  const abs = path.resolve(base, key);
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new AppException('INVALID_FILE_KEY', "Fayl manzili noto'g'ri", 400);
  }
  return abs;
}

export function testAudioExists(key: string): boolean {
  return fs.existsSync(resolveTestStoragePath(key));
}

export function testAudioStat(key: string): fs.Stats {
  return fs.statSync(resolveTestStoragePath(key));
}

export function testAudioCreateReadStream(key: string, opts?: { start: number; end: number }): fs.ReadStream {
  return fs.createReadStream(resolveTestStoragePath(key), opts);
}

export function deleteTestAudio(key: string): void {
  try {
    fs.unlinkSync(resolveTestStoragePath(key));
  } catch {
    // already deleted
  }
}

function testDiskStorage() {
  return diskStorage({
    destination: (_req: unknown, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
      const base = path.resolve(process.env.STORAGE_DIR ?? './storage');
      const dir = path.join(base, 'tests');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) =>
      cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  });
}

/** Question audio uchun multer — 50MB, faqat audio/* */
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.webm', '.mp4']);

export function testAudioMulterOptions() {
  return {
    storage: testDiskStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024,
      fieldNestingDepth: 5,
      fields: 20,
      files: 1,
      fieldSize: 1024 * 1024,
    },
    fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!file.mimetype.startsWith('audio/') || !AUDIO_EXTS.has(ext)) {
        return cb(new AppException('INVALID_FILE_TYPE', 'Audio fayl yuklang (mp3, m4a, wav, ogg)', 400), false);
      }
      cb(null, true);
    },
  };
}

/** Kalit kengaytmasidan Content-Type */
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
    case '.webm':
      return 'audio/webm';
    default:
      return 'audio/mpeg';
  }
}

/** Range bilan oqim — moq mock-storage.ts dagi kabi */
export function streamTestAudio(key: string, req: Request, res: Response): void {
  const stat = testAudioStat(key);
  const range = req.headers.range;
  const contentType = audioContentType(key);
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
    testAudioCreateReadStream(key, { start, end }).pipe(res);
  } else {
    res.status(200).set({
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    testAudioCreateReadStream(key).pipe(res);
  }
}
