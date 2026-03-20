-- CreateTable
CREATE TABLE "org_settings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "vat_percent" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "discount_approval_threshold" DECIMAL(10,2) NOT NULL DEFAULT 5000,
    "reservation_hold_minutes" INTEGER NOT NULL DEFAULT 30,
    "receipt_footer" TEXT,
    "metadata" JSONB,
    "anomaly_thresholds" JSONB,
    "platform_access" JSONB,
    "franchise_weights" JSONB,
    "show_cost_to_chef" BOOLEAN NOT NULL DEFAULT false,
    "defaults" JSONB,
    "base_currency_code" TEXT,
    "tax_matrix" JSONB,
    "rounding" JSONB,
    "booking_policies" JSONB,
    "attendance" JSONB,
    "inventory_tolerance" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "base_currency_code" TEXT NOT NULL,
    "quote_currency_code" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_settings_org_id_key" ON "org_settings"("org_id");

-- CreateIndex
CREATE INDEX "exchange_rates_org_id_idx" ON "exchange_rates"("org_id");

-- CreateIndex
CREATE INDEX "exchange_rates_org_id_base_currency_code_quote_currency_code_idx" ON "exchange_rates"("org_id", "base_currency_code", "quote_currency_code", "effective_at");

-- AddForeignKey
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
