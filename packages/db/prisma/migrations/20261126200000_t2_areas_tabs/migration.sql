-- T2 phase 2 (E3): areas, tabs, put away, joined tables, guest on a line, hand-over.
-- Additive only: new enums, new tables, nullable or defaulted columns, and a backfill that
-- puts every existing table into an area made from the floor plan that marks its zone today.
-- CreateEnum
CREATE TYPE "AreaKind" AS ENUM ('TABLES', 'TABS');

-- CreateEnum
CREATE TYPE "TableHandoverStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "guest" INTEGER;

-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "area_id" TEXT,
ADD COLUMN     "is_tab" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joined_to_table_id" TEXT,
ADD COLUMN     "put_away_at" TIMESTAMP(3),
ADD COLUMN     "tab_note" TEXT,
ADD COLUMN     "tab_number" INTEGER;

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AreaKind" NOT NULL DEFAULT 'TABLES',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "put_away_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_handovers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "table_ids" TEXT[],
    "status" "TableHandoverStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "areas_org_id_idx" ON "areas"("org_id");

-- CreateIndex
CREATE INDEX "areas_branch_id_idx" ON "areas"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "areas_branch_id_name_key" ON "areas"("branch_id", "name");

-- CreateIndex
CREATE INDEX "table_handovers_branch_id_to_user_id_status_idx" ON "table_handovers"("branch_id", "to_user_id", "status");

-- CreateIndex
CREATE INDEX "table_handovers_branch_id_from_user_id_status_idx" ON "table_handovers"("branch_id", "from_user_id", "status");

-- CreateIndex
CREATE INDEX "tables_area_id_idx" ON "tables"("area_id");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: one TABLES area per floor plan that has tables (named after the plan), and one
-- "Tables" area per branch for tables with no plan. Area ids are derived, so the migration
-- is repeatable on a copy. No table row is changed except its new area_id.
INSERT INTO "areas" ("id", "org_id", "branch_id", "name", "kind", "sort_order", "is_active", "created_at", "updated_at")
SELECT 'area_fp_' || fp."id", fp."org_id", fp."branch_id", fp."name", 'TABLES',
       ROW_NUMBER() OVER (PARTITION BY fp."branch_id" ORDER BY fp."created_at", fp."id") - 1,
       true, NOW(), NOW()
  FROM "floor_plans" fp
 WHERE EXISTS (SELECT 1 FROM "tables" t WHERE t."floor_plan_id" = fp."id")
ON CONFLICT ("branch_id", "name") DO NOTHING;

INSERT INTO "areas" ("id", "org_id", "branch_id", "name", "kind", "sort_order", "is_active", "created_at", "updated_at")
SELECT DISTINCT 'area_br_' || t."branch_id", t."org_id", t."branch_id", 'Tables', 'TABLES'::"AreaKind", 99, true, NOW(), NOW()
  FROM "tables" t
 WHERE t."floor_plan_id" IS NULL
ON CONFLICT ("branch_id", "name") DO NOTHING;

UPDATE "tables" t
   SET "area_id" = a."id"
  FROM "floor_plans" fp, "areas" a
 WHERE t."floor_plan_id" = fp."id" AND a."branch_id" = fp."branch_id" AND a."name" = fp."name"
   AND t."area_id" IS NULL;

UPDATE "tables" t
   SET "area_id" = a."id"
  FROM "areas" a
 WHERE t."floor_plan_id" IS NULL AND a."branch_id" = t."branch_id" AND a."name" = 'Tables'
   AND t."area_id" IS NULL;
