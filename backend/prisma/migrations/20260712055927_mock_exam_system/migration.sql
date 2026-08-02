-- CreateEnum
CREATE TYPE "MockExamType" AS ENUM ('ielts_academic', 'ielts_general', 'multilevel');

-- CreateEnum
CREATE TYPE "MockSkill" AS ENUM ('listening', 'reading', 'writing', 'speaking');

-- CreateEnum
CREATE TYPE "MockQuestionType" AS ENUM ('multiple_choice', 'multi_select', 'true_false_notgiven', 'yes_no_notgiven', 'matching', 'matching_headings', 'sentence_completion', 'note_completion', 'summary_completion', 'table_completion', 'short_answer', 'map_labelling', 'essay_task1', 'essay_task2', 'speaking_task');

-- CreateEnum
CREATE TYPE "MockAttemptStatus" AS ENUM ('in_progress', 'grading', 'completed');

-- CreateTable
CREATE TABLE "MockExam" (
    "id" TEXT NOT NULL,
    "type" "MockExamType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockSection" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "skill" "MockSkill" NOT NULL,
    "title" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER,
    "instructions" TEXT,

    CONSTRAINT "MockSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockQuestionGroup" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "instructions" TEXT,
    "passageText" TEXT,
    "audioKey" TEXT,
    "imageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockQuestionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockQuestion" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "type" "MockQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswers" JSONB,
    "points" INTEGER NOT NULL DEFAULT 1,
    "wordLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockAttempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "MockAttemptStatus" NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "rawScores" JSONB,
    "sectionBands" JSONB,
    "overallBand" DOUBLE PRECISION,
    "cefrLevel" TEXT,
    "antiCheatCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MockAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT '',
    "isCorrect" BOOLEAN,
    "score" DOUBLE PRECISION,
    "isGraded" BOOLEAN NOT NULL DEFAULT false,
    "gradedById" TEXT,
    "feedback" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockCheatEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockCheatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockExam_type_idx" ON "MockExam"("type");

-- CreateIndex
CREATE INDEX "MockSection_examId_sortOrder_idx" ON "MockSection"("examId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MockSection_examId_skill_key" ON "MockSection"("examId", "skill");

-- CreateIndex
CREATE INDEX "MockQuestionGroup_sectionId_sortOrder_idx" ON "MockQuestionGroup"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "MockQuestion_groupId_sortOrder_idx" ON "MockQuestion"("groupId", "sortOrder");

-- CreateIndex
CREATE INDEX "MockAttempt_studentId_idx" ON "MockAttempt"("studentId");

-- CreateIndex
CREATE INDEX "MockAttempt_status_idx" ON "MockAttempt"("status");

-- CreateIndex
CREATE INDEX "MockAttempt_examId_idx" ON "MockAttempt"("examId");

-- CreateIndex
CREATE INDEX "MockAnswer_attemptId_idx" ON "MockAnswer"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "MockAnswer_attemptId_questionId_key" ON "MockAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "MockCheatEvent_attemptId_idx" ON "MockCheatEvent"("attemptId");

-- AddForeignKey
ALTER TABLE "MockSection" ADD CONSTRAINT "MockSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockQuestionGroup" ADD CONSTRAINT "MockQuestionGroup_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MockSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockQuestion" ADD CONSTRAINT "MockQuestion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MockQuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockAttempt" ADD CONSTRAINT "MockAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockAttempt" ADD CONSTRAINT "MockAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockAnswer" ADD CONSTRAINT "MockAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "MockAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockAnswer" ADD CONSTRAINT "MockAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "MockQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockCheatEvent" ADD CONSTRAINT "MockCheatEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "MockAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
