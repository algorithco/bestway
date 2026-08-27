import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { AppException } from '../common/app.exception';

/**
 * Galereya rasmi uchun multer sozlamasi — storage/gallery ichiga yoziladi.
 * Faqat rasm fayllari, 10 MB gacha.
 */
export function galleryMulterOptions() {
  return {
    storage: diskStorage({
      destination: (
        _req: unknown,
        _file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void,
      ) => {
        const dir = path.join(path.resolve(process.env.STORAGE_DIR ?? './storage'), 'gallery');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (
        _req: unknown,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void,
      ) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new AppException('INVALID_FILE_TYPE', "Rasm fayli bo'lishi kerak (jpg, png, webp…)", 400), false);
      }
      cb(null, true);
    },
  };
}
