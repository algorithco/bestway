-- Import issue → editor navigation (additive, nullable, backfills nothing).
ALTER TABLE "MockImportReviewIssue" ADD COLUMN "entityKind" TEXT;
