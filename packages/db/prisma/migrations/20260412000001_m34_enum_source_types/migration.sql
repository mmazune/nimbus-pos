-- M34 Expanded AP step 2: add new VendorBillSourceType values and convert recurring_bill_profiles.source_type
-- These enum values were added in a separate migration so they're committed before use.

ALTER TYPE "VendorBillSourceType" ADD VALUE IF NOT EXISTS 'RECURRING';
ALTER TYPE "VendorBillSourceType" ADD VALUE IF NOT EXISTS 'ONE_OFF_EVENT';
ALTER TYPE "VendorBillSourceType" ADD VALUE IF NOT EXISTS 'UTILITY';
ALTER TYPE "VendorBillSourceType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION';
