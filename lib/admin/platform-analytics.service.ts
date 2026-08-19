// lib/admin/platform-analytics.service.ts
//
// Platform-wide KPIs for the admin overview dashboard.
// All queries are read-only aggregations — no state changes here.

import { prisma } from "@/lib/db/prisma";

export interface PlatformKPIs {
  sellers: {
    active: number;
    pendingApproval: number;
    suspended: number;
    banned: number;
    total: number;
  };
  orders: {
    total: number;
    pending: number;
    confirmed: number;
    delivered: number;
    last30Days: number;
  };
  revenue: {
    gmv30Days: number;       // gross merchandise value — sum of all order totals
    commissionEarned30Days: number; // sum of commission ledger entries
    currency: string;
  };
  escrow: {
    totalHeld: number;       // sum of all held escrow holds
    totalFrozen: number;     // sum of frozen (banned seller) holds
    totalDisputed: number;   // sum of disputed holds
    currency: string;
  };
  payouts: {
    pendingCount: number;
    pendingAmount: number;
    currency: string;
  };
  disputes: {
    open: number;
    sellerReview: number;
    adminReview: number;    // needs urgent attention
  };
  verifications: {
    pendingKyc: number;
    pendingApproval: number;
    submittedDocs: number;
  };
  banEvasionAlerts: {
    pending: number;
  };
}

export async function getPlatformKPIs(): Promise<PlatformKPIs> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    sellerCounts,
    orderCounts,
    orders30d,
    gmv30d,
    commission30d,
    escrowAgg,
    payoutAgg,
    disputeCounts,
    verificationCounts,
    banAlertCount,
  ] = await Promise.all([
    // Seller status breakdown
    prisma.seller.groupBy({
      by: ["status"],
      where: { isSystemSeller: false },
      _count: true,
    }),

    // Order status breakdown
    prisma.order.groupBy({
      by: ["status"],
      _count: true,
    }),

    // Orders last 30 days
    prisma.order.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),

    // GMV last 30 days — sum of total on all orders
    prisma.order.aggregate({
      where: { createdAt: { gte: thirtyDaysAgo } },
      _sum: { total: true },
    }),

    // Commission earned last 30 days — sum of commission ledger entries
    prisma.ledgerEntry.aggregate({
      where: {
        entryType: "commission",
        createdAt: { gte: thirtyDaysAgo },
        // Commission entries are negative (debit from seller) — take abs
      },
      _sum: { amount: true },
    }),

    // Escrow holds aggregated by status
    prisma.escrowHold.groupBy({
      by: ["status"],
      where: { status: { in: ["held", "frozen", "disputed"] } },
      _sum: { grossAmount: true },
    }),

    // Pending payout requests
    prisma.payoutRequest.aggregate({
      where: { status: { in: ["requested", "processing"] } },
      _count: true,
      _sum: { amount: true },
    }),

    // Dispute counts by status
    prisma.dispute.groupBy({
      by: ["status"],
      where: { status: { in: ["open", "seller_review", "admin_review"] } },
      _count: true,
    }),

    // Seller verification queue
    prisma.seller.groupBy({
      by: ["status"],
      where: {
        status: {
          in: ["pending_kyc", "pending_approval"],
        },
        isSystemSeller: false,
      },
      _count: true,
    }),

    // Ban evasion alerts
    prisma.banEvasionAlert.count({ where: { status: "pending" } }),
  ]);

  // Build seller breakdown
  const sellerMap = Object.fromEntries(sellerCounts.map((s) => [s.status, s._count]));
  const totalSellers = sellerCounts.reduce((sum, s) => sum + s._count, 0);

  // Build order breakdown
  const orderMap = Object.fromEntries(orderCounts.map((o) => [o.status, o._count]));
  const totalOrders = orderCounts.reduce((sum, o) => sum + o._count, 0);

  // Build escrow breakdown
  const escrowMap = Object.fromEntries(
    escrowAgg.map((e) => [e.status, Number(e._sum.grossAmount ?? 0)])
  );

  // Build dispute breakdown
  const disputeMap = Object.fromEntries(disputeCounts.map((d) => [d.status, d._count]));

  // Build verification breakdown
  const verifMap = Object.fromEntries(verificationCounts.map((v) => [v.status, v._count]));

  // Commission entries are negative debits — abs to get platform income
  const commissionEarned = Math.abs(Number(commission30d._sum.amount ?? 0));

  return {
    sellers: {
      active: sellerMap["active"] ?? 0,
      pendingApproval: sellerMap["pending_approval"] ?? 0,
      suspended: sellerMap["suspended"] ?? 0,
      banned: sellerMap["banned"] ?? 0,
      total: totalSellers,
    },
    orders: {
      total: totalOrders,
      pending: orderMap["pending"] ?? 0,
      confirmed: orderMap["confirmed"] ?? 0,
      delivered: orderMap["delivered"] ?? 0,
      last30Days: orders30d,
    },
    revenue: {
      gmv30Days: Number(gmv30d._sum.total ?? 0),
      commissionEarned30Days: commissionEarned,
      currency: "PKR",
    },
    escrow: {
      totalHeld: escrowMap["held"] ?? 0,
      totalFrozen: escrowMap["frozen"] ?? 0,
      totalDisputed: escrowMap["disputed"] ?? 0,
      currency: "PKR",
    },
    payouts: {
      pendingCount: payoutAgg._count,
      pendingAmount: Number(payoutAgg._sum.amount ?? 0),
      currency: "PKR",
    },
    disputes: {
      open: disputeMap["open"] ?? 0,
      sellerReview: disputeMap["seller_review"] ?? 0,
      adminReview: disputeMap["admin_review"] ?? 0,
    },
    verifications: {
      pendingKyc: verifMap["pending_kyc"] ?? 0,
      pendingApproval: verifMap["pending_approval"] ?? 0,
      submittedDocs: await prisma.sellerVerification.count({ where: { status: "submitted" } }),
    },
    banEvasionAlerts: {
      pending: banAlertCount,
    },
  };
}
