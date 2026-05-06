-- Make expectedAmount NOT NULL on recurring_bill_profiles (table is empty)
ALTER TABLE "recurring_bill_profiles" ALTER COLUMN "expected_amount" SET NOT NULL;
