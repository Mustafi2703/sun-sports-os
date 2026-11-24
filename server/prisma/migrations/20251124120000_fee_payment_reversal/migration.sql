-- Additive only. Existing FeePayment rows stay as recorded receipts.
-- Every new column is nullable and has no default, so current rows are not rewritten.
ALTER TABLE "FeePayment"
  ADD COLUMN "reversedAt" TIMESTAMP(3),
  ADD COLUMN "reversalReason" TEXT,
  ADD COLUMN "reversedByUserId" TEXT,
  ADD COLUMN "reversedByName" TEXT,
  ADD COLUMN "reversedByRole" TEXT,
  ADD COLUMN "voidedInstallmentId" TEXT;
