-- Additive only. New table for parent-login import audit.
-- Does not alter User, Student, attendance, fees, payments, packages, or batches.
-- Does not update or delete existing rows.
-- mustChangePin and pinChangedAt already exist on User from the baseline
-- (false and null). This migration does not rewrite them.

CREATE TABLE "ParentImportLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,

    CONSTRAINT "ParentImportLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParentImportLog_createdAt_idx" ON "ParentImportLog"("createdAt");
