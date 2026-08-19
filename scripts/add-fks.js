const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products"
    ADD CONSTRAINT "products_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "sellers"
    ADD CONSTRAINT "sellers_trustGrantedBy_fkey"
    FOREIGN KEY ("trustGrantedBy")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  `);

  console.log("Foreign keys added successfully.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });