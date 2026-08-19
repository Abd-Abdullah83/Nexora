"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */

interface KPIs {
  sellers: { active: number; pendingApproval: number; suspended: number; banned: number; total: number };
  orders: { total: number; pending: number; confirmed: number; delivered: number; last30Days: number };
  revenue: { gmv30Days: number; commissionEarned30Days: number; currency: string };
  escrow: { totalHeld: number; totalFrozen: number; totalDisputed: number; currency: string };
  payouts: { pendingCount: number; pendingAmount: number; currency: string };
  disputes: { open: number; sellerReview: number; adminReview: number };
  verifications: { pendingKyc: number; pendingApproval: number; submittedDocs: number };
  banEvasionAlerts: { pending: number };
}

interface AnalyticsData {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    totalProducts: number;
    recentOrders: number;
    lowStockProducts: number;
    pendingReviews: number;
  };
  revenueChart: { date: string; orders: number; revenue: number }[];
  ordersByStatus: { status: string; count: number }[];
  topProducts: { name: string; quantity: number }[];
  latestOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }[];
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */

function fmt(n: number, currency = "PKR") {
  return `${currency} ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#10b981",
  cancelled: "#ef4444",
  refunded: "#6b7280",
};

const PIE_COLORS = ["#c9a96e", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#6b7280"];

/* ────────────────────────────────────────────────────────────────
   Shared building blocks
   ──────────────────────────────────────────────────────────────── */

function KpiCard({
  label, value, sub, href, urgent,
}: {
  label: string; value: string; sub?: string; href?: string; urgent?: boolean;
}) {
  const inner = (
    <div className={`rounded-sm border p-4 transition ${
      urgent
        ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
        : "border-white/[0.08] bg-surface hover:bg-white/[0.06]"
    }`}>
      <p className="text-xs uppercase tracking-wider text-slate">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${urgent ? "text-red-300" : "text-cream"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────── */

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [kpisError, setKpisError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/admin/overview").then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Could not load dashboard overview.");
        setKpis(json);
      }),
      fetch("/api/admin/analytics").then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Could not load analytics.");
        setAnalytics(json);
      }),
    ]).then((results) => {
      if (results[0].status === "rejected") setKpisError(String(results[0].reason?.message ?? "Network error."));
      if (results[1].status === "rejected") setAnalyticsError(String(results[1].reason?.message ?? "Network error."));
      setLoading(false);
    });
  }, []);

  const chartData = analytics
    ? analytics.revenueChart.map((d, i) => ({ ...d, label: i % 5 === 0 ? d.date.slice(5) : "" }))
    : [];

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Dashboard</h1>
        <p className="text-xs text-slate">
          {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-sm bg-surface" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-8">

          {kpisError && (
            <p className="rounded-sm border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{kpisError}</p>
          )}

          {kpis && (
            <>
              {/* Urgent attention — shown first, red if non-zero */}
              <Section title="Needs attention">
                <KpiCard
                  label="Admin review disputes"
                  value={String(kpis.disputes.adminReview)}
                  sub="Require final ruling"
                  href="/admin/disputes"
                  urgent={kpis.disputes.adminReview > 0}
                />
                <KpiCard
                  label="Ban evasion alerts"
                  value={String(kpis.banEvasionAlerts.pending)}
                  sub="Block seller activation"
                  href="/admin/ban-evasion-alerts"
                  urgent={kpis.banEvasionAlerts.pending > 0}
                />
                <KpiCard
                  label="Pending payouts"
                  value={String(kpis.payouts.pendingCount)}
                  sub={fmt(kpis.payouts.pendingAmount, kpis.payouts.currency)}
                  href="/admin/payouts"
                  urgent={kpis.payouts.pendingCount > 0}
                />
                <KpiCard
                  label="KYC submissions"
                  value={String(kpis.verifications.submittedDocs)}
                  sub="Documents awaiting review"
                  href="/admin/verifications"
                  urgent={kpis.verifications.submittedDocs > 0}
                />
              </Section>

              {/* Revenue */}
              <Section title="Revenue — last 30 days">
                <KpiCard
                  label="GMV"
                  value={fmt(kpis.revenue.gmv30Days, kpis.revenue.currency)}
                  sub="Gross merchandise value"
                />
                <KpiCard
                  label="Commission earned"
                  value={fmt(kpis.revenue.commissionEarned30Days, kpis.revenue.currency)}
                  sub="Platform's cut"
                  href="/admin/commission"
                />
                <KpiCard
                  label="Orders (30d)"
                  value={String(kpis.orders.last30Days)}
                  href="/admin/orders"
                />
                <KpiCard
                  label="Escrow held"
                  value={fmt(kpis.escrow.totalHeld, kpis.escrow.currency)}
                  sub={
                    kpis.escrow.totalFrozen > 0 || kpis.escrow.totalDisputed > 0
                      ? `+${fmt(kpis.escrow.totalFrozen, kpis.escrow.currency)} frozen · ${fmt(kpis.escrow.totalDisputed, kpis.escrow.currency)} disputed`
                      : "Normal"
                  }
                  href="/admin/escrow"
                />
              </Section>

              {/* Sellers */}
              <Section title="Sellers">
                <KpiCard label="Active" value={String(kpis.sellers.active)} href="/admin/sellers?status=active" />
                <KpiCard
                  label="Pending approval"
                  value={String(kpis.sellers.pendingApproval)}
                  href="/admin/sellers?status=pending_approval"
                  urgent={kpis.sellers.pendingApproval > 0}
                />
                <KpiCard label="Suspended" value={String(kpis.sellers.suspended)} href="/admin/sellers?status=suspended" />
                <KpiCard label="Banned" value={String(kpis.sellers.banned)} href="/admin/sellers?status=banned" />
              </Section>

              {/* Disputes */}
              <Section title="Disputes">
                <KpiCard label="Open" value={String(kpis.disputes.open)} href="/admin/disputes?status=open" />
                <KpiCard label="Seller review" value={String(kpis.disputes.sellerReview)} href="/admin/disputes?status=seller_review" />
                <KpiCard
                  label="Admin review"
                  value={String(kpis.disputes.adminReview)}
                  href="/admin/disputes?status=admin_review"
                  urgent={kpis.disputes.adminReview > 0}
                />
                <KpiCard label="Total orders" value={String(kpis.orders.total)} href="/admin/orders" />
              </Section>
            </>
          )}

          {analyticsError && (
            <p className="rounded-sm border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{analyticsError}</p>
          )}

          {analytics && (
            <>
              {/* Storefront alert cards (inventory / reviews) */}
              {(analytics.summary.lowStockProducts > 0 || analytics.summary.pendingReviews > 0) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {analytics.summary.lowStockProducts > 0 && (
                    <KpiCard
                      label="Low stock alert"
                      value={`${analytics.summary.lowStockProducts} products`}
                      sub="Click to manage inventory"
                      href="/admin/inventory"
                      urgent
                    />
                  )}
                  {analytics.summary.pendingReviews > 0 && (
                    <KpiCard
                      label="Pending reviews"
                      value={`${analytics.summary.pendingReviews} reviews`}
                      sub="Click to moderate"
                      href="/admin/reviews"
                      urgent
                    />
                  )}
                </div>
              )}

              {/* Revenue line chart */}
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate">Trends — last 30 days</h2>
                <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
                  <h3 className="mb-4 text-sm font-semibold text-cream">Revenue</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }}
                        labelStyle={{ color: "#c9a96e", fontSize: 12 }}
                        itemStyle={{ color: "#e5e7eb", fontSize: 12 }}
                        formatter={(v: number) => [`PKR ${v.toFixed(0)}`, "Revenue"]}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#c9a96e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {/* Orders per day bar chart */}
                <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
                  <h2 className="mb-4 text-sm font-semibold text-cream">Orders Per Day</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }}
                        itemStyle={{ color: "#e5e7eb", fontSize: 12 }}
                      />
                      <Bar dataKey="orders" fill="#c9a96e" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Orders by status pie */}
                <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
                  <h2 className="mb-4 text-sm font-semibold text-cream">Orders by Status</h2>
                  {analytics.ordersByStatus.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="50%" height={160}>
                        <PieChart>
                          <Pie
                            data={analytics.ordersByStatus}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                          >
                            {analytics.ordersByStatus.map((entry, i) => (
                              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }}
                            itemStyle={{ color: "#e5e7eb", fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-1.5">
                        {analytics.ordersByStatus.map((s, i) => (
                          <div key={s.status} className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ background: STATUS_COLORS[s.status] ?? PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                            <span className="text-xs text-slate capitalize">{s.status}</span>
                            <span className="ml-auto text-xs text-cream">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate">No orders yet.</p>
                  )}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {/* Top products */}
                <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
                  <h2 className="mb-4 text-sm font-semibold text-cream">Top Products</h2>
                  {analytics.topProducts.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {analytics.topProducts.map((p, i) => (
                        <div key={p.name} className="flex items-center gap-3">
                          <span className="w-4 text-xs text-slate/50">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm text-cream">{p.name}</p>
                          </div>
                          <span className="text-xs text-brass">{p.quantity} sold</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate">No sales yet.</p>
                  )}
                </div>

                {/* Latest orders */}
                <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-cream">Latest Orders</h2>
                    <Link href="/admin/orders" className="text-xs text-brass hover:underline">
                      View all
                    </Link>
                  </div>
                  {analytics.latestOrders.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {analytics.latestOrders.map((o) => (
                        <div key={o.id} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-brass">{o.orderNumber}</p>
                            <p className="text-xs text-slate truncate">{o.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-cream">PKR {o.total.toFixed(0)}</p>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-sm"
                              style={{
                                background: `${STATUS_COLORS[o.status]}33`,
                                color: STATUS_COLORS[o.status],
                              }}
                            >
                              {o.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate">No orders yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </AdminLayout>
  );
}