/*
  Warnings:

  - You are about to drop the column `attributes` on the `product_variants` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('select', 'color', 'number');

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "attributes",
ADD COLUMN     "attributeValues" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "weightGrams" INTEGER;

-- CreateTable
CREATE TABLE "category_attributes" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "unit" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_attributes_categoryId_idx" ON "category_attributes"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "category_attributes_categoryId_key_key" ON "category_attributes"("categoryId", "key");

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
