const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const constraints = await prisma.$queryRawUnsafe(`
    SELECT conname
    FROM pg_constraint
    WHERE conname IN (
      'products_reviewedBy_fkey',
      'sellers_trustGrantedBy_fkey'
    );
  `);

  console.table(constraints);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });