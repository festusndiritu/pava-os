-- How many days a quote's prices hold for, by default.
ALTER TABLE "BusinessSetting" ADD COLUMN "quoteValidityDays" INTEGER NOT NULL DEFAULT 10;

-- The last day a quote's prices hold. Null on quotes issued before this existed.
ALTER TABLE "Document" ADD COLUMN "validUntil" TIMESTAMP(3);

-- An earlier unpaid balance collected together with a sale (money received, not part of `total`).
ALTER TABLE "Document" ADD COLUMN "balanceCollected" INTEGER NOT NULL DEFAULT 0;

-- Part of a bill the customer left owing on their account when they paid less.
ALTER TABLE "Document" ADD COLUMN "balanceLeft" INTEGER NOT NULL DEFAULT 0;
