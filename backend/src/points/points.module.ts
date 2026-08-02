import { Module } from '@nestjs/common';
import { GameModule } from '../game/game.module';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  imports: [GameModule],
  controllers: [PointsController],
  providers: [PointsService],
})
export class PointsModule {}
