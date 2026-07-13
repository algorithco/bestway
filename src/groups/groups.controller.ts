import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { AddStudentDto, CreateGroupDto, UpdateGroupDto } from './dto/groups.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  /** Guruhlar ro'yxati — har kim o'ziga tegishlisini ko'radi */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.groups.list(user);
  }

  /** Guruh yaratish */
  @Post()
  @Roles('admin', 'super_admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(user, dto);
  }

  /** Guruh tafsilotlari (o'quvchilar ro'yxati bilan) */
  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.getOne(user, id);
  }

  /** Guruhni tahrirlash (nom, o'qituvchi, jadval) */
  @Patch(':id')
  @Roles('admin', 'super_admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groups.update(user, id, dto);
  }

  /** Guruhga o'quvchi qo'shish */
  @Post(':id/students')
  @Roles('admin', 'super_admin')
  addStudent(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddStudentDto) {
    return this.groups.addStudent(user, id, dto);
  }

  /** Guruhdan o'quvchini chiqarish */
  @Delete(':id/students/:studentId')
  @Roles('admin', 'super_admin')
  removeStudent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    return this.groups.removeStudent(user, id, studentId);
  }
}
