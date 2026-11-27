-- Additive only: nothing existing is changed or removed.
ALTER TABLE "Document" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "offlineNumber" TEXT;

CREATE UNIQUE INDEX "Document_clientId_key" ON "Document"("clientId");
