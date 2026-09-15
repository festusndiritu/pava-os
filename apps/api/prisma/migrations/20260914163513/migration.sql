/*
  Warnings:

  - You are about to drop the column `altPhone` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `company` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceNumber` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `quoteNumber` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `receiptNumber` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the `BusinessSetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Lead` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_convertedCustomerId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_createdById_fkey";

-- DropIndex
DROP INDEX "Document_invoiceNumber_key";

-- DropIndex
DROP INDEX "Document_quoteNumber_key";

-- DropIndex
DROP INDEX "Document_receiptNumber_key";

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "altPhone",
DROP COLUMN "company",
DROP COLUMN "role",
DROP COLUMN "tags",
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "invoiceNumber",
DROP COLUMN "quoteNumber",
DROP COLUMN "receiptNumber";

-- DropTable
DROP TABLE "BusinessSetting";

-- DropTable
DROP TABLE "Lead";

-- DropEnum
DROP TYPE "LeadStage";
