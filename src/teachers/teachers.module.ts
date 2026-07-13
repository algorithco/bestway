import { Module } from '@nestjs/common';
import { StorageService } from '../videos/storage.service';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

@Module({
  controllers: [TeachersController],
  // StorageService global emas — rasm saqlash/o'chirish uchun shu modulga beramiz
  providers: [TeachersService, StorageService],
})
export class TeachersModule {}
