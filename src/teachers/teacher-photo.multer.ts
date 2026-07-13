import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { AppException } from '../common/app.exception';

/**
 * O'qituvchi rasmi uchun multer sozlamasi — rasm to'g'ridan-to'g'ri
 * storage/teachers ichiga yoziladi (video muqovasi bilan bir xil uslub).
 * Faqat rasm fayllari qabul qilinadi, hajmi 10 MB gacha.
 */
export function teacherPhotoMulterOptions() {
  return {
    storage: diskStorage({
      destination: (
        _req: unknown,
        _file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void,
      ) => {
        const dir = path.join(path.resolve(process.env.STORAGE_DIR ?? './storage'), 'teachers');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (
        _req: unknown,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void,
      ) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new AppException('INVALID_FILE_TYPE', "Rasm fayli bo'lishi kerak (jpg, png…)", 400), false);
      }
      cb(null, true);
    },
  };
}
