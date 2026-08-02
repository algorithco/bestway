import { HttpException } from '@nestjs/common';

/**
 * Kontraktdagi xatolik formati uchun asosiy exception:
 * { success: false, error: { code, message } }
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status = 400,
  ) {
    super({ code, message }, status);
  }
}
