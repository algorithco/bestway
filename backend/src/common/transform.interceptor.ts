import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Response } from 'express';
import { Paginated } from './pagination';

/** Barcha muvaffaqiyatli javoblarni kontraktdagi { success: true, data } shakliga o'raydi */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        const res = context.switchToHttp().getResponse<Response>();
        // PDF/video kabi binary javoblarga tegilmaydi
        if (data instanceof StreamableFile || res.headersSent) return data;
        if (data instanceof Paginated) {
          return { success: true, data: data.items, meta: data.meta };
        }
        return { success: true, data: data === undefined ? null : data };
      }),
    );
  }
}
