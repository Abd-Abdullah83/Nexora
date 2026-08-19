// scripts/fix-migration-names.ts
//
// Renames rows in _prisma_migrations to match the folder renames from
// Step 1. This does NOT re-run any SQL — it only updates the bookkeeping
// so Prisma recognizes these as the same already-applied migrations
// under their new folder names, rather than treating them as new,
// never-applied migrations (which would try to re-run against the real
// database and fail with "column already exists").
//
// Run AFTER renaming the folders (Step 1), BEFORE running
// `npx prisma migrate dev` again.
//
//   npx tsx scripts/fix-migration-names.ts

import { prisma } from "@/lib/db/prisma";

const RENAMES: { oldName: string; newName: string; onlyIfNotRolledBack?: boolean }[] = [
  {
    oldName: "00_critical_fix_listing_approval_schema",
    newName: "20260707010000_critical_fix_listing_approval_schema",
    // This name has 3 rows (2 rolled back, 1 finished) — only rename the
    // finished one. The 2 rolled-back rows are left alone, same as the
    // existing harmless leftover for '20260702100000_add_listing_approval'.
    onlyIfNotRolledBack: true,
  },
  {
    oldName: "01_critical_fix_listing_approval_schema_part2",
    newName: "20260707010001_critical_fix_listing_approval_schema_part2",
  },
  {
    oldName: "10_phase5_listing_moderation",
    newName: "20260707010002_phase5_listing_moderation",
  },
  {
    oldName: "20_phase6_customers_index",
    newName: "20260707010003_phase6_customers_index",
  },
  {
    oldName: "30_phase10_ratings_notifications_support",
    newName: "20260707010004_phase10_ratings_notifications_support",
  },
];

async function main() {
  for (const { oldName, newName, onlyIfNotRolledBack } of RENAMES) {
    const whereClause = onlyIfNotRolledBack
      ? `WHERE migration_name = '${oldName}' AND rolled_back_at IS NULL`
      : `WHERE migration_name = '${oldName}'`;

    const result = await prisma.$executeRawUnsafe(`
      UPDATE "_prisma_migrations"
      SET migration_name = '${newName}'
      ${whereClause};
    `);

    console.log(`${oldName} → ${newName}: ${result} row(s) updated`);
  }

  console.log("\nDone. Now run: npx prisma migrate status");
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
