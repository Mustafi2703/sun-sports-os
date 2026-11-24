-- Reverse one fee receipt by id, inside a transaction.
-- Prefer server/scripts/reverse-one-payment.ts. It calls the same code as the API.
-- Use this file when you need SQL instead.
--
-- Run only after migration 20251124120000_fee_payment_reversal is applied.
-- Do not add the columns by hand. If they are missing, this script stops.
-- Take a backup first.
--
-- 1. Find the receipt (read only):
--
--    SELECT p.id, s.name, p.amount, p.month, p.method, p."paidAt", p.note, p."installmentId"
--    FROM "FeePayment" p
--    JOIN "Student" s ON s.id = p."studentId"
--    WHERE p."reversedAt" IS NULL
--    ORDER BY p."paidAt" DESC;
--
-- 2. Edit the three placeholders below: payment id, reason, and confirm := 'yes'.
-- 3. Run this file in one session. It updates that payment id only.
--    It reopens that payment's installment, and refreshes that student's dues.
--    It does not update AttendanceRecord. If the attendance count changes, it rolls back.

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  target_id text := 'REPLACE_WITH_PAYMENT_ID';
  reason text := 'REPLACE_WITH_REASON';
  confirm text := 'no';
  n int;
  stu_id text;
  inst_id text;
  enr_id text;
  inst_status text;
  due date;
  days int;
  new_status text;
  next_amount int;
  next_days int;
  att_before int;
  att_after int;
  has_column boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'FeePayment'
      AND column_name = 'reversedAt'
  ) INTO has_column;

  IF NOT has_column THEN
    RAISE EXCEPTION 'Column FeePayment.reversedAt is missing. Apply migration 20251124120000_fee_payment_reversal first. Do not add the column by hand.';
  END IF;

  IF target_id = '' OR reason = '' OR target_id LIKE 'REPLACE_WITH_%' OR reason LIKE 'REPLACE_WITH_%' THEN
    RAISE EXCEPTION 'Replace the payment id and the reason. Nothing was saved.';
  END IF;

  IF length(btrim(reason)) < 3 THEN
    RAISE EXCEPTION 'Reason must be at least 3 characters. Nothing was saved.';
  END IF;

  IF confirm IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Set confirm := ''yes'' after you have checked the payment id. Nothing was saved.';
  END IF;

  SELECT count(*) INTO att_before FROM "AttendanceRecord";

  SELECT "studentId", "installmentId"
  INTO stu_id, inst_id
  FROM "FeePayment"
  WHERE id = target_id AND "reversedAt" IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % was not found, or it is already reversed. Nothing else was changed.', target_id;
  END IF;

  UPDATE "FeePayment"
  SET
    "reversedAt" = NOW(),
    "reversalReason" = btrim(reason),
    "reversedByUserId" = NULL,
    "reversedByName" = 'manual sql',
    "reversedByRole" = 'script',
    "voidedInstallmentId" = "installmentId",
    "installmentId" = NULL
  WHERE id = target_id AND "reversedAt" IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Expected to update 1 payment, updated %. Rolled back.', n;
  END IF;

  IF inst_id IS NOT NULL THEN
    SELECT "enrollmentId", status, "dueDate"::date
    INTO enr_id, inst_status, due
    FROM "FeeInstallment"
    WHERE id = inst_id
    FOR UPDATE;

    IF inst_status = 'paid' THEN
      days := GREATEST(0, (CURRENT_DATE - due));
      new_status := CASE WHEN days > 0 THEN 'overdue' ELSE 'pending' END;
      UPDATE "FeeInstallment"
      SET status = new_status,
          "daysOverdue" = days,
          "paidAt" = NULL,
          "updatedAt" = NOW()
      WHERE id = inst_id AND status = 'paid';

      -- A one-month "Recorded receipt" exists only because Mark received had no plan.
      -- Cancel it so package totals go back. A real plan is reopened instead.
      IF (
        SELECT e."packageName" = 'Recorded receipt'
          AND e.months = 1
          AND (SELECT count(*) FROM "FeeInstallment" i WHERE i."enrollmentId" = e.id) = 1
        FROM "FeeEnrollment" e
        WHERE e.id = enr_id
      ) THEN
        UPDATE "FeeEnrollment"
        SET status = 'cancelled', "updatedAt" = NOW()
        WHERE id = enr_id;
      ELSE
        UPDATE "FeeEnrollment"
        SET status = 'active', "updatedAt" = NOW()
        WHERE id = enr_id AND status = 'completed';
      END IF;
    END IF;
  END IF;

  UPDATE "FeeInstallment" i
  SET
    "daysOverdue" = GREATEST(0, (CURRENT_DATE - (i."dueDate"::date))),
    status = CASE
      WHEN (CURRENT_DATE - (i."dueDate"::date)) > 0 THEN 'overdue'
      ELSE 'pending'
    END,
    "updatedAt" = NOW()
  FROM "FeeEnrollment" e
  WHERE i."enrollmentId" = e.id
    AND e."studentId" = stu_id
    AND e.status IN ('active', 'completed')
    AND i.status IN ('pending', 'overdue');

  SELECT i.amount, i."daysOverdue"
  INTO next_amount, next_days
  FROM "FeeInstallment" i
  JOIN "FeeEnrollment" e ON e.id = i."enrollmentId"
  WHERE i."studentId" = stu_id
    AND i.status IN ('pending', 'overdue')
    AND e.status IN ('active', 'completed')
  ORDER BY i."dueDate" ASC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT amount INTO next_amount
    FROM "FeeInstallment"
    WHERE "studentId" = stu_id
    ORDER BY "dueDate" DESC
    LIMIT 1;

    UPDATE "Student"
    SET "feeStatus" = 'paid',
        "daysOverdue" = 0,
        "feeAmount" = COALESCE(next_amount, "feeAmount"),
        "updatedAt" = NOW()
    WHERE id = stu_id;
  ELSE
    UPDATE "Student"
    SET "feeStatus" = CASE WHEN next_days >= 8 THEN 'overdue8' ELSE 'overdue1' END,
        "feeAmount" = next_amount,
        "daysOverdue" = next_days,
        "updatedAt" = NOW()
    WHERE id = stu_id;
  END IF;

  UPDATE "FeeEnrollment" e
  SET status = 'completed', "updatedAt" = NOW()
  WHERE e."studentId" = stu_id
    AND e.status = 'active'
    AND EXISTS (SELECT 1 FROM "FeeInstallment" i WHERE i."enrollmentId" = e.id)
    AND NOT EXISTS (
      SELECT 1 FROM "FeeInstallment" i
      WHERE i."enrollmentId" = e.id AND i.status <> 'paid'
    );

  SELECT count(*) INTO att_after FROM "AttendanceRecord";
  IF att_before <> att_after THEN
    RAISE EXCEPTION 'Attendance row count changed from % to %. Rolled back. This script does not write attendance.', att_before, att_after;
  END IF;

  RAISE NOTICE 'Reversed payment % for student %. Attendance rows unchanged: %.', target_id, stu_id, att_after;
END $$;

COMMIT;
