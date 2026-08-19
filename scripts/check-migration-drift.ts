// scripts/check-migration-drift.ts
//
// Diagnostic only — reads data, changes nothing. Checks whether Prisma's
// own migration history agrees with what's actually in the real database,
// specifically around the listing-approval schema fix
// (00_critical_fix_listing_approval_schema and its "part2" sibling).
//
// Run with:
//   npx tsx scripts/check-migration-drift.ts

import { prisma } from "@/lib/db/prisma";

async function main() {
  console.log("\n========================================");
  console.log("1. Prisma's own migration history");
  console.log("========================================");
  const migrations = await prisma.$queryRawUnsafe<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
  >(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at;
  `);
  console.table(migrations);

  console.log("\n========================================");
  console.log("2. Seller trust columns — do they exist?");
  console.log("========================================");
  const sellerCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sellers'
    AND column_name IN ('isTrustedSeller', 'approvedListingCount', 'trustGrantedAt', 'trustGrantedBy');
  `);
  console.table(sellerCols);
  console.log(`Found ${sellerCols.length} of 4 expected columns.`);

  console.log("\n========================================");
  console.log("3. Product review columns — do they exist?");
  console.log("========================================");
  const productCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'products'
    AND column_name IN ('reviewedBy', 'reviewedAt', 'rejectionReason');
  `);
  console.table(productCols);
  console.log(`Found ${productCols.length} of 3 expected columns.`);

  console.log("\n========================================");
  console.log("4a. Foreign key constraints — do they exist?");
  console.log("========================================");
  const fks = await prisma.$queryRawUnsafe<{ conname: string }[]>(`
    SELECT conname FROM pg_constraint
    WHERE conname IN ('products_reviewedBy_fkey', 'sellers_trustGrantedBy_fkey');
  `);
  console.table(fks);
  console.log(`Found ${fks.length} of 2 expected foreign keys.`);

  console.log("\n========================================");
  console.log("4b. ProductStatus enum values");
  console.log("========================================");
  const enumVals = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = 'ProductStatus'::regtype
    ORDER BY enumlabel;
  `);
  console.table(enumVals);
  const hasNeeded = enumVals.some((e) => e.enumlabel === "pending_review") &&
                     enumVals.some((e) => e.enumlabel === "rejected");
  console.log(`Has 'pending_review' and 'rejected': ${hasNeeded}`);

  console.log("\n========================================");
  console.log("SUMMARY");
  console.log("========================================");
  const migrationNames = migrations.map((m) => m.migration_name);
  const part1Tracked = migrationNames.some((n) => n.includes("critical_fix_listing_approval_schema") && !n.includes("part2"));
  const part2Tracked = migrationNames.some((n) => n.includes("critical_fix_listing_approval_schema_part2"));

  console.log(`Prisma thinks part 1 is applied: ${part1Tracked}`);
  console.log(`Prisma thinks part 2 is applied: ${part2Tracked}`);
  console.log(`Real DB has all 4 seller columns: ${sellerCols.length === 4}`);
  console.log(`Real DB has all 3 product columns: ${productCols.length === 3}`);
  console.log(`Real DB has both FKs: ${fks.length === 2}`);
  console.log(`Real DB has both enum values: ${hasNeeded}`);
}

main()
  .catch((e) => {
    console.error("\nQuery failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
