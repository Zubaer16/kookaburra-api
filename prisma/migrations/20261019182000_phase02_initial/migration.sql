-- Kookaburra API Phase 02: PostgreSQL schema for isolated single-store installation.
-- Use a new empty DB or review schema diffs and take a backup first.
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN', 'OWNER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "auth_sessions_user_id_family_id_idx" ON "auth_sessions"("user_id", "family_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "target_type" VARCHAR(80) NOT NULL,
  "target_id" VARCHAR(128),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "categories" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "parent_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "products" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "title" VARCHAR(250) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "price_minor" INTEGER NOT NULL,
  "has_variants" BOOLEAN NOT NULL DEFAULT false,
  "stock_on_hand" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_price_nonnegative" CHECK ("price_minor" >= 0),
  CONSTRAINT "products_stock_nonnegative" CHECK ("stock_on_hand" >= 0),
  CONSTRAINT "products_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_status_idx" ON "products"("status");

CREATE TABLE "product_variants" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "sku" VARCHAR(120) NOT NULL,
  "options" JSONB NOT NULL DEFAULT '{}',
  "price_minor" INTEGER,
  "stock_on_hand" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "variants_price_nonnegative" CHECK ("price_minor" IS NULL OR "price_minor" >= 0),
  CONSTRAINT "variants_stock_nonnegative" CHECK ("stock_on_hand" >= 0)
);
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "product_categories" (
  "product_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_id", "category_id")
);
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL,
  "event_type" VARCHAR(150) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

CREATE TABLE "idempotency_records" (
  "id" UUID NOT NULL,
  "scope" VARCHAR(120) NOT NULL,
  "key" VARCHAR(200) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "response" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "idempotency_records_scope_key_key" ON "idempotency_records"("scope", "key");
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");
