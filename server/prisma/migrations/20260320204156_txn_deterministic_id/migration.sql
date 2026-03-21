-- Step 1: Add new string id column (nullable for now)
ALTER TABLE "BankTransaction" ADD COLUMN "new_id" TEXT;

-- Step 2: Populate new_id with deterministic hash of each row
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "BankTransaction"
SET "new_id" = LEFT(
  ENCODE(
    DIGEST(
      LOWER(TRIM(source)) || '|' ||
      TO_CHAR(date AT TIME ZONE 'UTC', 'YYYY-MM-DD') || '|' ||
      LOWER(TRIM(REGEXP_REPLACE(description, '\s+', ' ', 'g'))) || '|' ||
      TO_CHAR(ABS("chargedAmount"), 'FM999999999990.00'),
      'sha256'
    ),
    'hex'
  ),
  40
);

-- Step 3: Handle any duplicates (same content, different old rows) — keep lowest id
DELETE FROM "BankTransaction" a
USING "BankTransaction" b
WHERE a."new_id" = b."new_id"
  AND a.id > b.id;

-- Step 4: Make new_id NOT NULL and promote to primary key
ALTER TABLE "BankTransaction" ALTER COLUMN "new_id" SET NOT NULL;
ALTER TABLE "BankTransaction" DROP CONSTRAINT "BankTransaction_pkey";
ALTER TABLE "BankTransaction" DROP COLUMN "id";
ALTER TABLE "BankTransaction" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "BankTransaction" ADD PRIMARY KEY ("id");

-- Step 5: Remove the old unique constraint (replaced by PK)
ALTER TABLE "BankTransaction"
  DROP CONSTRAINT IF EXISTS "BankTransaction_source_date_description_chargedAmount_key";
