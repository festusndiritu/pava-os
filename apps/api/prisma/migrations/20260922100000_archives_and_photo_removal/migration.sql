-- Soft delete for Lead, matching Customer/Product/Contact's convention.
ALTER TABLE "Lead" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Lead_active_idx" ON "Lead"("active");

-- Soft delete for Contact, matching Customer/Product/Lead's convention.
ALTER TABLE "Contact" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Contact_active_idx" ON "Contact"("active");

-- Product photo upload has been removed (no upload path has ever written
-- a real URL other than through the now-deleted /products/:id/photo route,
-- and the POS UI deliberately uses category icons instead of photography),
-- so the column is dropped along with the feature.
ALTER TABLE "Product" DROP COLUMN "imageUrl";
