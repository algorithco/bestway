import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { AuthService } from './auth.service';
import { LinkChildDto, LoginDto, LogoutDto, RefreshDto, RegisterDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Ro'yxatdan o'tish (faqat o'quvchi yoki ota-ona) */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  /**
   * Tizimga kirish.
   * Limit IP bo'yicha hisoblanadi — markazda hamma bitta Wi-Fi'dan kirishi mumkin,
   * shuning uchun 30/daqiqa (ro'yxatdan o'tish esa 10/daqiqa).
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** Access tokenni yangilash */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  /** Ota-ona farzandini bog'lash kodi orqali ulaydi */
  @Roles('parent')
  @ApiBearerAuth()
  @Post('link-child')
  @HttpCode(200)
  linkChild(@CurrentUser() user: AuthUser, @Body() dto: LinkChildDto) {
    return this.auth.linkChild(user, dto);
  }

  /** Joriy foydalanuvchi profili */
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  /** Chiqish — refresh tokenni bekor qilish */
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(200)
  logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    return this.auth.logout(user.id, dto.refreshToken);
  }
}
