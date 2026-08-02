import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { BulkPaymentsDto, DebtorsQueryDto, QueryPaymentsDto, RemindDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** To'lovlar tarixi. O'quvchi/ota-ona faqat o'zinikini ko'radi */
  @Get()
  @Roles('admin', 'super_admin', 'parent', 'student')
  list(@CurrentUser() user: AuthUser, @Query() q: QueryPaymentsDto) {
    return this.payments.list(user, q);
  }

  /** To'lanmaganlar ro'yxati (oy bo'yicha) */
  @Get('debtors')
  @Roles('admin', 'super_admin')
  debtors(@Query() q: DebtorsQueryDto) {
    return this.payments.debtors(q);
  }

  /** Oylik to'lov jadvalini bitta so'rovda saqlash (faqat qo'lda belgilash) */
  @Put('bulk')
  @Roles('admin', 'super_admin')
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkPaymentsDto) {
    return this.payments.bulkUpsert(user, dto);
  }

  /** Qarzdorlarga bir tugma bilan to'lov eslatmasi yuborish */
  @Post('remind')
  @Roles('admin', 'super_admin')
  remind(@CurrentUser() user: AuthUser, @Body() dto: RemindDto) {
    return this.payments.remind(user, dto);
  }
}
