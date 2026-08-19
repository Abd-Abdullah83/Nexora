import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";

// GET /api/categories
// Returns all active categories as a flat list with parentId included.
// The client (StorefrontHeader) builds the tree itself in-memory using
// parentId — this avoids a separate tree-building query on the server
// and keeps the response cacheable at the CDN level.
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        parentId: true,
        level: true,
        displayOrder: true,
        isActive: true,
      },
      orderBy: [{ level: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    });

    return Response.json(
      { categories },
      {
        headers: {
          // Cache for 60s at the CDN / browser — categories change rarely.
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}