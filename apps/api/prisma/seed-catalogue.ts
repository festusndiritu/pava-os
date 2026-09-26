/**
 * Seeds the product catalogue (categories, brands, units, product families,
 * and products) from data-pava-catalogue.json — the cleaned/deduplicated
 * PAVA Steel & Hardware stock export.
 *
 * Run with:  bun prisma/seed-catalogue.ts
 *
 * Idempotent: safe to re-run. Categories/Brands/Units/Families are upserted
 * by their unique `name`. Products have no unique constraint in the schema,
 * so each is matched by (name + brandId) — if a matching product already
 * exists its stockQuantity/spec fields are updated in place rather than
 * duplicated; otherwise a new one is created.
 *
 * IMPORTANT — basePrice: the source export had no pricing data at all, so
 * every product is seeded with basePrice = 0 and stockStatus derived only
 * from quantity. Prices MUST be filled in (Products page or a follow-up
 * script) before this catalogue is used for real sales — nothing in POS,
 * quotes, or invoices will make sense at KSh 0.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, StockStatus } from '../generated/prisma/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

interface CatalogueProduct {
  name: string;
  displayName: string;
  category: string | null;
  brand: string | null;
  unit: string;
  stockQuantity: number;
  shape: string | null;
  nominalSize: string | null;
  widthMm: number | null;
  heightMm: number | null;
  thicknessMm: number | null;
  gauge: number | null;
  material: string | null;
  family: string | null;
}

interface Catalogue {
  categories: string[];
  brands: string[];
  units: { name: string; symbol: string }[];
  families: { name: string; aggregateLowStock: boolean }[];
  products: CatalogueProduct[];
}

const DEFAULT_BASE_PRICE = 0; // placeholder — see file header

async function main() {
  const raw = readFileSync(join(__dirname, 'data-pava-catalogue.json'), 'utf-8');
  const catalogue: Catalogue = JSON.parse(raw);

  console.log(
    `Loaded catalogue: ${catalogue.categories.length} categories, ${catalogue.brands.length} brands, ` +
      `${catalogue.units.length} units, ${catalogue.families.length} families, ${catalogue.products.length} products.`,
  );

  // ---- Categories ----
  const categoryIds = new Map<string, string>();
  for (const name of catalogue.categories) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryIds.set(name, category.id);
  }
  console.log(`Categories upserted: ${categoryIds.size}`);

  // ---- Brands ----
  const brandIds = new Map<string, string>();
  for (const name of catalogue.brands) {
    const brand = await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    brandIds.set(name, brand.id);
  }
  console.log(`Brands upserted: ${brandIds.size}`);

  // ---- Units ----
  const unitIds = new Map<string, string>();
  for (const { name, symbol } of catalogue.units) {
    const unit = await prisma.unit.upsert({
      where: { name },
      update: { symbol },
      create: { name, symbol },
    });
    unitIds.set(name, unit.id);
  }
  console.log(`Units upserted: ${unitIds.size}`);

  // ---- Product families (aggregate low-stock groups) ----
  const familyIds = new Map<string, string>();
  for (const { name, aggregateLowStock } of catalogue.families) {
    const family = await prisma.productFamily.upsert({
      where: { name },
      update: { aggregateLowStock },
      create: { name, aggregateLowStock },
    });
    familyIds.set(name, family.id);
  }
  console.log(`Product families upserted: ${familyIds.size}`);

  // ---- Products ----
  let created = 0;
  let updated = 0;

  for (const p of catalogue.products) {
    const categoryId = p.category ? categoryIds.get(p.category) : undefined;
    const brandId = p.brand ? brandIds.get(p.brand) : undefined;
    const unitId = unitIds.get(p.unit);
    const familyId = p.family ? familyIds.get(p.family) : undefined;

    if (!unitId) {
      throw new Error(`Unit "${p.unit}" for product "${p.name}" was not found among seeded units.`);
    }

    const stockStatus: StockStatus = p.stockQuantity > 0 ? StockStatus.IN_STOCK : StockStatus.OUT_OF_STOCK;

    const existing = await prisma.product.findFirst({
      where: { name: p.name, brandId: brandId ?? null },
    });

    const data = {
      name: p.name,
      displayName: p.displayName,
      brandId: brandId ?? null,
      categoryId: categoryId ?? null,
      unitId,
      basePrice: DEFAULT_BASE_PRICE,
      stockQuantity: p.stockQuantity,
      stockStatus,
      shape: p.shape,
      nominalSize: p.nominalSize,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      thicknessMm: p.thicknessMm,
      gauge: p.gauge,
      material: p.material,
      familyId: familyId ?? null,
    };

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.product.create({ data });
      created++;
    }
  }

  console.log(`Products created: ${created}, updated: ${updated}`);
  console.log('\nSeed complete. REMINDER: all products were seeded with basePrice = 0 — set real prices before going live.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
