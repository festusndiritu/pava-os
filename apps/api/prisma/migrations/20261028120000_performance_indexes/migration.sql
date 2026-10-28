-- Document lists filter by type + status and sort by date; the dashboard filters by status + paidAt.
CREATE INDEX "Document_type_status_createdAt_idx" ON "Document"("type", "status", "createdAt");
CREATE INDEX "Document_customerId_idx" ON "Document"("customerId");
CREATE INDEX "Document_status_paidAt_idx" ON "Document"("status", "paidAt");
CREATE INDEX "Document_sourceDocumentId_idx" ON "Document"("sourceDocumentId");

-- Top-products, product history and "has this product been sold" checks look items up by product.
CREATE INDEX "DocumentItem_productId_idx" ON "DocumentItem"("productId");
