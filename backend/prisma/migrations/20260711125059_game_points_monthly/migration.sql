-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'game';

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "gameQualified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pointsPeriod" TEXT,
ADD COLUMN     "qualifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MonthlyPointsArchive" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyPointsArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyPointsArchive_year_month_idx" ON "MonthlyPointsArchive"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPointsArchive_studentId_year_month_key" ON "MonthlyPointsArchive"("studentId", "year", "month");

-- AddForeignKey
ALTER TABLE "MonthlyPointsArchive" ADD CONSTRAINT "MonthlyPointsArchive_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
