// app/api/sellers/appeal/route.ts
//
// GET  — fetch the seller's most recent appeal thread
// POST — seller sends a reply
//
// CRITICAL DESIGN POINT: uses requireSeller() ONLY — deliberately does
// NOT check seller.status === "active" the way every other seller route
// in this codebase does. That check is precisely what would lock a
// banned/suspended seller out of the one feature they need most right
// now. requireSeller() only confirms the session belongs to a real
// seller account with a sellerId — it doesn't care what status that
// seller is in. See appeal.service.ts's file header for the same note.

import { NextRequest } from "next/server";
import { requireSeller } from "@/lib/auth/rbac";
import { rateLimit } from "@/lib/security/rate-limit";
import { getAppealForSeller, sellerReplyToAppeal } from "@/lib/sellers/appeal.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const replySchema = z.object({
  body: z.string().trim().min(5, "Message must be at least 5 characters.").max(3000),
});

export async function GET() {
  try {
    const session = await requireSeller();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const appeal = await getAppealForSeller(session.sellerId!);
    return Response.json({ appeal });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSeller();
    if (!session) throw new AppError("AUTH_REQUIRED");

    // Rate-limited per seller, not tied to the "active" gate other seller
    // routes use — a banned seller still needs to be able to use this.
    const { allowed } = await rateLimit(`appeal:reply:${session.sellerId}`, 10, 3600);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const body = await req.json().catch(() => ({}));
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    // Seller must have an existing appeal to reply to — one is always
    // auto-created at ban/suspend time, so this should always exist for
    // anyone actually banned or suspended.
    const existing = await getAppealForSeller(session.sellerId!);
    if (!existing) {
      throw new AppError("VALIDATION_ERROR", {
        appeal: "No appeal found. Appeals are opened automatically when an enforcement action is taken on your account.",
      });
    }

    const message = await sellerReplyToAppeal({
      sellerId: session.sellerId!,
      appealId: existing.id,
      body: parsed.data.body,
    });

    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
