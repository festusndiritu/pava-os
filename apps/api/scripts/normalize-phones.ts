import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { normalizeKenyanPhone } from '../src/common/validation/phone.validator.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const KENYAN_MOBILE = /^(07|01)\d{8}$/;

/**
 * One-off backfill for phone data that predates @OptionalKenyanPhone on
 * the DTOs — numbers saved as "+254712345678", "0712 345 678" or similar
 * before that validation existed. Safe to run more than once: any number
 * already in the canonical 07xx/01xx form is left untouched, and every
 * change is reported rather than applied silently, since a number that
 * doesn't normalize cleanly needs a human to look at it, not a script
 * guessing on their behalf.
 *
 * Run with: bun run normalize:phones  (from apps/api)
 */
async function normalizeTable<T extends { id: string }>(
  label: string,
  rows: (T & Record<string, unknown>)[],
  fields: string[],
  update: (id: string, data: Record<string, string | null>) => Promise<unknown>,
) {
  let changed = 0;
  let flagged = 0;
  for (const row of rows) {
    const patch: Record<string, string | null> = {};
    for (const field of fields) {
      const raw = row[field];
      if (typeof raw !== 'string' || raw.trim() === '') continue;
      const normalized = normalizeKenyanPhone(raw);
      if (typeof normalized !== 'string' || normalized === raw) continue;
      if (!KENYAN_MOBILE.test(normalized)) {
        console.warn(`  [${label}] ${row.id}.${field} = "${raw}" does not normalize to a valid number — left as-is, needs manual review`);
        flagged++;
        continue;
      }
      patch[field] = normalized;
    }
    if (Object.keys(patch).length > 0) {
      await update(row.id, patch);
      changed++;
    }
  }
  console.log(`${label}: ${changed} row(s) normalized, ${flagged} flagged for manual review`);
}

async function main() {
  await normalizeTable('User', await prisma.user.findMany({ select: { id: true, phone: true } }), ['phone'], (id, data) =>
    prisma.user.update({ where: { id }, data }),
  );

  await normalizeTable(
    'Customer',
    await prisma.customer.findMany({ select: { id: true, phone: true, altPhone: true } }),
    ['phone', 'altPhone'],
    (id, data) => prisma.customer.update({ where: { id }, data }),
  );

  await normalizeTable('Lead', await prisma.lead.findMany({ select: { id: true, phone: true } }), ['phone'], (id, data) =>
    prisma.lead.update({ where: { id }, data }),
  );

  await normalizeTable(
    'Contact',
    await prisma.contact.findMany({ select: { id: true, phone: true, altPhone: true } }),
    ['phone', 'altPhone'],
    (id, data) => prisma.contact.update({ where: { id }, data }),
  );

  await normalizeTable(
    'Employee',
    await prisma.employee.findMany({ select: { id: true, phone: true, emergencyContactPhone: true } }),
    ['phone', 'emergencyContactPhone'],
    (id, data) => prisma.employee.update({ where: { id }, data }),
  );

  const settings = await prisma.businessSetting.findUnique({ where: { id: 'singleton' } });
  if (settings?.phone) {
    const normalized = normalizeKenyanPhone(settings.phone);
    if (typeof normalized === 'string' && normalized !== settings.phone) {
      if (KENYAN_MOBILE.test(normalized)) {
        await prisma.businessSetting.update({ where: { id: 'singleton' }, data: { phone: normalized } });
        console.log('BusinessSetting: 1 row normalized');
      } else {
        console.warn(`  [BusinessSetting] phone = "${settings.phone}" does not normalize to a valid number — left as-is, needs manual review`);
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
