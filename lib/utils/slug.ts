export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Generates a unique slug by appending a numeric suffix if the base slug
 * is already taken. The checkExists function should query the database.
 */
export async function generateUniqueSlug(
  baseText: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(baseText);
  let candidate = base;
  let counter = 1;

  while (await checkExists(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }

  return candidate;
}
