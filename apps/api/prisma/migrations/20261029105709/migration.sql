/*
  Warnings:

  - The values [CARD] on the enum `PaymentMethod` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('CASH', 'MPESA', 'CREDIT', 'MIXED', 'STORE_CREDIT');
ALTER TABLE "Document" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TABLE "DocumentPayment" ALTER COLUMN "method" TYPE "PaymentMethod_new" USING ("method"::text::"PaymentMethod_new");
ALTER TABLE "Return" ALTER COLUMN "refundMethod" TYPE "PaymentMethod_new" USING ("refundMethod"::text::"PaymentMethod_new");
ALTER TABLE "Expense" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;
