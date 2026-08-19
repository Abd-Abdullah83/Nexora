"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface AnalyticsData {
  summary: {
    totalOrders: number; totalRevenue: number; totalCustomers: number;
    totalProducts: number; recentOrders: number; lowStockProducts: number;
    pendingReviews: number;
  };
  revenueChart: { date: string; orders: number; revenue: number }[];
  ordersByStatus: { status: string; count: number }[];
  topProducts: { name: string; quantity: number }[];
  latestOrders: {
    id: string; orderNumber: string; customerName: string; total: number;
    status: string; paymentStatus: string; createdAt: string;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b", confirmed: "#3b82f6", shipped: "#8b5cf6",
  delivered: "#10b981", cancelled: "#ef4444", refunded: "#6b7280",
};
const PIE_COLORS = ["#c9a96e", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#6b7280"];

function downloadCSV(type: string) {
  const url = `/api/admin/export?type=${type}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `nexora-${type}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function StatCard({ label, value, sub, alert }: {
  label: string; value: string | number; sub?: string; alert?: boolean;
}) {
  return (
    <div className={`rounded-sm border p-5 ${alert ? "border-red-500/30 bg-red-500/10" : "border-white/[0.08] bg-surface"}`}>
      <p className="text-xs uppercase tracking-wider text-slate/60">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? "text-red-400" : "text-cream"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate/60">{sub}</p>}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLayout><p className="text-sm text-slate">Loading analytics...</p></AdminLayout>;
  if (!data) return <AdminLayout><p className="text-sm text-red-400">Failed to load analytics.</p></AdminLayout>;

  const { summary, revenueChart, ordersByStatus, topProducts, latestOrders } = data;

  const chartData = revenueChart.map((d, i) => ({
    ...d,
    label: i % 5 === 0 ? d.date.slice(5) : "",
  }));

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-cream">Analytics</h1>
          <p className="text-xs text-slate/60 mt-1">Last 30 days</p>
        </div>

        {/* CSV Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-2 rounded-sm border border-brass/40 px-4 py-2 text-sm text-brass transition hover:bg-brass/10"
          >
            ↓ Export CSV
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-10 z-10 w-44 rounded-sm border border-white/10 bg-surface shadow-lg">
              {[
                { label: "Export Orders", type: "orders" },
                { label: "Export Products", type: "products" },
                { label: "Export Customers", type: "customers" },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => { downloadCSV(item.type); setExportOpen(false); }}
                  className="flex w-full items-center px-4 py-2.5 text-left text-sm text-slate transition hover:bg-white/[0.05] hover:text-cream"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Revenue" value={`PKR ${summary.totalRevenue.toFixed(0)}`} sub="From paid orders" />
        <StatCard label="Total Orders" value={summary.totalOrders} sub={`+${summary.recentOrders} this week`} />
        <StatCard label="Customers" value={summary.totalCustomers} />
        <StatCard label="Active Products" value={summary.totalProducts} />
      </div>

      {/* Alert cards */}
      {(summary.lowStockProducts > 0 || summary.pendingReviews > 0) && (
        <div className="mb-8 grid grid-cols-2 gap-4">
          {summary.lowStockProducts > 0 && (
            <Link href="/admin/inventory">
              <StatCard label="Low Stock Alert" value={`${summary.lowStockProducts} products`} sub="Click to manage" alert />
            </Link>
          )}
          {summary.pendingReviews > 0 && (
            <Link href="/admin/reviews">
              <StatCard label="Pending Reviews" value={`${summary.pendingReviews} reviews`} sub="Click to moderate" alert />
            </Link>
          )}
        </div>
      )}

      {/* Revenue chart */}
      <div className="mb-6 rounded-sm border border-white/[0.08] bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-cream">Revenue — Last 30 Days</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }} formatter={(v: number) => [`PKR ${v.toFixed(0)}`, "Revenue"]} />
            <Line type="monotone" dataKey="revenue" stroke="#c9a96e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Orders Per Day</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }} />
              <Bar dataKey="orders" fill="#c9a96e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Orders by Status</h2>
          {ordersByStatus.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {ordersByStatus.map((entry, i) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5">
                {ordersByStatus.map((s, i) => (
                  <div key={s.status} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: STATUS_COLORS[s.status] ?? PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs capitalize text-slate">{s.status}</span>
                    <span className="ml-auto text-xs text-cream">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-slate">No orders yet.</p>}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Top Products</h2>
          {topProducts.length > 0 ? (
            <div className="flex flex-col gap-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-slate/50">{i + 1}</span>
                  <p className="flex-1 truncate text-sm text-cream">{p.name}</p>
                  <span className="text-xs text-brass">{p.quantity} sold</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate">No sales yet.</p>}
        </div>

        <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-cream">Latest Orders</h2>
            <Link href="/admin/orders" className="text-xs text-brass hover:underline">View all</Link>
          </div>
          {latestOrders.length > 0 ? (
            <div className="flex flex-col gap-3">
              {latestOrders.map((o) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-3 hover:opacity-80 transition">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-brass">{o.orderNumber}</p>
                    <p className="truncate text-xs text-slate">{o.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-cream">PKR {o.total.toFixed(0)}</p>
                    <span className="text-[10px] rounded-sm px-1.5 py-0.5" style={{ background: `${STATUS_COLORS[o.status]}33`, color: STATUS_COLORS[o.status] }}>
                      {o.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-slate">No orders yet.</p>}
        </div>
      </div>
    </AdminLayout>
  );
}
