-- Gapped document authoring. All columns are nullable for legacy exams.
ALTER TABLE "MockQuestionGroup"
ADD COLUMN "contentHtml" TEXT,
ADD COLUMN "audioScript" TEXT,
ADD COLUMN "contentLayout" TEXT;
