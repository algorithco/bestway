import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { CreateUserDto, QueryUsersDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Foydalanuvchilar ro'yxati (rol/guruh/qidiruv bo'yicha filter) */
  @Get()
  @Roles('admin', 'super_admin')
  list(@Query() q: QueryUsersDto) {
    return this.users.list(q);
  }

  /** Yangi foydalanuvchi qo'shish (admin rolini faqat super admin beradi) */
  @Post()
  @Roles('admin', 'super_admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  /** Bitta foydalanuvchi — o'zi, admin, bog'langan ota-ona yoki guruh o'qituvchisi ko'ra oladi */
  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.getOne(user, id);
  }

  /** Profilni tahrirlash (isApproved, guruh, rol, parol va h.k.) */
  @Patch(':id')
  @Roles('admin', 'super_admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(user, id, dto);
  }

  /** Foydalanuvchini deaktivatsiya qilish (yumshoq o'chirish) — faqat super admin */
  @Delete(':id')
  @Roles('super_admin')
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.deactivate(user, id);
  }
}
