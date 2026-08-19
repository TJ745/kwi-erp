"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * The two bar shapes this dashboard needs, and nothing else.
 *
 * Deliberately not a general charting wrapper: every option here is a decision
 * already made once, so a second chart cannot quietly pick different grid
 * weights or a different label rule.
 *
 * Colour is a design token, not a prop, so light and dark are handled by the
 * stylesheet rather than by JavaScript reading the theme.
 */

export type BarDatum = { label: string; count: number; href?: string };

const AXIS = "var(--chart-axis)";

/** Recharts needs a resolved colour; a CSS variable is fine as the value. */
const tokenFill = (index: number, total: number): string => {
  // Severity ramps run nearest-first, so index 0 is the darkest step.
  const step = Math.min(5, Math.max(1, Math.round(((index + 1) / total) * 5)));
  return `var(--chart-sev-${String(step)})`;
};

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { payload: BarDatum }[];
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{datum.label}</p>
      <p className="text-muted-foreground tabular-nums">
        {datum.count} {unit}
      </p>
    </div>
  );
}

/**
 * Vertical bars for an ordinal sequence (the expiry buckets).
 *
 * The x-axis already carries the ordering, so the single-hue ramp is
 * reinforcement rather than the only cue — which is what keeps it readable
 * without colour.
 */
export function OrdinalBars({
  data,
  unit = "items",
  height = 268,
}: {
  data: BarDatum[];
  unit?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: AXIS, fontSize: 11 }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: AXIS, fontSize: 11 }}
          width={40}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={<ChartTooltip unit={unit} />}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {/* A 2px surface gap between adjacent fills. */}
          {data.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={tokenFill(index, data.length)}
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
          <LabelList
            dataKey="count"
            position="top"
            className="fill-foreground"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Horizontal bars for magnitude by identity (departments, open work).
 *
 * One series, so one colour and no legend — the category labels sit on the
 * axis and carry identity on their own.
 */
export function CategoryBars({
  data,
  unit = "items",
  height,
}: {
  data: BarDatum[];
  unit?: string;
  height?: number;
}) {
  // Height follows the row count so bars keep a constant thickness instead of
  // stretching to fill a fixed box.
  const computed = height ?? Math.max(140, data.length * 34 + 16);

  return (
    <ResponsiveContainer width="100%" height={computed}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 32, bottom: 4, left: 4 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: AXIS, fontSize: 11 }}
          width={112}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={<ChartTooltip unit={unit} />}
        />
        <Bar
          dataKey="count"
          fill="var(--chart-bar)"
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
        >
          <LabelList
            dataKey="count"
            position="right"
            className="fill-foreground"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
