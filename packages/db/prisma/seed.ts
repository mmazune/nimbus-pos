import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Baseline AppConfig rows ──
const APP_CONFIG_DEFAULTS: { key: string; value: string }[] = [
  { key: 'app.name', value: 'Nimbus POS' },
  { key: 'app.version', value: '0.1.0' },
  { key: 'app.milestone', value: 'M1' },
];

async function seedAppConfig(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const row of APP_CONFIG_DEFAULTS) {
    const existing = await prisma.appConfig.findUnique({ where: { key: row.key } });
    if (existing) {
      console.log(`  ⏭  AppConfig "${row.key}" already exists — skipped`);
      skipped++;
    } else {
      await prisma.appConfig.create({ data: row });
      console.log(`  ✅ AppConfig "${row.key}" created`);
      created++;
    }
  }

  return { created, skipped };
}

async function recordSeedRun(seedName: string, details: string): Promise<void> {
  await prisma.seedHistory.upsert({
    where: { seedName },
    update: { runAt: new Date(), details },
    create: { seedName, status: 'completed', details },
  });
}

async function main(): Promise<void> {
  console.log('\n🌱 Nimbus POS — Seed Runner\n');

  // 1) Seed AppConfig
  console.log('── AppConfig ──');
  const configResult = await seedAppConfig();
  console.log(`   Created: ${configResult.created}, Skipped: ${configResult.skipped}\n`);

  // 2) Record seed execution
  await recordSeedRun(
    'm1-baseline',
    `AppConfig: ${configResult.created} created, ${configResult.skipped} skipped`,
  );
  console.log('── SeedHistory marker recorded for m1-baseline ──\n');

  console.log('🌱 Seed complete.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
