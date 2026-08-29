import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { MulterError } from 'multer';
import { AppException } from './app.exception';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
};

/** Barcha xatoliklarni kontraktdagi { success: false, error: { code, message } } shakliga o'giradi */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Serverda kutilmagan xatolik yuz berdi';

    if (exception instanceof AppException) {
      status = exception.getStatus();
      const body = exception.getResponse() as { code: string; message: string };
      code = body.code;
      message = body.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const raw =
        typeof body === 'string'
          ? body
          : ((body as Record<string, unknown>).message ?? exception.message);
      message = Array.isArray(raw) ? String(raw[0]) : String(raw);
      code = CODE_BY_STATUS[status] ?? 'ERROR';
    } else if (exception instanceof MulterError) {
      status = 400;
      code = exception.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR';
      message =
        exception.code === 'LIMIT_FILE_SIZE'
          ? 'Fayl hajmi ruxsat etilganidan katta'
          : exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        code = 'DUPLICATE';
        message = 'Bunday yozuv allaqachon mavjud';
      } else if (exception.code === 'P2025') {
        status = 404;
        code = 'NOT_FOUND';
        message = 'Yozuv topilmadi';
      } else if (exception.code === 'P2003') {
        status = 400;
        code = 'FOREIGN_KEY_VIOLATION';
        message = "Bog'liq yozuv topilmadi";
      } else {
        this.logger.error(`Prisma xatosi ${exception.code}: ${exception.message}`);
      }
    } else {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }

    res.status(status).json({ success: false, error: { code, message } });
  }
}
