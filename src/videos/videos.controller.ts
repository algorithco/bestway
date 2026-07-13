import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser, OptionalAuth, Public, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import {
  ConfirmPurchaseDto,
  CreateVideoDto,
  QueryPurchasesDto,
  UpdateVideoDto,
} from './dto/videos.dto';
import { videoMulterOptions } from './storage.service';
import { VideosService } from './videos.service';

// Diqqat: 'stream' va 'purchases' marshrutlari ':id' dan OLDIN e'lon qilinadi
@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  /** Video darslar ro'yxati — mehmonlar ham ko'radi */
  @OptionalAuth()
  @Get()
  list(@CurrentUser() user: AuthUser | undefined) {
    return this.videos.list(user);
  }

  /** Video yuklash (multipart/form-data: file, thumbnail?, title, price, ...) */
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Roles('admin', 'super_admin')
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
      ],
      videoMulterOptions(),
    ),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVideoDto,
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
  ) {
    return this.videos.create(user, dto, files ?? {});
  }

  /** Token bilan himoyalangan video oqimi (Range qo'llab-quvvatlanadi) */
  @Public()
  @Get('stream')
  stream(@Query('token') token: string, @Req() req: Request, @Res() res: Response) {
    return this.videos.stream(token ?? '', req, res);
  }

  /** Xaridlar ro'yxati (admin tasdiqlash paneli: ?status=pending_confirmation) */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Get('purchases')
  listPurchases(@Query() q: QueryPurchasesDto) {
    return this.videos.listPurchases(q);
  }

  /** Muqova rasmi (ochiq, keshlanadi) */
  @Public()
  @Get(':id/thumbnail')
  thumbnail(@Param('id') id: string, @Res() res: Response) {
    return this.videos.thumbnail(id, res);
  }

  /** Muddati cheklangan stream havolasi — kirish huquqi shu yerda tekshiriladi */
  @ApiBearerAuth()
  @Get(':id/stream-url')
  streamUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.videos.streamUrl(user, id);
  }

  /** O'quvchi sotib olish so'rovi qoldiradi (admin keyin qo'lda tasdiqlaydi) */
  @ApiBearerAuth()
  @Roles('student')
  @Post(':id/purchase')
  purchase(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.videos.purchase(user, id);
  }

  /** Admin xaridni qo'lda tasdiqlaydi (pul naqd/tashqi bank orqali olingan) */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Post(':id/confirm-purchase')
  confirmPurchase(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConfirmPurchaseDto,
  ) {
    return this.videos.confirmPurchase(user, id, dto);
  }

  /** Video ma'lumotlarini tahrirlash (narx, sarlavha) */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateVideoDto) {
    return this.videos.update(user, id, dto);
  }

  /** Videoni o'chirish (fayllar bilan birga) */
  @ApiBearerAuth()
  @Roles('super_admin')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.videos.remove(user, id);
  }
}
