// app/api/sellers/wallet/route.ts
//
// Phase 7 — GET /api/sellers/wallet, per the doc's exact API contract:
// "pending/available/held balances + recent ledger entries."
//
// EXTENSION over the session-2 draft: also returns this seller's own
// upcoming escrow releases (held line items not yet release-eligible),
// so the Wallet page can render a countdown per item — the README's
// "Wallet page ... with upcoming releases with countdown" requirement.
// getEscrowQueue() in escrow.service.ts is deliberately admin-scoped (no
// sellerId filter), so this queries EscrowHold directly here rather than
// widening that admin function's contract for a seller-facing read.
//
// Follows the same inline getActiveSeller() auth pattern Phase 4/5/6's
// seller routes already use (see Phase 6 README §6 — a documented style
// choice, not a security gap; kept consistent here rather than
// introducing a third pattern mid-feature).

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getWalletForSeller, getLedgerHistoryForSeller } from "@/lib/wallet/ledger.service";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId } });
  if (!seller || seller.status !== "active") return null;
  return seller;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSeller(session.userId);
    if (!seller) throw new AppError("AUTH_REQUIRED", { seller: "No active seller account." });

    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? "20");

    const [wallet, ledger, upcomingReleases] = await Promise.all([
      getWalletForSeller(seller.id),
      getLedgerHistoryForSeller(seller.id, { page, pageSize }),
      // Held (or frozen) line items belonging to THIS seller only —
      // not yet released. Ordered soonest-eligible first so the UI's
      // countdown list reads in the order things will actually unlock.
      prisma.escrowHold.findMany({
        where: { sellerId: seller.id, status: { in: ["held", "frozen"] } },
        orderBy: { releaseEligibleAt: "asc" },
        take: 50,
        select: {
          id: true,
          status: true,
          grossAmount: true,
          deliveredAt: true,
          releaseEligibleAt: true,
          freezeReason: true,
          orderItem: { select: { productName: true, orderId: true } },
        },
      }),
    ]);

    // A wallet should always exist for an active seller (created at
    // approval time) — but fail gracefully with zeros rather than 500 if
    // it's somehow missing, since this is a read-only balance display,
    // not a place that should ever throw on the seller.
    return Response.json({
      wallet: wallet ?? { pendingBalance: 0, availableBalance: 0, heldBalance: 0, currency: "PKR" },
      ledger,
      upcomingReleases,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
