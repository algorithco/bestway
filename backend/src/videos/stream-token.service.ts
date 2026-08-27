import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppException } from '../common/app.exception';

/**
 * Token asosidagi, muddati cheklangan video URL (xavfsizlik talabi 7-band):
 * to'g'ridan-to'g'ri fayl linki hech qachon berilmaydi.
 */
@Injectable()
export class StreamTokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    const secret = config.get<string>('STREAM_TOKEN_SECRET') ?? config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        "STREAM_TOKEN_SECRET muhit o'zgaruvchisi talab qilinadi (JWT_SECRET ham bo'lishi mumkin)",
      );
    }
    this.secret = secret;
  }

  sign(videoId: string, userId: string, ttlSeconds: number): { token: string; expiresAt: Date } {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = Buffer.from(JSON.stringify({ v: videoId, u: userId, e: exp })).toString(
      'base64url',
    );
    const sig = createHmac('sha256', this.secret).update(payload).digest('base64url');
    return { token: `${payload}.${sig}`, expiresAt: new Date(exp * 1000) };
  }

  verify(token: string): { videoId: string; userId: string } {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) {
      throw new AppException('STREAM_TOKEN_INVALID', 'Stream havolasi yaroqsiz', 403);
    }
    const expected = createHmac('sha256', this.secret).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppException('STREAM_TOKEN_INVALID', 'Stream havolasi yaroqsiz', 403);
    }
    let data: { v: string; u: string; e: number };
    try {
      data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch {
      throw new AppException('STREAM_TOKEN_INVALID', 'Stream havolasi yaroqsiz', 403);
    }
    if (!data.e || data.e * 1000 < Date.now()) {
      throw new AppException(
        'STREAM_TOKEN_EXPIRED',
        'Stream havolasi muddati tugagan — sahifani yangilang',
        403,
      );
    }
    return { videoId: data.v, userId: data.u };
  }
}
