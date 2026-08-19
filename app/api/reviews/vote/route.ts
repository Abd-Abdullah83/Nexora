import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const schema = z.object({
  reviewId: z.string().uuid(),
  helpful: z.boolean(),
});

// ── POST /api/reviews/vote ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const { reviewId, helpful } = parsed.data;

    // Check review exists
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return Response.json({ error: { message: "Review not found." } }, { status: 404 });
    }

    // Can't vote on your own review
    if (review.userId === session.userId) {
      return Response.json(
        { error: { message: "You cannot vote on your own review." } },
        { status: 403 }
      );
    }

    // Upsert vote — changing your vote is allowed
    const existing = await prisma.reviewVote.findUnique({
      where: { reviewId_userId: { reviewId, userId: session.userId } },
    });

    if (existing && existing.helpful === helpful) {
      // Clicking same vote again = remove it (toggle off)
      await prisma.reviewVote.delete({
        where: { reviewId_userId: { reviewId, userId: session.userId } },
      });
    } else {
      await prisma.reviewVote.upsert({
        where: { reviewId_userId: { reviewId, userId: session.userId } },
        create: { reviewId, userId: session.userId, helpful },
        update: { helpful },
      });
    }

    // Return updated counts
    const votes = await prisma.reviewVote.findMany({
      where: { reviewId },
      select: { helpful: true },
    });

    return Response.json({
      helpfulCount: votes.filter((v) => v.helpful).length,
      notHelpfulCount: votes.filter((v) => !v.helpful).length,
      userVote: existing?.helpful === helpful ? null : helpful,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
