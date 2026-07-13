import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { AdjustPointsDto, LeaderboardQueryDto } from './dto/points.dto';
import { PointsService } from './points.service';

@ApiTags('points')
@Controller('points')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  // Diqqat: 'leaderboard' marshruti ':studentId' dan OLDIN turishi shart
  /** Reyting jadvali (guruh yoki butun markaz) — ochiq */
  @Public()
  @Get('leaderboard')
  leaderboard(@Query() q: LeaderboardQueryDto) {
    return this.points.leaderboard(q);
  }

  /** O'quvchining joriy balli va tarixi */
  @ApiBearerAuth()
  @Get(':studentId')
  getPoints(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.points.getPoints(user, studentId);
  }

  /** Ball qo'shish/ayirish (sabab majburiy; o'qituvchi limit bilan) */
  @ApiBearerAuth()
  @Roles('teacher', 'admin', 'super_admin')
  @Post(':studentId/adjust')
  adjust(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: AdjustPointsDto,
  ) {
    return this.points.adjust(user, studentId, dto);
  }
}
