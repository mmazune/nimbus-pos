-- M6: Menu Catalog — Categories, Tax Categories, Menu Items

-- Enums
CREATE TYPE "MenuItemType" AS ENUM ('FOOD', 'DRINK');
CREATE TYPE "PrepStation" AS ENUM ('KITCHEN', 'BAR', 'COLD_KITCHEN', 'DESSERT', 'NONE');

-- Categories
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Tax Categories
CREATE TABLE "tax_categories" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "efirs_tax_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_categories_pkey" PRIMARY KEY ("id")
);

-- Menu Items
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "tax_category_id" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "item_type" "MenuItemType" NOT NULL,
    "station" "PrepStation" NOT NULL DEFAULT 'NONE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "categories_branch_id_name_key" ON "categories"("branch_id", "name");
CREATE UNIQUE INDEX "tax_categories_branch_id_name_key" ON "tax_categories"("branch_id", "name");
CREATE UNIQUE INDEX "menu_items_category_id_name_key" ON "menu_items"("category_id", "name");

-- Indexes: categories
CREATE INDEX "categories_org_id_idx" ON "categories"("org_id");
CREATE INDEX "categories_branch_id_idx" ON "categories"("branch_id");

-- Indexes: tax_categories
CREATE INDEX "tax_categories_org_id_idx" ON "tax_categories"("org_id");
CREATE INDEX "tax_categories_branch_id_idx" ON "tax_categories"("branch_id");

-- Indexes: menu_items
CREATE INDEX "menu_items_org_id_idx" ON "menu_items"("org_id");
CREATE INDEX "menu_items_branch_id_idx" ON "menu_items"("branch_id");
CREATE INDEX "menu_items_category_id_idx" ON "menu_items"("category_id");
CREATE INDEX "menu_items_tax_category_id_idx" ON "menu_items"("tax_category_id");

-- Foreign keys: categories
ALTER TABLE "categories" ADD CONSTRAINT "categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: tax_categories
ALTER TABLE "tax_categories" ADD CONSTRAINT "tax_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_categories" ADD CONSTRAINT "tax_categories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: menu_items
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tax_category_id_fkey" FOREIGN KEY ("tax_category_id") REFERENCES "tax_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
