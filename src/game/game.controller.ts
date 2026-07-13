import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { RosterQueryDto } from './dto/game.dto';
import { GameService } from './game.service';

/** CSV faylini brauzerga yuborish (Excel to'g'ri ochadi) */
function csv(res: Response, filename: string, body: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

@ApiTags('game')
@ApiBearerAuth()
@Controller('game')
export class GameController {
  constructor(private readonly game: GameService) {}

  /** Oylik o'yinga qo'shilganlar ro'yxati (ball bilan) — admin */
  @Roles('admin', 'super_admin')
  @Get('roster')
  roster(@Query() q: RosterQueryDto) {
    return this.game.roster(q.year, q.month);
  }

  /** Shu ro'yxatni CSV qilib yuklab olish — admin */
  @Roles('admin', 'super_admin')
  @Get('roster/export')
  async export(@Query() q: RosterQueryDto, @Res() res: Response) {
    const suffix = q.year ? `${q.year}-${q.month ?? ''}` : 'joriy-oy';
    csv(res, `oyin-royxati-${suffix}.csv`, await this.game.rosterCsv(q.year, q.month));
  }

  /** O'quvchining o'z o'yin holati (joriy ball, chegara, qo'shilganmi) */
  @Roles('student')
  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.game.status(user.id);
  }
}
