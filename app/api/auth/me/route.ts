import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";

/**
 * GET /api/auth/me
 *
 * Returns the current session user's public fields.
 * Used by StorefrontHeader and useSession hook.
 *
 * Returns { user: null } with status 401 when not logged in.
 * The client treats 401 as "not logged in" — not as an error toast.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return Response.json({ user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        seller: { select: { id: true } },
        // Never expose: password, twoFactorSecret, tokens, etc.
      },
    });

    if (!user) {
      return Response.json({ user: null }, { status: 401 });
    }

    const { seller, ...publicUser } = user;
    return Response.json({
      user: { ...publicUser, sellerId: seller?.id },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
