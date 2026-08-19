// app/api/sellers/bank-account/route.ts
// GET — return the seller's bank account (masked)
// PUT — save or update bank account details

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSellerBankAccount, saveSellerBankAccount } from "@/lib/wallet/payout.service";
import { bankAccountSchema } from "@/lib/validation/payout";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);
    const account = await getSellerBankAccount(seller.id);
    return Response.json({ account });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`seller:bank-account:${session.userId}`, 10, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);
    const body = await req.json().catch(() => ({}));
    const parsed = bankAccountSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const account = await saveSellerBankAccount(seller.id, session.userId, parsed.data);
    return Response.json({ account });
  } catch (error) {
    return errorResponse(error);
  }
}
