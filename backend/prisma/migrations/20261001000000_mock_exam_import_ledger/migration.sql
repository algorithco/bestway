-- AI JSON test import ledger (additive; existing exams untouched).
ALTER TABLE "MockExam"
ADD COLUMN "profile" TEXT NOT NULL DEFAULT 'practice',
ADD COLUMN "blueprintRef" TEXT,
ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "MockExamImport" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
  "profile" TEXT NOT NULL DEFAULT 'practice',
  "rawChecksum" TEXT NOT NULL,
  "normalizedChecksum" TEXT NOT NULL,
  "validatedChecksum" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MockExamImport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MockExamImport_createdById_packageId_revision_key"
  ON "MockExamImport"("createdById", "packageId", "revision");
CREATE INDEX "MockExamImport_examId_idx" ON "MockExamImport"("examId");
ALTER TABLE "MockExamImport"
ADD CONSTRAINT "MockExamImport_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MockImportSourceMap" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  CONSTRAINT "MockImportSourceMap_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MockImportSourceMap_importId_kind_sourceKey_key"
  ON "MockImportSourceMap"("importId", "kind", "sourceKey");
CREATE INDEX "MockImportSourceMap_importId_idx" ON "MockImportSourceMap"("importId");
ALTER TABLE "MockImportSourceMap"
ADD CONSTRAINT "MockImportSourceMap_importId_fkey"
  FOREIGN KEY ("importId") REFERENCES "MockExamImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MockImportReviewIssue" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "sourceKey" TEXT,
  "code" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MockImportReviewIssue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MockImportReviewIssue_importId_status_idx"
  ON "MockImportReviewIssue"("importId", "status");
ALTER TABLE "MockImportReviewIssue"
ADD CONSTRAINT "MockImportReviewIssue_importId_fkey"
  FOREIGN KEY ("importId") REFERENCES "MockExamImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MockStagedMedia" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "claimedImportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MockStagedMedia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MockStagedMedia_storageKey_key" ON "MockStagedMedia"("storageKey");
CREATE INDEX "MockStagedMedia_ownerId_idx" ON "MockStagedMedia"("ownerId");
CREATE INDEX "MockStagedMedia_expiresAt_idx" ON "MockStagedMedia"("expiresAt");
