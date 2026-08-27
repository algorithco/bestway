import { Module } from '@nestjs/common';
import { StorageService } from '../videos/storage.service';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  controllers: [GalleryController],
  providers: [GalleryService, StorageService],
})
export class GalleryModule {}
