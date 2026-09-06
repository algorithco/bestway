-- IELTS full-test flow (v2026.1): L→R→W sequential, server clock, once-only audio
-- practice = lenient, exam full_test = strict. Warn-only proctoring.

-- MockQuestionGroup: Listening parts + dynamic audio duration
ALTER TABLE "MockQuestionGroup" ADD COLUMN "partNumber" INTEGER;
ALTER TABLE "MockQuestionGroup" ADD COLUMN "audioPlayLimit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MockQuestionGroup" ADD COLUMN "audioDurationSec" INTEGER;

-- MockQuestion: Br/Am accepted variants (wordLimit already exists, now enforced in service)
ALTER TABLE "MockQuestion" ADD COLUMN "acceptedVariants" JSONB;

-- MockAttempt: full-test orchestration (null = legacy single_skill behavior)
ALTER TABLE "MockAttempt" ADD COLUMN "flowMode" TEXT;
ALTER TABLE "MockAttempt" ADD COLUMN "currentSkill" "MockSkill";
ALTER TABLE "MockAttempt" ADD COLUMN "sectionDeadlines" JSONB;
ALTER TABLE "MockAttempt" ADD COLUMN "overallDeadlineAt" TIMESTAMP(3);
ALTER TABLE "MockAttempt" ADD COLUMN "audioPlays" JSONB;
ALTER TABLE "MockAttempt" ADD COLUMN "submittedSections" JSONB;

-- MockAnswer: human-grader rubrics (Writing TA/CC/LR/GRA, Speaking fluency/lexical/grammar/pronun)
ALTER TABLE "MockAnswer" ADD COLUMN "rubricScores" JSONB;
