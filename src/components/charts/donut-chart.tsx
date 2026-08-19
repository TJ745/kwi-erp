"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type Slice = { label: string; count: number };

/**
 * Part-to-whole, capped at five slices.
 *
 * A pie is only honest for part-to-whole read at a glance, with few segments —
 * it is the wrong form for comparing close values, which is why anything past
 * the top four folds into "Other" rather than becoming a sliver. The total
 * lives in the middle because that is the number people actually want.
 *
 * The palette is four validated categorical slots plus muted ink for "Other".
 * Six hues were tried first and could not clear the colour-blindness floor at
 * any lightness: the slots vary in lightness as well as hue, because lightness
 * is what survives CVD. Both validated slots carry a contrast warning against
 * their surface, which obliges visible labels — so every slice is labelled and
 * a legend is always present. Identity is never colour alone here.
 */
const SLOT = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
] as const;
const OTHER = "var(--chart-cat-other)";

const MAX_NAMED = 4;

export function foldToSlices(rows: readonly Slice[]): Slice[] {
  if (rows.length <= MAX_NAMED + 1) return [...rows];

  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const named = sorted.slice(0, MAX_NAMED);
  const rest = sorted.slice(MAX_NAMED).reduce((sum, r) => sum + r.count, 0);

  return rest > 0 ? [...named, { label: "Other", count: rest }] : named;
}

function SliceTooltip({
  active,
  payload,
  total,
  unit,
}: {
  active?: boolean;
  payload?: { payload: Slice }[];
  total: number;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{d.label}</p>
      <p className="text-muted-foreground tabular-nums">
        {d.count} {unit} · {pct}%
      </p>
    </div>
  );
}

export function DonutChart({
  data,
  unit = "items",
  centreLabel = "Total",
}: {
  data: readonly Slice[];
  unit?: string;
  centreLabel?: string;
}) {
  const slices = foldToSlices(data);
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const colourOf = (label: string, index: number) =>
    label === "Other" ? OTHER : (SLOT[index] ?? OTHER);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-[188px] w-[188px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="label"
              innerRadius={58}
              outerRadius={90}
              // A 2px surface gap between adjacent fills, as with stacked bars.
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s, i) => (
                <Cell key={s.label} fill={colourOf(s.label, i)} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip total={total} unit={unit} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* The number people actually want, in the hole the donut leaves. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-muted-foreground text-xs">{centreLabel}</span>
        </div>
      </div>

      {/* Always present, and carrying the value — so identity and magnitude
          both survive without colour. */}
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s, i) => {
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: colourOf(s.label, i) }}
              />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="tabular-nums">{s.count}</span>
              <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
