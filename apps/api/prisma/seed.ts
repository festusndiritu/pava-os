import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPassword = '@Paul2026#';
  const adminPin = '1010';

  await prisma.user.upsert({
    where: { email: 'paulkiragu@gmail.com' },
    update: {},
    create: {
      name: 'Paul K.',
      role: Role.ADMIN,
      email: 'paulkiragu@gmail.com',
      avatar: 'slate-01',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      pinHash: await bcrypt.hash(adminPin, 10),
    },
  });

  console.log('Seed complete.');
  console.log('Admin login -> email: paulkiragu@gmail.com');
  console.log('Admin password:', adminPassword);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });