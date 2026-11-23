ALTER TABLE "BusinessSetting" ADD COLUMN "leadTimeDays" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "BusinessSetting" ADD COLUMN "coverDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "BusinessSetting" ADD COLUMN "serviceLevel" INTEGER NOT NULL DEFAULT 95;

ALTER TABLE "Product" ADD COLUMN "leadTimeDays" INTEGER;
ALTER TABLE "ProductFamily" ADD COLUMN "leadTimeDays" INTEGER;

CREATE TABLE "ReorderAlert" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "firstAlertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReorderAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReorderAlert_entityType_entityId_key" ON "ReorderAlert"("entityType", "entityId");

CREATE TABLE "ReorderDigest" (
    "day" TEXT NOT NULL,

    CONSTRAINT "ReorderDigest_pkey" PRIMARY KEY ("day")
);
