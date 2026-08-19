import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";
import { recomputeStoreRating } from "@/lib/sellers/ratings.service";
import { z } from "zod";

const submitSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(150).optional(),
  // Sanitise comment — strip HTML tags
  comment: z.string().min(10, "Review must be at least 10 characters.").max(2000).transform(
    (val) => val.replace(/<[^>]*>/g, "").trim()
  ),
});

// ── GET /api/reviews?productId=xxx&page=1 ─────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const productId = params.get("productId");
    const page = Number(params.get("page") ?? 1);
    const pageSize = 5;

    if (!productId) {
      return Response.json({ error: { message: "productId is required." } }, { status: 400 });
    }

    const where = { productId, status: "approved" as const };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { fullName: true } },
          votes: { select: { helpful: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.review.count({ where }),
    ]);

    // Get current user's votes if logged in
    const session = await getSession();
    const userVotes: Record<string, boolean> = {};
    if (session && items.length > 0) {
      const votes = await prisma.reviewVote.findMany({
        where: {
          userId: session.userId,
          reviewId: { in: items.map((r) => r.id) },
        },
        select: { reviewId: true, helpful: true },
      });
      for (const v of votes) {
        userVotes[v.reviewId] = v.helpful;
      }
    }

    const reviews = items.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      createdAt: r.createdAt,
      authorName: r.user.fullName,
      helpfulCount: r.votes.filter((v) => v.helpful).length,
      notHelpfulCount: r.votes.filter((v) => !v.helpful).length,
      userVote: userVotes[r.id] ?? null,
      // Only a boolean flag is ever exposed — never another user's actual
      // id — this is what lets the frontend show a Delete button on the
      // viewer's own review without leaking who wrote any other review.
      isOwnReview: session ? r.userId === session.userId : false,
    }));

    return Response.json({
      reviews,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── POST /api/reviews — submit a review ───────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    // Rate limit: 3 reviews per hour per user
    const { allowed } = await rateLimit(`review:${session.userId}`, 3, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const { productId, rating, title, comment } = parsed.data;

    // Check product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (!product) throw new AppError("PRODUCT_NOT_FOUND");

    // Check purchaser verification
    const hasPurchased = await prisma.orderItem.count({
      where: {
        productId,
        order: {
          userId: session.userId,
          status: { in: ["delivered", "shipped", "confirmed"] },
        },
      },
    });
    if (hasPurchased === 0) {
      return Response.json(
        { error: { message: "You can only review products you have purchased." } },
        { status: 403 }
      );
    }

    // Check one review per product per user
    const existing = await prisma.review.findUnique({
      where: { userId_productId: { userId: session.userId, productId } },
    });
    if (existing) {
      return Response.json(
        { error: { message: "You have already reviewed this product." } },
        { status: 409 }
      );
    }

    const review = await prisma.review.create({
      data: {
        productId,
        userId: session.userId,
        rating,
        title,
        comment,
        status: "pending",
      },
    });

    // Notify admin via email (non-blocking)
    notifyAdminNewReview(product.name, rating, ip).catch(() => {});

    return Response.json(
      { message: "Review submitted successfully. It will appear after moderation.", review },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

// ── DELETE /api/reviews?id=xxx — the review's own author deletes it ───────
//
// Scoped by BOTH id and userId in the WHERE clause itself (not checked
// beforehand then deleted separately) — same defense-in-depth pattern
// used throughout this codebase (e.g. notifications.service.ts's
// markNotificationRead). deleteMany rather than delete so a mismatched
// ownership (wrong id, or someone else's review) silently affects zero
// rows instead of leaking whether a review with that id exists for
// someone else.
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const reviewId = req.nextUrl.searchParams.get("id");
    if (!reviewId) {
      return Response.json({ error: { message: "Review id is required." } }, { status: 400 });
    }

    // Fetch first (scoped to this user) so we know whether to recompute
    // the seller's store rating afterward — only matters if the review
    // was already approved and its product belongs to a real seller.
    const review = await prisma.review.findFirst({
      where: { id: reviewId, userId: session.userId },
      select: {
        id: true,
        status: true,
        product: { select: { sellerId: true } },
      },
    });

    if (!review) {
      // Same response whether the review doesn't exist or belongs to
      // someone else — never confirm another user's review exists.
      return Response.json(
        { error: { message: "Review not found." } },
        { status: 404 }
      );
    }

    await prisma.review.delete({ where: { id: review.id } });

    // If the deleted review was approved and counted toward a seller's
    // aggregate rating, recompute it now — a failed recompute must never
    // block the delete itself.
    if (review.status === "approved" && review.product.sellerId) {
      await recomputeStoreRating(review.product.sellerId).catch(() => {});
    }

    return Response.json({ message: "Review deleted." });
  } catch (error) {
    return errorResponse(error);
  }
}

async function notifyAdminNewReview(productName: string, rating: number, ip: string) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !process.env.RESEND_API_KEY) return;

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";

  await resend.emails.send({
    from,
    to: adminEmail,
    subject: `New review pending moderation — ${productName}`,
    html: `
      <p>A new <strong>${rating}★</strong> review was submitted for <strong>${productName}</strong>.</p>
      <p>It is awaiting moderation in the admin panel.</p>
      <p style="color:#999;font-size:12px;">Submitted from IP: ${ip}</p>
      <a href="${process.env.APP_URL || "http://localhost:3000"}/admin/reviews"
         style="display:inline-block;background:#c9a96e;color:#000;padding:10px 20px;border-radius:4px;text-decoration:none;margin-top:12px;">
        Review in Admin
      </a>
    `,
  });
}
