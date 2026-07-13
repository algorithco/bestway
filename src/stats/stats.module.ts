import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService, ExportService],
})
export class StatsModule {}
