"use client";

import { useEffect, useState } from "react";
import { SellerLayout } from "@/components/seller/SellerLayout";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalUnitsSold: number;
    avgOrderValue: number;
    walletBalance: number;
    pendingEscrow: number;
  };
  revenueByDate: { date: string; revenue: number; orders: number }[];
  topProducts: { productName: string; unitsSold: number; revenue: number }[];
  fulfillmentBreakdown: { status: string; count: number }[];
}

export default function SellerAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");

  useEffect(() => {
    setLoading(true);
    const from = new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    fetch(`/api/sellers/analytics?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <SellerLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-charcoal">Analytics</h1>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="rounded-sm border border-ivoryBorder bg-white px-3 py-1.5 text-sm text-charcoal outline-none focus:border-gold"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading analytics…</p>
      ) : !data ? (
        <p className="text-sm text-red-500">Failed to load analytics.</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: "Total Revenue", value: `PKR ${(data.summary.totalRevenue ?? 0).toFixed(0)}` },
              { label: "Total Orders", value: data.summary.totalOrders ?? 0 },
              { label: "Units Sold", value: data.summary.totalUnitsSold ?? 0 },
              { label: "Avg Order Value", value: `PKR ${(data.summary.avgOrderValue ?? 0).toFixed(0)}` },
              { label: "Wallet Balance", value: `PKR ${(data.summary.walletBalance ?? 0).toFixed(0)}` },
              { label: "Pending Escrow", value: `PKR ${(data.summary.pendingEscrow ?? 0).toFixed(0)}` },
            ].map((card) => (
              <div key={card.label} className="rounded-sm border border-ivoryBorder bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-muted">{card.label}</p>
                <p className="mt-1 text-xl font-bold text-charcoal">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          <div className="mb-6 rounded-sm border border-ivoryBorder bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-charcoal">Revenue Over Time</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.revenueByDate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DC" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ border: "1px solid #E8E4DC", borderRadius: 4, fontSize: 12 }}
                  formatter={(v) => [`PKR ${Number(v).toFixed(0)}`, "Revenue"]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#B08D57" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Top products */}
            <div className="rounded-sm border border-ivoryBorder bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-charcoal">Top Products</h2>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-muted">No sales yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DC" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="productName" type="category" tick={{ fontSize: 10, fill: "#6B6B6B" }}
                      axisLine={false} tickLine={false} width={100} />
                    <Tooltip contentStyle={{ border: "1px solid #E8E4DC", borderRadius: 4, fontSize: 11 }} />
                    <Bar dataKey="unitsSold" fill="#B08D57" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Fulfillment breakdown */}
            <div className="rounded-sm border border-ivoryBorder bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-charcoal">Order Status Breakdown</h2>
              <div className="flex flex-col gap-3">
                {(data.fulfillmentBreakdown ?? []).map((row) => (
                  <div key={row.status} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-charcoal">{row.status}</span>
                    <span className="font-semibold text-gold">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </SellerLayout>
  );
}
