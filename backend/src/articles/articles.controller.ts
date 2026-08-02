import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ArticlesService } from './articles.service';
import { CreateArticleDto, QueryArticlesDto, UpdateArticleDto } from './dto/articles.dto';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  /** Yangiliklar/maqolalar — rasmiy sayt uchun ochiq */
  @Public()
  @Get()
  list(@Query() q: QueryArticlesDto) {
    return this.articles.list(q);
  }

  /** Bitta maqola — ochiq */
  @Public()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.articles.getOne(id);
  }

  /** Maqola joylash */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArticleDto) {
    return this.articles.create(user, dto);
  }

  /** Maqolani tahrirlash */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.articles.update(user, id, dto);
  }

  /** Maqolani o'chirish */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.articles.remove(user, id);
  }
}
