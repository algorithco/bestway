import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators';

@ApiTags('health')
@Controller()
export class AppController {
  /** Server holati (monitoring uchun) */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
