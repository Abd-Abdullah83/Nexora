import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "owner@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Admin account already exists: ${adminEmail}`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.create({
    data: {
      email: adminEmail,
      username: adminEmail.split("@")[0],
      password: passwordHash,
      fullName: "Store Owner",
      role: "admin",
      emailVerified: true,
    },
  });
  console.log(`Admin account created: ${adminEmail}`);
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 1 — MARKETPLACE EXPANSION: system seller + product backfill
//
// Creates exactly one synthetic "Nexora Official Store" seller and assigns
// every pre-existing (and freshly seeded) product to it. This is the
// single-highest-leverage move described in the scaling roadmap: once this
// runs, no existing storefront/cart/checkout code path needs to change,
// because every product has always "belonged" to a seller — there was just
// one seller before.
//
// Idempotent: safe to run repeatedly. The system user's email is fixed and
// well-known specifically so this function can look it up rather than
// guessing an id, and so application code can recognize and exclude it
// (e.g. never show it in a public "browse sellers" directory).
// ─────────────────────────────────────────────────────────────────────────

export const SYSTEM_SELLER_EMAIL = "system+nexora-official-store@internal.nexora";

async function ensureSystemSeller() {
  const existingUser = await prisma.user.findUnique({
    where: { email: SYSTEM_SELLER_EMAIL },
    include: { seller: true },
  });

  if (existingUser?.seller) {
    console.log(`System seller already exists: ${existingUser.seller.id}`);
    return existingUser.seller;
  }

  // Never-issued, never-logged-in credential. role: "customer" is
  // deliberate — this account is a database anchor for the FK, not an
  // actor in the system, so it gets the lowest available privilege level
  // rather than "admin". Nothing should ever authenticate as this user;
  // there is no password anyone could enter that would match this hash.
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
  const result = await prisma.product.updateMany({
    where: { sellerId: null },
    data: { sellerId: systemSellerId },
  });

  if (result.count > 0) {
    console.log(`Backfilled sellerId on ${result.count} product(s).`);
  } else {
    console.log("No products needed sellerId backfill.");
  }

  return result.count;
}

const CATEGORY_DEFINITIONS = [
  {
    name: "Home Decor",
    description: "Furnishings and accents to elevate every room.",
    products: [
      { name: "Hand-Woven Jute Area Rug", price: 89.99, comparePrice: 119.99, desc: "A naturally textured jute rug woven by hand, bringing warmth and organic texture to any living space.", tags: ["rug", "natural", "living room"] },
      { name: "Ceramic Table Lamp, Ivory", price: 64.5, comparePrice: null, desc: "A softly glazed ceramic lamp base paired with a linen shade for a warm, ambient glow.", tags: ["lamp", "lighting", "ceramic"] },
      { name: "Walnut Wood Wall Shelf Set", price: 45.0, comparePrice: 59.0, desc: "Set of three floating walnut shelves with a hidden mounting bracket for a clean, minimal look.", tags: ["shelf", "storage", "wood"] },
      { name: "Linen Throw Pillow Cover, Set of 2", price: 28.0, comparePrice: null, desc: "Pre-washed European linen covers in a relaxed, lived-in weave. Insert sold separately.", tags: ["pillow", "linen", "textile"] },
      { name: "Brass Geometric Wall Mirror", price: 110.0, comparePrice: 145.0, desc: "An angular brass-framed mirror that catches light beautifully and anchors any entryway or hallway.", tags: ["mirror", "brass", "wall decor"] },
      { name: "Stoneware Vase, Speckled Glaze", price: 38.0, comparePrice: null, desc: "Hand-thrown stoneware vase finished in a reactive speckled glaze — no two are exactly alike.", tags: ["vase", "ceramic", "decor"] },
    ],
  },
  {
    name: "Clothing",
    description: "Everyday essentials made from quality, breathable fabrics.",
    products: [
      { name: "Organic Cotton Crewneck Tee", price: 24.0, comparePrice: null, desc: "A heavyweight organic cotton tee with a relaxed fit and reinforced collar for everyday wear.", tags: ["tshirt", "cotton", "basics"] },
      { name: "Tailored Linen Trousers", price: 68.0, comparePrice: 85.0, desc: "Breathable linen-blend trousers with a tailored taper and an elasticated waistband for comfort.", tags: ["trousers", "linen", "tailored"] },
      { name: "Merino Wool Crew Sweater", price: 95.0, comparePrice: null, desc: "Fine-gauge merino wool sweater that regulates temperature and resists odor, season after season.", tags: ["sweater", "wool", "knitwear"] },
      { name: "Classic Denim Jacket", price: 78.0, comparePrice: 99.0, desc: "A mid-weight denim jacket with a broken-in wash and brass-tone hardware.", tags: ["jacket", "denim", "outerwear"] },
      { name: "Everyday Stretch Chinos", price: 52.0, comparePrice: null, desc: "Slim-straight chinos in a stretch cotton twill, built for all-day comfort.", tags: ["chinos", "pants", "casual"] },
      { name: "Ribbed Knit Beanie", price: 18.0, comparePrice: null, desc: "A soft, ribbed-knit beanie in a relaxed fit, perfect for cooler days.", tags: ["beanie", "accessory", "knit"] },
    ],
  },
  {
    name: "Skin Care",
    description: "Thoughtfully formulated essentials for every skin type.",
    products: [
      { name: "Hydrating Hyaluronic Acid Serum", price: 32.0, comparePrice: 40.0, desc: "A lightweight serum with multi-weight hyaluronic acid that locks in moisture for plump, dewy skin.", tags: ["serum", "hydration", "dry skin"] },
      { name: "Gentle Foaming Cleanser", price: 19.5, comparePrice: null, desc: "A pH-balanced foaming cleanser that lifts away impurities without stripping the skin barrier.", tags: ["cleanser", "face wash", "sensitive skin"] },
      { name: "Vitamin C Brightening Cream", price: 36.0, comparePrice: 45.0, desc: "A stabilized vitamin C moisturizer that helps even tone and brighten over consistent daily use.", tags: ["moisturizer", "brightening", "vitamin c"] },
      { name: "Niacinamide 10% Treatment Drops", price: 24.0, comparePrice: null, desc: "Concentrated niacinamide drops that help refine the look of pores and balance oil production.", tags: ["serum", "oily skin", "pores"] },
      { name: "Mineral SPF 50 Daily Sunscreen", price: 28.0, comparePrice: null, desc: "A non-greasy, reef-safe mineral sunscreen that leaves no white cast on any skin tone.", tags: ["spf", "sunscreen", "daily"] },
      { name: "Overnight Repair Sleeping Mask", price: 34.0, comparePrice: 42.0, desc: "A nourishing overnight mask that supports the skin's natural repair process while you sleep.", tags: ["mask", "overnight", "repair"] },
    ],
  },
  {
    name: "Electronics",
    description: "Reliable, modern tech for work, home, and everywhere in between.",
    products: [
      { name: "Wireless Noise-Cancelling Headphones", price: 149.0, comparePrice: 189.0, desc: "Over-ear headphones with adaptive noise cancellation and up to 30 hours of battery life.", tags: ["headphones", "audio", "wireless"] },
      { name: "USB-C Fast Charging Hub, 7-in-1", price: 42.0, comparePrice: null, desc: "A compact aluminum hub with HDMI, USB-A, USB-C, and SD card slots for full desktop connectivity.", tags: ["hub", "usb-c", "accessory"] },
      { name: "Smart LED Desk Lamp", price: 38.0, comparePrice: 49.0, desc: "A dimmable desk lamp with adjustable color temperature and a built-in USB charging port.", tags: ["lamp", "smart home", "desk"] },
      { name: "Portable Bluetooth Speaker", price: 59.0, comparePrice: null, desc: "A compact, water-resistant speaker delivering rich sound for up to 12 hours per charge.", tags: ["speaker", "bluetooth", "portable"] },
      { name: "Mechanical Keyboard, Compact Layout", price: 89.0, comparePrice: 109.0, desc: "A tactile mechanical keyboard with hot-swappable switches and per-key backlighting.", tags: ["keyboard", "mechanical", "desk setup"] },
      { name: "Fast Wireless Charging Pad", price: 26.0, comparePrice: null, desc: "A sleek 15W wireless charging pad compatible with all Qi-enabled devices.", tags: ["charger", "wireless", "accessory"] },
    ],
  },
];

async function seedCatalog() {
  for (let i = 0; i < CATEGORY_DEFINITIONS.length; i++) {
    const def = CATEGORY_DEFINITIONS[i];
    const slug = slugify(def.name);

    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: {
        name: def.name,
        slug,
        description: def.description,
        displayOrder: i,
      },
    });

    console.log(`Category ready: ${category.name}`);

    for (let j = 0; j < def.products.length; j++) {
      const p = def.products[j];
      const productSlug = slugify(p.name);
      const sku = `${slug.slice(0, 3).toUpperCase()}-${String(j + 1).padStart(4, "0")}`;

      const existing = await prisma.product.findUnique({ where: { slug: productSlug } });
      if (existing) {
        console.log(`  Product already exists: ${p.name}`);
        continue;
      }

      await prisma.product.create({
        data: {
          name: p.name,
          slug: productSlug,
          description: p.desc,
          shortDescription: p.desc.slice(0, 100),
          price: p.price,
          comparePrice: p.comparePrice ?? undefined,
          categoryId: category.id,
          sku,
          stockQty: 25 + j * 5,
          status: "active",
          isFeatured: j === 0,
          isBestSeller: j === 1,
          isNewArrival: j === def.products.length - 1,
          tags: p.tags,
          metaTitle: p.name,
          metaDescription: p.desc.slice(0, 150),
          images: {
            create: [
              {
                url: `https://placehold.co/600x600?text=${encodeURIComponent(p.name)}`,
                altText: p.name,
                displayOrder: 0,
                isPrimary: true,
              },
            ],
          },
        },
      });
      console.log(`  Product created: ${p.name}`);
    }
  }
}

async function main() {
  await seedAdmin();

  const systemSeller = await ensureSystemSeller();
  await backfillProductSellerIds(systemSeller.id);

  await seedCatalog();

  // Run again after seeding: a fresh dev DB has no products until
  // seedCatalog() just created them, so this second pass is what actually
  // assigns sellerId on a brand-new database. On an existing production
  // database the first pass already did the real work and this is a no-op.
  await backfillProductSellerIds(systemSeller.id);

  console.log("\nSeed complete: 4 categories, 24 products.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
