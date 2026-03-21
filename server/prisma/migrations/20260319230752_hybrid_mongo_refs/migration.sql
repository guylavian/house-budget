-- Drop foreign key constraints first
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_categoryId_fkey";
ALTER TABLE "Salary" DROP CONSTRAINT IF EXISTS "Salary_memberId_fkey";
ALTER TABLE "SavingsDeposit" DROP CONSTRAINT IF EXISTS "SavingsDeposit_goalId_fkey";

-- Change Expense.categoryId from Int to String
ALTER TABLE "Expense" ALTER COLUMN "categoryId" TYPE TEXT USING "categoryId"::TEXT;

-- Change Salary.memberId from Int to String
ALTER TABLE "Salary" ALTER COLUMN "memberId" TYPE TEXT USING "memberId"::TEXT;

-- Add unique constraint to Salary
ALTER TABLE "Salary" ADD CONSTRAINT "Salary_memberId_month_year_type_key" UNIQUE ("memberId", "month", "year", "type");

-- Drop HouseExpense duplicate rows before adding unique constraint
DELETE FROM "HouseExpense" a USING "HouseExpense" b
WHERE a.id < b.id AND a."type" = b."type" AND a."month" = b."month" AND a."year" = b."year";

-- Add unique constraint to HouseExpense
ALTER TABLE "HouseExpense" ADD CONSTRAINT "HouseExpense_type_month_year_key" UNIQUE ("type", "month", "year");

-- Change SavingsDeposit.goalId from Int to String
ALTER TABLE "SavingsDeposit" ALTER COLUMN "goalId" TYPE TEXT USING "goalId"::TEXT;

-- Create BankTransaction table
CREATE TABLE "BankTransaction" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "chargedAmount" DECIMAL(12,2) NOT NULL,
    "originalAmount" DECIMAL(12,2),
    "type" TEXT NOT NULL,
    "categoryId" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'manual',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "importBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- Create ImportBatch table
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "rowsTotal" INTEGER NOT NULL,
    "rowsImported" INTEGER NOT NULL,
    "rowsSkipped" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- Create unique index on BankTransaction
CREATE UNIQUE INDEX "BankTransaction_source_date_description_chargedAmount_key" ON "BankTransaction"("source", "date", "description", "chargedAmount");

-- Drop old tables
DROP TABLE IF EXISTS "ExpenseCategory" CASCADE;
DROP TABLE IF EXISTS "HouseholdMember" CASCADE;
DROP TABLE IF EXISTS "SavingsGoal" CASCADE;
