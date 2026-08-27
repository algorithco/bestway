import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { CreateGalleryDto, UpdateGalleryDto } from './dto/gallery.dto';
import { galleryMulterOptions } from './gallery.multer';
import { GalleryService } from './gallery.service';

@ApiTags('gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  /** Galereya — ochiq, faqat faol rasmlar (marketing AccordionGallery) */
  @Public()
  @Get()
  list() {
    return this.gallery.listPublic();
  }

  /** Admin uchun to'liq ro'yxat (yashirilganlar ham) */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Get('all')
  listAll() {
    return this.gallery.listAll();
  }

  /** Rasm — ochiq, keshlanadi */
  @Public()
  @Get(':id/image')
  image(@Param('id') id: string, @Res() res: Response) {
    return this.gallery.image(id, res);
  }

  /** Rasm qo'shish (multipart: image + label/link/alt/sortOrder/isActive) */
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Roles('admin', 'super_admin')
  @Post()
  @UseInterceptors(FileInterceptor('image', galleryMulterOptions()))
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGalleryDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.gallery.create(user, dto, file);
  }

  /** Tahrirlash (rasm yangilanishi mumkin) */
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Roles('admin', 'super_admin')
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', galleryMulterOptions()))
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGalleryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.gallery.update(user, id, dto, file);
  }

  /** O'chirish */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.gallery.remove(user, id);
  }
}
