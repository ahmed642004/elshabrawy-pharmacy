"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { WeekBar } from "@/lib/admin-stats";
import { formatEGP } from "@/lib/cart-totals";

// The one client-island in Overview — recharts needs the browser to measure
// and render the SVG; everything else in Overview stays a server component.
export default function RevenueBarChart({ bars }: { bars: WeekBar[] }) {
  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--color-neutral-100)" }}
            formatter={(value) => [formatEGP(Number(value)), "Revenue"]}
            labelFormatter={() => ""}
            contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid var(--color-neutral-200)" }}
          />
          <Bar dataKey="value" radius={[6, 6, 2, 2]} fill="var(--color-primary-500)" maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
