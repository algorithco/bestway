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

  /** To'lovlar tarixi. O'quvchi/ota-ona faqat o'zinikini, o'qituvchi faqat o'z guruhlarinikini ko'radi */
  @Get()
  @Roles('admin', 'super_admin', 'parent', 'student', 'teacher')
  list(@CurrentUser() user: AuthUser, @Query() q: QueryPaymentsDto) {
    return this.payments.list(user, q);
  }

  /** To'lanmaganlar ro'yxati (oy bo'yicha). O'qituvchi faqat o'z guruhlarinikini ko'radi */
  @Get('debtors')
  @Roles('admin', 'super_admin', 'teacher')
  debtors(@CurrentUser() user: AuthUser, @Query() q: DebtorsQueryDto) {
    return this.payments.debtors(user, q);
  }

  /** Oylik to'lov jadvalini bitta so'rovda saqlash (faqat qo'lda belgilash; o'qituvchi — o'z guruhlarida) */
  @Put('bulk')
  @Roles('admin', 'super_admin', 'teacher')
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkPaymentsDto) {
    return this.payments.bulkUpsert(user, dto);
  }

  /** Qarzdorlarga bir tugma bilan to'lov eslatmasi yuborish (o'qituvchi — o'z guruhlariga) */
  @Post('remind')
  @Roles('admin', 'super_admin', 'teacher')
  remind(@CurrentUser() user: AuthUser, @Body() dto: RemindDto) {
    return this.payments.remind(user, dto);
  }
}
