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
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teachers.dto';
import { teacherPhotoMulterOptions } from './teacher-photo.multer';
import { TeachersService } from './teachers.service';

// Diqqat: 'all' marshruti ':id/photo' dan OLDIN e'lon qilinadi
@ApiTags('teachers')
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  /** O'qituvchilar ro'yxati — rasmiy sayt uchun ochiq (faqat faollar) */
  @Public()
  @Get()
  list() {
    return this.teachers.listPublic();
  }

  /** Boshqaruv uchun to'liq ro'yxat (yashirilganlar ham) */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Get('all')
  listAll() {
    return this.teachers.listAll();
  }

  /** O'qituvchi rasmi — ochiq, keshlanadi */
  @Public()
  @Get(':id/photo')
  photo(@Param('id') id: string, @Res() res: Response) {
    return this.teachers.photo(id, res);
  }

  /** O'qituvchi qo'shish (multipart/form-data: name, specialty, …, photo?) */
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Roles('admin', 'super_admin')
  @Post()
  @UseInterceptors(FileInterceptor('photo', teacherPhotoMulterOptions()))
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTeacherDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.teachers.create(user, dto, photo);
  }

  /** O'qituvchini tahrirlash (rasm ham yangilanishi mumkin) */
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Roles('admin', 'super_admin')
  @Patch(':id')
  @UseInterceptors(FileInterceptor('photo', teacherPhotoMulterOptions()))
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.teachers.update(user, id, dto, photo);
  }

  /** O'qituvchini o'chirish (faqat super admin) */
  @ApiBearerAuth()
  @Roles('super_admin')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.teachers.remove(user, id);
  }
}
