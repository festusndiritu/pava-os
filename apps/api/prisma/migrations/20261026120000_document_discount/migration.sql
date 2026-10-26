-- Total discount agreed on the whole bill, on top of any per-line price negotiation.
ALTER TABLE "Document" ADD COLUMN "discount" INTEGER NOT NULL DEFAULT 0;
