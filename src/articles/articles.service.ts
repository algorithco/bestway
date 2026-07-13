import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { Paginated } from '../common/pagination';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto, QueryArticlesDto, UpdateArticleDto } from './dto/articles.dto';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: QueryArticlesDto) {
    const where: Prisma.ArticleWhereInput = {
      ...(q.category ? { category: q.category } : {}),
      ...(q.tag ? { tags: { has: q.tag } } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
    ]);
    return new Paginated(
      items.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        category: a.category,
        tags: a.tags,
        authorName: a.author?.name ?? null,
        createdAt: a.createdAt,
      })),
      { page: q.page, limit: q.limit, total },
    );
  }

  async getOne(id: string) {
    const a = await this.prisma.article.findUnique({
      where: { id },
      include: { author: { select: { name: true } } },
    });
    if (!a) throw new AppException('ARTICLE_NOT_FOUND', 'Maqola topilmadi', 404);
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      category: a.category,
      tags: a.tags,
      authorName: a.author?.name ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  async create(actor: AuthUser, dto: CreateArticleDto) {
    const article = await this.prisma.article.create({
      data: {
        title: dto.title,
        body: dto.body,
        category: dto.category,
        tags: dto.tags ?? [],
        authorId: actor.id,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'article.create',
      entity: 'article',
      entityId: article.id,
      newValue: { title: article.title, category: article.category },
    });
    return this.getOne(article.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateArticleDto) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new AppException('ARTICLE_NOT_FOUND', 'Maqola topilmadi', 404);
    await this.prisma.article.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'article.update',
      entity: 'article',
      entityId: id,
      oldValue: { title: article.title },
      newValue: { title: dto.title ?? article.title },
    });
    return this.getOne(id);
  }

  async remove(actor: AuthUser, id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new AppException('ARTICLE_NOT_FOUND', 'Maqola topilmadi', 404);
    await this.prisma.article.delete({ where: { id } });
    await this.audit.log({
      userId: actor.id,
      action: 'article.delete',
      entity: 'article',
      entityId: id,
      oldValue: { title: article.title },
    });
    return { deleted: true };
  }
}
