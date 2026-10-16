-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO', 'SCALE', 'RATING');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('COMPLETED', 'PARTIAL');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "passwordHash" VARCHAR(200) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "ipHash" VARCHAR(64),
    "successful" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "slug" VARCHAR(80) NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "welcomeMessage" VARCHAR(600),
    "thankYouMessage" VARCHAR(600),
    "ownerId" UUID NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_versions" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" VARCHAR(1000),
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
    "formVersionId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'COMPLETED',
    "durationSeconds" INTEGER,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "questionId" UUID,
    "questionKey" VARCHAR(40) NOT NULL,
    "answerText" TEXT,
    "answerJson" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "login_attempts_email_createdAt_idx" ON "login_attempts"("email", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_ipHash_createdAt_idx" ON "login_attempts"("ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "forms_slug_key" ON "forms"("slug");

-- CreateIndex
CREATE INDEX "forms_ownerId_updatedAt_idx" ON "forms"("ownerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "forms_status_idx" ON "forms"("status");

-- CreateIndex
CREATE INDEX "form_versions_formId_createdAt_idx" ON "form_versions"("formId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_formId_versionNumber_key" ON "form_versions"("formId", "versionNumber");

-- CreateIndex
CREATE INDEX "questions_formId_position_idx" ON "questions"("formId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "questions_formId_key_key" ON "questions"("formId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "questions_formId_position_key" ON "questions"("formId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_idempotencyKey_key" ON "submissions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "submissions_formId_submittedAt_idx" ON "submissions"("formId", "submittedAt" DESC);

-- CreateIndex
CREATE INDEX "submissions_formVersionId_idx" ON "submissions"("formVersionId");

-- CreateIndex
CREATE INDEX "answers_questionKey_idx" ON "answers"("questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "answers_submissionId_questionKey_key" ON "answers"("submissionId", "questionKey");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
