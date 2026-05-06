-- M34 Expanded AP step 3: Convert recurring_bill_profiles.source_type from TEXT to VendorBillSourceType enum
-- The enum values have been committed in the previous migration.

ALTER TABLE "recurring_bill_profiles"
    ALTER COLUMN "source_type" DROP DEFAULT;

ALTER TABLE "recurring_bill_profiles"
    ALTER COLUMN "source_type" TYPE "VendorBillSourceType" USING "source_type"::"VendorBillSourceType";

ALTER TABLE "recurring_bill_profiles"
    ALTER COLUMN "source_type" SET DEFAULT 'RECURRING'::"VendorBillSourceType";
