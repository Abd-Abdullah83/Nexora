/**
 * Phase 1 — production-safe backfill runner.
 *
 * Unlike `prisma/seed.ts` (which also creates demo categories/products and
 * a default admin account — fine for a fresh dev DB, NOT something you want
 * to run against production), this script does exactly one thing:
 *
 *   1. Ensure the "Nexora Official Store" system seller exists.
 *   2. Backfill sellerId on every product that doesn't have one yet.
 *
 * It is idempotent and safe to run multiple times, including against a
 * production database that already has real products and a real admin
 * account. Run it once, right after applying the Phase 1 migration:
 *
 *   npx tsx scripts/backfill-system-seller.ts
 *
 * Per the Phase 1 acceptance criteria, verify afterwards that every
 * pre-existing product has a non-null sellerId:
 *
 *   SELECT count(*) FROM products WHERE "sellerId" IS NULL;
 *   -- should return 0
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SYSTEM_SELLER_EMAIL = "system+nexora-official-store@internal.nexora";

async function ensureSystemSeller() {
  const existingUser = await prisma.user.findUnique({
    where: { email: SYSTEM_SELLER_EMAIL },
    include: { seller: true },
  });

  if (existingUser?.seller) {
    console.log(`System seller already exists: ${existingUser.seller.id}`);
    return existingUser.seller;
  }

  const randomNeverIssuedPassword = bcrypt.genSaltSync(12) + Date.now().toString(36);
  const passwordHash = await bcrypt.hash(randomNeverIssuedPassword, 12);

  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        email: SYSTEM_SELLER_EMAIL,
        username: "nexora_official_store",
        password: passwordHash,
        fullName: "Nexora Official Store (System Seller)",
        role: "customer",
        emailVerified: true,
      },
    }));

  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      sellerType: "business",
      status: "active",
      isSystemSeller: true,
    },
  });

  console.log(`System seller created: ${seller.id} (user ${user.id})`);
  return seller;
}

async function backfillProductSellerIds(systemSellerId: string) {
  const before = await prisma.product.count({ where: { sellerId: null } });
  console.log(`Products with no sellerId before backfill: ${before}`);

  const result = await prisma.product.updateMany({
    where: { sellerId: null },
    data: { sellerId: systemSellerId },
  });

  const after = await prisma.product.count({ where: { sellerId: null } });
  console.log(`Backfilled ${result.count} product(s). Remaining with no sellerId: ${after}`);

  if (after !== 0) {
    throw new Error(
      `Backfill incomplete: ${after} product(s) still have a null sellerId. ` +
        `Investigate before treating Phase 1 as done.`
    );
  }
}

async function main() {
  const systemSeller = await ensureSystemSeller();
  await backfillProductSellerIds(systemSeller.id);
  console.log("\nPhase 1 backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
