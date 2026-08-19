// lib/utils/csv.ts
//
// Phase 5 gap fill: CSV parser + product-row mapper used by
// app/api/sellers/csv-upload/route.ts.
//
// parseCsv — low-level RFC 4180-compliant parser (quoted fields, escaped
//   quotes, normalized line endings). No external dependency.
// parseProductCsv — higher-level function that maps parsed rows into typed
//   ProductCsvRow objects and returns a { rows, parseErrors } pair so the
//   upload route can report per-row errors without aborting the whole batch.
//
// Expected CSV header row (case-insensitive, extra columns ignored):
//   name, description, shortDescription, price, comparePrice, sku,
//   stockQty, categorySlug, categoryName, currency, tags, weightGrams

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        if (row.some((f) => f.trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
  }
  // Flush last row (no trailing newline)
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);

  return rows;
}

export interface ProductCsvRow {
  name: string;
  description?: string;
  shortDescription?: string;
  price: number;
  comparePrice?: number;
  sku: string;
  stockQty?: number;
  categorySlug?: string;
  categoryName?: string;
  currency?: string;
  tags?: string[];
  weightGrams?: number;
}

export interface CsvParseResult {
  rows: ProductCsvRow[];
  parseErrors: { row: number; message: string }[];
}

const REQUIRED_HEADERS = ["name", "price", "sku"] as const;

/** Maps the normalized header string to the ProductCsvRow field name. */
const HEADER_MAP: Record<string, keyof ProductCsvRow> = {
  name: "name",
  description: "description",
  shortdescription: "shortDescription",
  "short description": "shortDescription",
  price: "price",
  compareprice: "comparePrice",
  "compare price": "comparePrice",
  sku: "sku",
  stockqty: "stockQty",
  stock: "stockQty",
  "stock qty": "stockQty",
  categoryslug: "categorySlug",
  "category slug": "categorySlug",
  categoryname: "categoryName",
  "category name": "categoryName",
  category: "categoryName",
  currency: "currency",
  tags: "tags",
  weightgrams: "weightGrams",
  "weight grams": "weightGrams",
  weight: "weightGrams",
};

export function parseProductCsv(text: string): CsvParseResult {
  const raw = parseCsv(text);
  if (raw.length === 0) {
    return { rows: [], parseErrors: [{ row: 1, message: "File is empty." }] };
  }

  // First row is the header
  const headers = raw[0].map((h) => h.trim().toLowerCase());

  // Check required columns exist
  const missing = REQUIRED_HEADERS.filter((req) => !headers.some((h) => HEADER_MAP[h] === req));
  if (missing.length > 0) {
    return {
      rows: [],
      parseErrors: [
        {
          row: 1,
          message: `Missing required column(s): ${missing.join(", ")}. Check the header row.`,
        },
      ],
    };
  }

  const rows: ProductCsvRow[] = [];
  const parseErrors: { row: number; message: string }[] = [];

  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i];
    const rowNum = i + 1; // 1-indexed, row 1 was the header

    // Build a key→value map for this row
    const obj: Record<string, string> = {};
    headers.forEach((header, colIdx) => {
      const field = HEADER_MAP[header];
      if (field) obj[field] = (cells[colIdx] ?? "").trim();
    });

    const errors: string[] = [];

    if (!obj.name) errors.push("name is required");

    const price = parseFloat(obj.price ?? "");
    if (isNaN(price) || price <= 0) errors.push("price must be a positive number");

    if (!obj.sku) errors.push("sku is required");

    if (errors.length > 0) {
      parseErrors.push({ row: rowNum, message: errors.join("; ") });
      continue;
    }

    const comparePrice = obj.comparePrice ? parseFloat(obj.comparePrice) : undefined;
    const stockQty = obj.stockQty ? parseInt(obj.stockQty, 10) : 0;
    const weightGrams = obj.weightGrams ? parseInt(obj.weightGrams, 10) : undefined;
    const tags = obj.tags
      ? obj.tags.split("|").map((t) => t.trim()).filter(Boolean)
      : [];

    rows.push({
      name: obj.name,
      description: obj.description || undefined,
      shortDescription: obj.shortDescription || undefined,
      price,
      comparePrice: !isNaN(comparePrice!) && comparePrice! > 0 ? comparePrice : undefined,
      sku: obj.sku,
      stockQty: isNaN(stockQty) ? 0 : stockQty,
      categorySlug: obj.categorySlug || undefined,
      categoryName: obj.categoryName || undefined,
      currency: obj.currency || undefined,
      tags: tags.length > 0 ? tags : undefined,
      weightGrams: weightGrams && !isNaN(weightGrams) ? weightGrams : undefined,
    });
  }

  return { rows, parseErrors };
}
