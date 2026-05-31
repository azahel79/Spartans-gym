import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@spartansgym.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
    },
  });

  const defaultPlans = [
    { name: 'Mensual', price: 450, period: 'Mes', color: 'bg-primary', isActive: true },
    { name: 'Trimestral', price: 1200, period: '3 Meses', color: 'bg-secondary', isActive: true },
    { name: 'Semestral', price: 2200, period: '6 Meses', color: 'bg-emerald-500', isActive: true },
    { name: 'Anual', price: 4000, period: 'Ano', color: 'bg-amber-500', isActive: true },
  ];

  for (const plan of defaultPlans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  console.log('Seed completed');
  console.log(`Admin user: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
