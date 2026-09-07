-- Exam-time reading aids: highlighted snippets + private note per answer row.
-- Additive nullable columns only; safe on existing data.
ALTER TABLE "Answer" ADD COLUMN "highlights" JSONB;
ALTER TABLE "Answer" ADD COLUMN "note" TEXT;
