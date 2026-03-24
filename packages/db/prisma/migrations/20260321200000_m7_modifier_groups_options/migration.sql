-- M7: Modifier Groups + Options + Item-to-Group assignment
-- Creates modifier_groups, modifier_options, menu_item_on_groups tables

-- ── modifier_groups ──
CREATE TABLE "modifier_groups" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min" INTEGER NOT NULL DEFAULT 0,
    "max" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- ── modifier_options ──
CREATE TABLE "modifier_options" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- ── menu_item_on_groups ──
CREATE TABLE "menu_item_on_groups" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_on_groups_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ──
CREATE INDEX "modifier_groups_org_id_idx" ON "modifier_groups"("org_id");
CREATE INDEX "modifier_groups_branch_id_idx" ON "modifier_groups"("branch_id");
CREATE INDEX "modifier_options_group_id_idx" ON "modifier_options"("group_id");
CREATE INDEX "menu_item_on_groups_item_id_idx" ON "menu_item_on_groups"("item_id");
CREATE INDEX "menu_item_on_groups_group_id_idx" ON "menu_item_on_groups"("group_id");

-- ── Unique constraints ──
CREATE UNIQUE INDEX "modifier_groups_branch_id_name_key" ON "modifier_groups"("branch_id", "name");
CREATE UNIQUE INDEX "modifier_options_group_id_name_key" ON "modifier_options"("group_id", "name");
CREATE UNIQUE INDEX "menu_item_on_groups_item_id_group_id_key" ON "menu_item_on_groups"("item_id", "group_id");

-- ── Foreign keys ──
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_item_on_groups" ADD CONSTRAINT "menu_item_on_groups_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_item_on_groups" ADD CONSTRAINT "menu_item_on_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
