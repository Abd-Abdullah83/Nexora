const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sellers = await prisma.seller.findMany({
    where: { status: 'active', isSystemSeller: false },
    select: { id: true, displayName: true },
  });

  for (const s of sellers) {
    const existing = await prisma.store.findUnique({ where: { sellerId: s.id } });
    if (existing) {
      console.log('Store already exists for seller', s.id);
      continue;
    }
    const base = (s.displayName ?? 'my-store')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const slug = base + '-' + s.id.slice(0, 6);
    await prisma.store.create({
      data: { sellerId: s.id, name: s.displayName ?? 'My Store', slug },
    });
    console.log('Created store for seller', s.id, '— slug:', slug);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
