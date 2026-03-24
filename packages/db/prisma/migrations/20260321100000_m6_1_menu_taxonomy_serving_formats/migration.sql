-- M6.1: POS Menu Taxonomy + Serving Formats
-- Adds MenuBrowseGroup, MenuBrowseSubgroup, MenuItemServing models
-- Adds MenuSection, ServingFormat enums
-- Adds browseGroupId, browseSubgroupId to MenuItem

-- CreateEnum MenuSection
CREATE TYPE "MenuSection" AS ENUM ('FOOD', 'DRINKS');

-- CreateEnum ServingFormat
CREATE TYPE "ServingFormat" AS ENUM ('GLASS', 'BOTTLE', 'JUG', 'PINT', 'HALF_PINT', 'SHOT', 'SINGLE', 'DOUBLE', 'CARAFE', 'FLIGHT', 'CUP', 'CUSTOM');

-- CreateTable MenuBrowseGroup
CREATE TABLE "menu_browse_groups" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "section" "MenuSection" NOT NULL,
    "name" TEXT NOT NULL,
    "internal_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_browse_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable MenuBrowseSubgroup
CREATE TABLE "menu_browse_subgroups" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internal_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_browse_subgroups_pkey" PRIMARY KEY ("id")
);

-- CreateTable MenuItemServing
CREATE TABLE "menu_item_servings" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "format" "ServingFormat" NOT NULL,
    "label" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "volume_text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_servings_pkey" PRIMARY KEY ("id")
);

-- Add browse columns to MenuItem
ALTER TABLE "menu_items" ADD COLUMN "browse_group_id" TEXT;
ALTER TABLE "menu_items" ADD COLUMN "browse_subgroup_id" TEXT;

-- Unique constraints
CREATE UNIQUE INDEX "menu_browse_groups_branch_id_name_key" ON "menu_browse_groups"("branch_id", "name");
CREATE UNIQUE INDEX "menu_browse_subgroups_group_id_name_key" ON "menu_browse_subgroups"("group_id", "name");
CREATE UNIQUE INDEX "menu_item_servings_menu_item_id_format_label_key" ON "menu_item_servings"("menu_item_id", "format", "label");

-- Indexes
CREATE INDEX "menu_browse_groups_org_id_idx" ON "menu_browse_groups"("org_id");
CREATE INDEX "menu_browse_groups_branch_id_idx" ON "menu_browse_groups"("branch_id");
CREATE INDEX "menu_browse_subgroups_group_id_idx" ON "menu_browse_subgroups"("group_id");
CREATE INDEX "menu_item_servings_menu_item_id_idx" ON "menu_item_servings"("menu_item_id");
CREATE INDEX "menu_items_browse_group_id_idx" ON "menu_items"("browse_group_id");
CREATE INDEX "menu_items_browse_subgroup_id_idx" ON "menu_items"("browse_subgroup_id");

-- Foreign keys
ALTER TABLE "menu_browse_groups" ADD CONSTRAINT "menu_browse_groups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_browse_groups" ADD CONSTRAINT "menu_browse_groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_browse_subgroups" ADD CONSTRAINT "menu_browse_subgroups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "menu_browse_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_item_servings" ADD CONSTRAINT "menu_item_servings_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_browse_group_id_fkey" FOREIGN KEY ("browse_group_id") REFERENCES "menu_browse_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_browse_subgroup_id_fkey" FOREIGN KEY ("browse_subgroup_id") REFERENCES "menu_browse_subgroups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
