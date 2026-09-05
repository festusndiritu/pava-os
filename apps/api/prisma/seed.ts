import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, Module, StockStatus } from '../generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPassword = 'ChangeMe123!';
  const adminPin = '1010';
  const marketingPin = '2020';
  const posPin = '3030';

  const admin = await prisma.user.upsert({
    where: { email: 'bro@broshardware.local' },
    update: {},
    create: {
      name: 'Bro (Admin)',
      role: Role.ADMIN,
      email: 'bro@broshardware.local',
      avatar: 'slate-01',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      pinHash: await bcrypt.hash(adminPin, 10),
    },
  });

  await prisma.user.upsert({
    where: { email: 'marketing@broshardware.local' },
    update: {},
    create: {
      name: 'Marketing Guy',
      role: Role.STAFF,
      email: 'marketing@broshardware.local',
      avatar: 'amber-02',
      pinHash: await bcrypt.hash(marketingPin, 10),
      permissions: [Module.DASHBOARD, Module.MARKETING, Module.PRODUCTS, Module.LEADS, Module.CONTACTS],
      createdById: admin.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'cashier@broshardware.local' },
    update: {},
    create: {
      name: 'Counter / Cashier',
      role: Role.STAFF,
      email: 'cashier@broshardware.local',
      avatar: 'teal-03',
      pinHash: await bcrypt.hash(posPin, 10),
      permissions: [Module.DASHBOARD, Module.POS, Module.PRODUCTS, Module.CUSTOMERS, Module.QUOTES, Module.INVOICES],
      createdById: admin.id,
    },
  });

  const kg = await prisma.unit.upsert({
    where: { name: 'Kilogram' },
    update: {},
    create: { name: 'Kilogram', symbol: 'kg' },
  });
  const piece = await prisma.unit.upsert({
    where: { name: 'Piece' },
    update: {},
    create: { name: 'Piece', symbol: 'pc' },
  });
  const length = await prisma.unit.upsert({
    where: { name: 'Length' },
    update: {},
    create: { name: 'Length', symbol: 'm' },
  });
  const bag = await prisma.unit.upsert({
    where: { name: 'Bag' },
    update: {},
    create: { name: 'Bag', symbol: 'bag' },
  });

  await prisma.subUnit.createMany({
    data: [{ unitId: bag.id, name: '50kg bag', factor: 50 }],
    skipDuplicates: true,
  });

  const steel = await prisma.category.upsert({
    where: { name: 'Reinforcement Steel' },
    update: {},
    create: { name: 'Reinforcement Steel' },
  });
  const sections = await prisma.category.upsert({
    where: { name: 'Hollow Sections & Bars' },
    update: {},
    create: { name: 'Hollow Sections & Bars' },
  });
  const consumables = await prisma.category.upsert({
    where: { name: 'Consumables' },
    update: {},
    create: { name: 'Consumables' },
  });

  const genericBrand = await prisma.brand.upsert({
    where: { name: 'Generic' },
    update: {},
    create: { name: 'Generic' },
  });

  await prisma.product.createMany({
    data: [
      {
        name: 'Deformed Bar',
        spec: 'Y12',
        categoryId: steel.id,
        brandId: genericBrand.id,
        unitId: piece.id,
        basePrice: 850,
        stockStatus: StockStatus.IN_STOCK,
      },
      {
        name: 'Round Bar',
        spec: '8mm',
        categoryId: steel.id,
        brandId: genericBrand.id,
        unitId: piece.id,
        basePrice: 620,
        stockStatus: StockStatus.IN_STOCK,
      },
      {
        name: 'SHS (Square Hollow Section)',
        spec: '50x50x3mm',
        categoryId: sections.id,
        brandId: genericBrand.id,
        unitId: length.id,
        basePrice: 3200,
        stockStatus: StockStatus.IN_STOCK,
      },
      {
        name: 'Nails',
        spec: '3 inch',
        categoryId: consumables.id,
        brandId: genericBrand.id,
        unitId: bag.id,
        basePrice: 7500,
        stockStatus: StockStatus.IN_STOCK,
      },
      {
        name: 'Cutting Disk',
        spec: '4.5 inch',
        categoryId: consumables.id,
        brandId: genericBrand.id,
        unitId: piece.id,
        basePrice: 150,
        stockStatus: StockStatus.SUPPLIER_ONLY,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete.');
  console.log('Admin login -> email: bro@broshardware.local  password:', adminPassword);
  console.log('Admin PIN:', adminPin, '| Marketing PIN:', marketingPin, '| POS PIN:', posPin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
