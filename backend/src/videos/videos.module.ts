import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StreamTokenService } from './stream-token.service';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  controllers: [VideosController],
  providers: [VideosService, StorageService, StreamTokenService],
})
export class VideosModule {}
