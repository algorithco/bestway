import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Roles } from '../common/decorators';
import { Paginated, PaginationQueryDto } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  action?: string;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /** Audit jurnal — faqat Super Admin ko'radi */
  @Get()
  @Roles('super_admin')
  async list(@Query() q: AuditQueryDto) {
    const where = {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.action ? { action: { contains: q.action } } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
    ]);
    return new Paginated(items, { page: q.page, limit: q.limit, total });
  }
}
