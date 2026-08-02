-- CreateEnum
CREATE TYPE "MockAttemptMode" AS ENUM ('practice', 'timed');

-- AlterTable
ALTER TABLE "MockAnswer" ADD COLUMN     "audioKey" TEXT;

-- AlterTable
ALTER TABLE "MockAttempt" ADD COLUMN     "annotations" JSONB,
ADD COLUMN     "deadlineAt" TIMESTAMP(3),
ADD COLUMN     "mode" "MockAttemptMode" NOT NULL DEFAULT 'practice';

-- AlterTable
ALTER TABLE "MockExam" ADD COLUMN     "isFreeForApproved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MockPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'pending_confirmation',
    "method" "PaymentMethod" NOT NULL DEFAULT 'manual',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockPurchase_status_idx" ON "MockPurchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MockPurchase_userId_examId_key" ON "MockPurchase"("userId", "examId");

-- AddForeignKey
ALTER TABLE "MockPurchase" ADD CONSTRAINT "MockPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockPurchase" ADD CONSTRAINT "MockPurchase_examId_fkey" FOREIGN KEY ("examId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
