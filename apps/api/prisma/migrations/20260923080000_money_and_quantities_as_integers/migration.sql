-- Money is always whole Kenyan shillings and every sold/received quantity
-- is a whole unit (no half-kilos, no half-lengths) — application-level
-- validation has enforced this since the previous migration, and this
-- makes the schema itself say so. Every existing value already satisfies
-- ROUND(x) = x (nothing has ever been persisted with a decimal since that
-- validation went in); ROUND(...)::INTEGER is used anyway as a safety net
-- for any pre-existing row that predates it, rather than assuming.
--
-- Left untouched on purpose — neither money nor an item count:
--   User.maxDiscountPercent, SubUnit.factor,
--   Product.widthMm / heightMm / thicknessMm

-- Product
ALTER TABLE "Product" ALTER COLUMN "basePrice" TYPE INTEGER USING ROUND("basePrice")::INTEGER;
ALTER TABLE "Product" ALTER COLUMN "stockQuantity" TYPE INTEGER USING ROUND("stockQuantity")::INTEGER;
ALTER TABLE "Product" ALTER COLUMN "stockQuantity" SET DEFAULT 0;
ALTER TABLE "Product" ALTER COLUMN "lastCost" TYPE INTEGER USING ROUND("lastCost")::INTEGER;

-- ProductFamily
ALTER TABLE "ProductFamily" ALTER COLUMN "lowStockThreshold" TYPE INTEGER USING ROUND("lowStockThreshold")::INTEGER;

-- ProductPriceHistory
ALTER TABLE "ProductPriceHistory" ALTER COLUMN "oldPrice" TYPE INTEGER USING ROUND("oldPrice")::INTEGER;
ALTER TABLE "ProductPriceHistory" ALTER COLUMN "newPrice" TYPE INTEGER USING ROUND("newPrice")::INTEGER;

-- InventoryBatch
ALTER TABLE "InventoryBatch" ALTER COLUMN "quantityReceived" TYPE INTEGER USING ROUND("quantityReceived")::INTEGER;
ALTER TABLE "InventoryBatch" ALTER COLUMN "remainingQuantity" TYPE INTEGER USING ROUND("remainingQuantity")::INTEGER;
ALTER TABLE "InventoryBatch" ALTER COLUMN "unitCost" TYPE INTEGER USING ROUND("unitCost")::INTEGER;

-- InventoryMovement
ALTER TABLE "InventoryMovement" ALTER COLUMN "quantity" TYPE INTEGER USING ROUND("quantity")::INTEGER;
ALTER TABLE "InventoryMovement" ALTER COLUMN "unitCost" TYPE INTEGER USING ROUND("unitCost")::INTEGER;

-- Customer
ALTER TABLE "Customer" ALTER COLUMN "creditLimit" TYPE INTEGER USING ROUND("creditLimit")::INTEGER;
ALTER TABLE "Customer" ALTER COLUMN "creditBalance" TYPE INTEGER USING ROUND("creditBalance")::INTEGER;
ALTER TABLE "Customer" ALTER COLUMN "creditBalance" SET DEFAULT 0;

-- CustomerLedgerEntry
ALTER TABLE "CustomerLedgerEntry" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount")::INTEGER;

-- Lead
ALTER TABLE "Lead" ALTER COLUMN "expectedValue" TYPE INTEGER USING ROUND("expectedValue")::INTEGER;

-- Document
ALTER TABLE "Document" ALTER COLUMN "transportAmount" TYPE INTEGER USING ROUND("transportAmount")::INTEGER;
ALTER TABLE "Document" ALTER COLUMN "transportAmount" SET DEFAULT 0;
ALTER TABLE "Document" ALTER COLUMN "roundingAdjustment" TYPE INTEGER USING ROUND("roundingAdjustment")::INTEGER;
ALTER TABLE "Document" ALTER COLUMN "roundingAdjustment" SET DEFAULT 0;
ALTER TABLE "Document" ALTER COLUMN "subtotal" TYPE INTEGER USING ROUND("subtotal")::INTEGER;
ALTER TABLE "Document" ALTER COLUMN "subtotal" SET DEFAULT 0;
ALTER TABLE "Document" ALTER COLUMN "total" TYPE INTEGER USING ROUND("total")::INTEGER;
ALTER TABLE "Document" ALTER COLUMN "total" SET DEFAULT 0;

-- DocumentItem
ALTER TABLE "DocumentItem" ALTER COLUMN "qty" TYPE INTEGER USING ROUND("qty")::INTEGER;
ALTER TABLE "DocumentItem" ALTER COLUMN "basePrice" TYPE INTEGER USING ROUND("basePrice")::INTEGER;
ALTER TABLE "DocumentItem" ALTER COLUMN "basePrice" SET DEFAULT 0;
ALTER TABLE "DocumentItem" ALTER COLUMN "unitPrice" TYPE INTEGER USING ROUND("unitPrice")::INTEGER;
ALTER TABLE "DocumentItem" ALTER COLUMN "discount" TYPE INTEGER USING ROUND("discount")::INTEGER;
ALTER TABLE "DocumentItem" ALTER COLUMN "discount" SET DEFAULT 0;
ALTER TABLE "DocumentItem" ALTER COLUMN "transportAllocated" TYPE INTEGER USING ROUND("transportAllocated")::INTEGER;
ALTER TABLE "DocumentItem" ALTER COLUMN "transportAllocated" SET DEFAULT 0;
ALTER TABLE "DocumentItem" ALTER COLUMN "roundingAdjustment" TYPE INTEGER USING ROUND("roundingAdjustment")::INTEGER;
ALTER TABLE "DocumentItem" ALTER COLUMN "roundingAdjustment" SET DEFAULT 0;
ALTER TABLE "DocumentItem" ALTER COLUMN "lineTotal" TYPE INTEGER USING ROUND("lineTotal")::INTEGER;

-- Return
ALTER TABLE "Return" ALTER COLUMN "total" TYPE INTEGER USING ROUND("total")::INTEGER;

-- ReturnItem
ALTER TABLE "ReturnItem" ALTER COLUMN "qty" TYPE INTEGER USING ROUND("qty")::INTEGER;
ALTER TABLE "ReturnItem" ALTER COLUMN "unitPrice" TYPE INTEGER USING ROUND("unitPrice")::INTEGER;
ALTER TABLE "ReturnItem" ALTER COLUMN "lineTotal" TYPE INTEGER USING ROUND("lineTotal")::INTEGER;

-- Employee
ALTER TABLE "Employee" ALTER COLUMN "baseSalary" TYPE INTEGER USING ROUND("baseSalary")::INTEGER;
ALTER TABLE "Employee" ALTER COLUMN "baseSalary" SET DEFAULT 0;

-- EmployeeAdvance
ALTER TABLE "EmployeeAdvance" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount")::INTEGER;

-- PayrollItem
ALTER TABLE "PayrollItem" ALTER COLUMN "baseSalary" TYPE INTEGER USING ROUND("baseSalary")::INTEGER;
ALTER TABLE "PayrollItem" ALTER COLUMN "advancesDeducted" TYPE INTEGER USING ROUND("advancesDeducted")::INTEGER;
ALTER TABLE "PayrollItem" ALTER COLUMN "advancesDeducted" SET DEFAULT 0;
ALTER TABLE "PayrollItem" ALTER COLUMN "otherDeductions" TYPE INTEGER USING ROUND("otherDeductions")::INTEGER;
ALTER TABLE "PayrollItem" ALTER COLUMN "otherDeductions" SET DEFAULT 0;
ALTER TABLE "PayrollItem" ALTER COLUMN "adjustments" TYPE INTEGER USING ROUND("adjustments")::INTEGER;
ALTER TABLE "PayrollItem" ALTER COLUMN "adjustments" SET DEFAULT 0;
ALTER TABLE "PayrollItem" ALTER COLUMN "grossPay" TYPE INTEGER USING ROUND("grossPay")::INTEGER;
ALTER TABLE "PayrollItem" ALTER COLUMN "netPay" TYPE INTEGER USING ROUND("netPay")::INTEGER;

-- Expense
ALTER TABLE "Expense" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount")::INTEGER;

-- BusinessSetting
ALTER TABLE "BusinessSetting" ALTER COLUMN "roundingIncrement" TYPE INTEGER USING ROUND("roundingIncrement")::INTEGER;
ALTER TABLE "BusinessSetting" ALTER COLUMN "roundingIncrement" SET DEFAULT 5;
ALTER TABLE "BusinessSetting" ALTER COLUMN "lowStockThreshold" TYPE INTEGER USING ROUND("lowStockThreshold")::INTEGER;
ALTER TABLE "BusinessSetting" ALTER COLUMN "lowStockThreshold" SET DEFAULT 5;
