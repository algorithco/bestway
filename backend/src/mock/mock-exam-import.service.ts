import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeMockContent } from './mock-content';
import { canonicalChecksum, validateImportPackage, type ImportReport } from './mock-import-validate';

type Pkg = Record<string, any>;

function isStaff(user: AuthUser): boolean {
  return user.role === 'teacher' || user.role === 'admin' || user.role === 'super_admin';
}

function assertStaff(user: AuthUser): void {
  if (!isStaff(user)) {
    throw new AppException('MOCK_FORBIDDEN', 'Bu amal faqat xodimlar uchun', 403);
  }
}

const SKILL_ORDER = ['listening', 'reading', 'writing', 'speaking'];
const STAGED_TTL_MS = 24 * 60 * 60 * 1000;

export interface CommitResult {
  examId: string;
  importId: string;
  revision: number;
  replay: boolean;
  editorUrl: string;
}

@Injectable()
export class MockExamImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Dry-run: normalize + report, hech narsa persist qilinmaydi. */
  async validateDryRun(
    actor: AuthUser,
    pkg: unknown,
    mediaBindings: Record<string, string> = {},
    rawText?: string,
  ): Promise<ImportReport> {
    assertStaff(actor);
    return validateImportPackage(pkg, { mediaBindings, rawText });
  }

  /** Staged upload metadata — controller multer orqali faylni diskka yozadi. */
  async stageMedia(actor: AuthUser, file: Express.Multer.File) {
    assertStaff(actor);
    if (!file) throw new AppException('NO_FILE', 'Fayl yuklanmadi', 400);
    const kind = file.mimetype.startsWith('audio/') ? 'audio' : file.mimetype.startsWith('image/') ? 'image' : null;
    if (!kind) throw new AppException('INVALID_FILE_TYPE', 'Audio yoki rasm yuklang', 400);
    const checksum = createHash('sha256').update(`${file.filename}:${file.size}`).digest('hex');
    const staged = await this.prisma.mockStagedMedia.create({
      data: {
        ownerId: actor.id,
        storageKey: `mock/${file.filename}`,
        fileName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksum,
        kind,
        expiresAt: new Date(Date.now() + STAGED_TTL_MS),
      },
    });
    return {
      uploadId: staged.id,
      fileName: staged.fileName,
      mimeType: staged.mimeType,
      sizeBytes: staged.sizeBytes,
      kind: staged.kind,
      expiresAt: staged.expiresAt,
    };
  }

  /**
   * Butun exam draftini bitta tranzaksiyada yaratadi. Hech qachon publish qilmaydi.
   * (createdById, packageId, revision) bo'yicha idempotent: bir xil paket replay,
   * o'zgargan content 409.
   */
  async commitImport(
    actor: AuthUser,
    pkg: unknown,
    mediaBindings: Record<string, string> = {},
    validatedChecksum?: string,
    rawText?: string,
  ): Promise<CommitResult> {
    assertStaff(actor);
    const report = validateImportPackage(pkg, { mediaBindings, rawText });
    if (!report.canImport) {
      const first = report.issues.find((i) => i.blocks.includes('import'));
      throw new AppException(
        'MOCK_IMPORT_INVALID',
        `Import validation failed: ${first?.code} ${first?.path}${report.totalIssues > 1 ? ` (+${report.totalIssues - 1})` : ''}`,
        422,
      );
    }
    if (!validatedChecksum || validatedChecksum !== report.checksum) {
      throw new AppException(
        'MOCK_IMPORT_STALE',
        'Validated checksum mismatch — run validate again before import',
        422,
      );
    }
    const p = pkg as Pkg;
    const packageId: string = p.packageId;
    const revision: number = p.revision;

    const existing = await this.prisma.mockExamImport.findUnique({
      where: { createdById_packageId_revision: { createdById: actor.id, packageId, revision } },
    });
    if (existing) return this.replayOrConflict(existing, report.checksum, revision);

    // Staged binding ownership/expiry/kind — tranzaksiyadan oldin tekshiriladi.
    const stagedByKey = await this.resolveBindings(actor, p, mediaBindings);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const exam = await (tx as any).mockExam.create({
          data: {
            type: p.exam.type,
            title: (p.exam.title as string).slice(0, 200),
            description: p.exam.description ?? null,
            level: p.exam.level ?? null,
            isDemo: p.exam.isDemo ?? false,
            isPublished: false, // JSON hech qachon avtomatik publish qilmaydi
            price: p.exam.price ?? 0,
            isFreeForApproved: p.exam.isFreeForApproved ?? false,
            createdById: actor.id, // ownership sessiyadan
            profile: p.profile ?? 'practice',
            contentVersion: 1,
          },
        });
        const sourceMaps: Array<{ kind: string; sourceKey: string; entityId: string }> = [];
        const sections: any[] = p.exam.sections;
        sections.forEach((s: any, si: number) => {
          void si;
        });
        let sectionOrder = 0;
        for (const s of sections) {
          const section = await (tx as any).mockSection.create({
            data: {
              examId: exam.id,
              skill: s.skill,
              title: s.title ?? null,
              sortOrder: SKILL_ORDER.indexOf(s.skill) >= 0 ? SKILL_ORDER.indexOf(s.skill) : sectionOrder,
              durationMinutes: s.durationMinutes ?? null,
              instructions: s.instructions ?? null,
            },
          });
          sourceMaps.push({ kind: 'section', sourceKey: s.key, entityId: section.id });
          sectionOrder++;
          let groupOrder = 0;
          for (const g of s.groups as any[]) {
            const audioStaged = typeof g.audioRef === 'string' ? stagedByKey.get(g.audioRef) : null;
            const imageStaged = typeof g.imageRef === 'string' ? stagedByKey.get(g.imageRef) : null;
            const group = await (tx as any).mockQuestionGroup.create({
              data: {
                sectionId: section.id,
                sortOrder: groupOrder++,
                title: g.title ?? null,
                instructions: g.instructions ?? null,
                passageText: g.passageText || null,
                contentHtml: sanitizeMockContent(g.contentHtml),
                audioScript: sanitizeMockContent(g.audioScript),
                contentLayout: g.contentLayout ?? null,
                partNumber: s.skill === 'listening' ? (g.partNumber ?? null) : null,
                audioPlayLimit: g.audioPlayLimit ?? 1,
                audioDurationSec: null, // server o'lchovi keyin; staged metadata da duration yo'q
                ...(audioStaged ? { audioKey: (audioStaged as any).storageKey } : {}),
                ...(imageStaged ? { imageKey: (imageStaged as any).storageKey } : {}),
              },
            });
            sourceMaps.push({ kind: 'group', sourceKey: g.key, entityId: group.id });
            let qOrder = 0;
            for (const q of g.questions as any[]) {
              const created = await (tx as any).mockQuestion.create({
                data: {
                  groupId: group.id,
                  number: q.number,
                  sortOrder: qOrder++,
                  type: q.type,
                  prompt: (q.prompt as string).trim(),
                  options: (q.options ?? []) as Prisma.InputJsonValue,
                  correctAnswers: (q.correctAnswers ?? []) as Prisma.InputJsonValue,
                  acceptedVariants: (q.acceptedVariants ?? []) as Prisma.InputJsonValue,
                  points: q.points ?? 1,
                  wordLimit: q.wordLimit ?? null,
                },
              });
              sourceMaps.push({ kind: 'question', sourceKey: q.key, entityId: created.id });
            }
          }
        }
        const importRow = await (tx as any).mockExamImport.create({
          data: {
            createdById: actor.id,
            packageId,
            revision,
            schemaVersion: '1.0',
            profile: p.profile ?? 'practice',
            rawChecksum: report.checksum,
            normalizedChecksum: report.checksum,
            validatedChecksum,
            examId: exam.id,
          },
        });
        if (sourceMaps.length) {
          await (tx as any).mockImportSourceMap.createMany({
            data: sourceMaps.map((m) => ({ ...m, importId: importRow.id })),
          });
        }
        const reviewIssues: any[] = Array.isArray(p.reviewIssues) ? p.reviewIssues : [];
        if (reviewIssues.length) {
          await (tx as any).mockImportReviewIssue.createMany({
            data: reviewIssues.map((r: any) => ({
              importId: importRow.id,
              sourceKey: null,
              code: r.code,
              path: r.path,
              message: r.message,
              status: 'open',
            })),
          });
        }
        if (stagedByKey.size) {
          const ids = [...stagedByKey.values()].map((s: any) => s.id);
          await (tx as any).mockStagedMedia.updateMany({
            where: { id: { in: ids } },
            data: { claimedAt: new Date(), claimedImportId: importRow.id },
          });
        }
        return { examId: exam.id, importId: importRow.id };
      });
      await this.audit.log({
        userId: actor.id,
        action: 'mock.exam.import',
        entity: 'mockExam',
        entityId: result.examId,
        newValue: { packageId, revision, checksum: report.checksum },
      });
      return { examId: result.examId, importId: result.importId, revision, replay: false, editorUrl: `/exam-builder/${result.examId}` };
    } catch (e) {
      // Concurrent retry: unique buzilishi → replay yoki 409 (preflight poygasi).
      if (typeof e === 'object' && e !== null && (e as any).code === 'P2002') {
        const raced = await this.prisma.mockExamImport.findUnique({
          where: { createdById_packageId_revision: { createdById: actor.id, packageId, revision } },
        });
        if (raced) return this.replayOrConflict(raced, report.checksum, revision);
      }
      throw e;
    }
  }

  /** Yo'qolgan javobdan keyin holatni tiklash — egasi yoki admin ko'radi. */
  async getByPackage(actor: AuthUser, packageId: string, revision: number) {
    assertStaff(actor);
    const row = await this.prisma.mockExamImport.findUnique({
      where: { createdById_packageId_revision: { createdById: actor.id, packageId, revision } },
    });
    if (!row) {
      // Admin boshqa teacher importini ko'ra oladi (explicit authorized lookup).
      if (actor.role === 'admin' || actor.role === 'super_admin') {
        const anyRow = await this.prisma.mockExamImport.findFirst({ where: { packageId, revision } });
        if (!anyRow) throw new AppException('MOCK_IMPORT_NOT_FOUND', 'Import topilmadi', 404);
        return this.shapeStatus(anyRow, true);
      }
      throw new AppException('MOCK_IMPORT_NOT_FOUND', 'Import topilmadi', 404);
    }
    return this.shapeStatus(row, true);
  }

  private shapeStatus(row: { id: string; examId: string; revision: number }, replay: boolean) {
    return { importId: row.id, examId: row.examId, revision: row.revision, replay, editorUrl: `/exam-builder/${row.examId}` };
  }

  private replayOrConflict(
    existing: { id: string; examId: string; revision: number; normalizedChecksum: string },
    checksum: string,
    revision: number,
  ): CommitResult {
    if (existing.normalizedChecksum !== checksum) {
      throw new AppException(
        'MOCK_IMPORT_CONFLICT',
        'Same revision with changed content — increment revision for a new draft',
        409,
      );
    }
    // Identical replay: teacher tahririga tegilmaydi, asl imtihon qaytariladi.
    return { examId: existing.examId, importId: existing.id, revision, replay: true, editorUrl: `/exam-builder/${existing.examId}` };
  }

  /** Binding → staged row; egalik, muddat va kind tekshiruvi. */
  private async resolveBindings(actor: AuthUser, p: Pkg, mediaBindings: Record<string, string>) {
    const declKind = new Map<string, string>();
    for (const m of (p.media as any[]) ?? []) declKind.set(m.key, m.kind);
    for (const key of Object.keys(mediaBindings)) {
      if (!declKind.has(key)) {
        throw new AppException('MOCK_IMPORT_BINDING', `Unknown media key "${key}"`, 422);
      }
    }
    const out = new Map<string, any>();
    const ids = [...new Set(Object.values(mediaBindings))];
    if (!ids.length) return out;
    const rows = await this.prisma.mockStagedMedia.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    for (const [sourceKey, uploadId] of Object.entries(mediaBindings)) {
      const row: any = byId.get(uploadId);
      if (!row) throw new AppException('MOCK_IMPORT_MEDIA', `Staged upload not found for "${sourceKey}"`, 422);
      if (row.ownerId !== actor.id) {
        throw new AppException('MOCK_IMPORT_MEDIA', `Staged upload for "${sourceKey}" belongs to another user`, 403);
      }
      if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
        throw new AppException('MOCK_IMPORT_MEDIA', `Staged upload for "${sourceKey}" has expired`, 410);
      }
      if (row.kind !== declKind.get(sourceKey)) {
        throw new AppException('MOCK_IMPORT_MEDIA', `Media kind mismatch for "${sourceKey}"`, 422);
      }
      out.set(sourceKey, row);
    }
    return out;
  }
}
