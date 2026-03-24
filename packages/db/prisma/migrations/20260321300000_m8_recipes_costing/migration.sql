-- M8: Recipes + Ingredient Costing (COGS Foundation)
-- Adds InventoryItem and RecipeIngredient models

-- InventoryItem: master inventory/ingredient item, branch-scoped
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "theoretical_unit_cost" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- RecipeIngredient: links a menu item to an inventory item with quantity/waste
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "menu_item_serving_id" TEXT,
    "modifier_option_id" TEXT,
    "qty_per_unit" DECIMAL(10,3) NOT NULL,
    "waste_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one inventory item name per branch
CREATE UNIQUE INDEX "inventory_items_branch_id_name_key" ON "inventory_items"("branch_id", "name");

-- Indexes for InventoryItem
CREATE INDEX "inventory_items_org_id_idx" ON "inventory_items"("org_id");
CREATE INDEX "inventory_items_branch_id_idx" ON "inventory_items"("branch_id");

-- Indexes for RecipeIngredient
CREATE INDEX "recipe_ingredients_org_id_idx" ON "recipe_ingredients"("org_id");
CREATE INDEX "recipe_ingredients_branch_id_idx" ON "recipe_ingredients"("branch_id");
CREATE INDEX "recipe_ingredients_menu_item_id_idx" ON "recipe_ingredients"("menu_item_id");
CREATE INDEX "recipe_ingredients_inventory_item_id_idx" ON "recipe_ingredients"("inventory_item_id");
CREATE INDEX "recipe_ingredients_menu_item_serving_id_idx" ON "recipe_ingredients"("menu_item_serving_id");
CREATE INDEX "recipe_ingredients_modifier_option_id_idx" ON "recipe_ingredients"("modifier_option_id");

-- Foreign keys for InventoryItem
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for RecipeIngredient
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_menu_item_serving_id_fkey" FOREIGN KEY ("menu_item_serving_id") REFERENCES "menu_item_servings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_modifier_option_id_fkey" FOREIGN KEY ("modifier_option_id") REFERENCES "modifier_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
