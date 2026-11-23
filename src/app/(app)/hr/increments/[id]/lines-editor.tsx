"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  applyIncrement,
  formatAmount,
  incrementOf,
  parseAmount,
  SALARY_PARTS,
  sumBreakdowns,
  total,
  type Breakdown,
  type SalaryPart,
} from "@/lib/increments";
import { removeListLineAction, saveListLinesAction } from "@/server/actions/increments";

export type EditorLine = {
  id: string;
  employeeNo: string;
  name: string;
  sponsor: string;
  position: string;
  current: Breakdown;
  demanded: Breakdown;
  proposed: Breakdown;
};

type Side = "demanded" | "proposed";

type RowState = EditorLine & { incText: Record<Side, string> };

/** The increment as it reads in the box: blank for no change. */
const incDisplay = (current: Breakdown, next: Breakdown) => {
  const inc = incrementOf(current, next);
  return Number(inc) === 0 ? "" : String(Number(inc));
};

/** A stored "4200.00" shows as "4200" in an input. */
const plain = (v: string) => String(Number(v));
const plainAll = (b: Breakdown): Breakdown => ({
  basic: plain(b.basic),
  transport: plain(b.transport),
  housing: plain(b.housing),
  other: plain(b.other),
});

const toRow = (l: EditorLine): RowState => ({
  ...l,
  demanded: plainAll(l.demanded),
  proposed: plainAll(l.proposed),
  incText: {
    demanded: incDisplay(l.current, l.demanded),
    proposed: incDisplay(l.current, l.proposed),
  },
});

const PART_SHORT: Record<SalaryPart, string> = {
  basic: "Basic Salary",
  transport: "Transp. Allow.",
  housing: "Housing Allow.",
  other: "Mobile / Food",
};

export function LinesEditor({
  listId,
  lines,
  canManage,
}: {
  listId: string;
  lines: EditorLine[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<RowState[]>(() => lines.map(toRow));
  const [dirty, setDirty] = React.useState(false);
  const [saving, startSaving] = React.useTransition();

  const invalid = rows.some((r) =>
    (["demanded", "proposed"] as const).some(
      (side) =>
        parseAmount(r.incText[side].replace(/^-/, "")) === null ||
        SALARY_PARTS.some((p) => parseAmount(r[side][p]) === null),
    ),
  );

  function setIncrement(id: string, side: Side, text: string) {
    setDirty(true);
    setRows((current) =>
      current.map((r) => {
        if (r.id !== id) return r;
        const next = applyIncrement(r.current, r[side], text);
        return {
          ...r,
          incText: { ...r.incText, [side]: text },
          ...(next ? { [side]: { ...next, basic: plain(next.basic) } } : {}),
        };
      }),
    );
  }

  function setPart(id: string, side: Side, part: SalaryPart, text: string) {
    setDirty(true);
    setRows((current) =>
      current.map((r) => {
        if (r.id !== id) return r;
        const nextBreakdown = { ...r[side], [part]: text };
        const valid = SALARY_PARTS.every((p) => parseAmount(nextBreakdown[p]) !== null);
        return {
          ...r,
          [side]: nextBreakdown,
          incText: valid
            ? { ...r.incText, [side]: incDisplay(r.current, nextBreakdown) }
            : r.incText,
        };
      }),
    );
  }

  function onSave() {
    startSaving(async () => {
      const result = await saveListLinesAction({
        listId,
        lines: rows.map((r) => ({ id: r.id, demanded: r.demanded, proposed: r.proposed })),
      });
      if (!result.success) {
        toast.error(
          result.fieldErrors
            ? "Some amounts are not valid numbers. Fix the red boxes."
            : result.error,
        );
        return;
      }
      toast.success("Saved.");
      setDirty(false);
      router.refresh();
    });
  }

  function onRemove(row: RowState) {
    if (dirty) {
      toast.error("Save your changes first, then remove the employee.");
      return;
    }
    if (!window.confirm(`Remove ${row.employeeNo} — ${row.name} from this list?`)) return;
    startSaving(async () => {
      const result = await removeListLineAction({ id: row.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRows((current) => current.filter((r) => r.id !== row.id));
      toast.success("Removed.");
      router.refresh();
    });
  }

  const totals = {
    current: sumBreakdowns(rows.map((r) => r.current)),
    demanded: sumBreakdowns(rows.map((r) => r.demanded)),
    proposed: sumBreakdowns(rows.map((r) => r.proposed)),
  };

  const cell = "border px-1.5 py-1 text-right tabular-nums whitespace-nowrap";
  const input = (bad: boolean) =>
    `w-[4.75rem] rounded border bg-transparent px-1 py-0.5 text-right text-xs tabular-nums outline-none focus:ring-2 focus:ring-ring/50 ${
      bad ? "border-destructive" : "border-input"
    }`;

  function sideCells(r: RowState, side: Side) {
    const incBad = parseAmount(r.incText[side].replace(/^-/, "")) === null;
    return (
      <>
        <td className={`${cell} ${side === "demanded" ? "bg-inc-demand/40" : "bg-inc-propose/40"}`}>
          {canManage ? (
            <input
              aria-label={`${r.employeeNo} ${side} increment`}
              inputMode="decimal"
              value={r.incText[side]}
              onChange={(e) => {
                setIncrement(r.id, side, e.target.value);
              }}
              className={`${input(incBad)} font-semibold`}
            />
          ) : (
            formatAmount(incrementOf(r.current, r[side]), { dashForZero: false })
          )}
        </td>
        {SALARY_PARTS.map((p) => (
          <td key={p} className={cell}>
            {canManage ? (
              <input
                aria-label={`${r.employeeNo} ${side} ${p}`}
                inputMode="decimal"
                value={r[side][p]}
                onChange={(e) => {
                  setPart(r.id, side, p, e.target.value);
                }}
                className={input(parseAmount(r[side][p]) === null)}
              />
            ) : (
              formatAmount(r[side][p])
            )}
          </td>
        ))}
        <td className={`${cell} font-semibold`}>
          {SALARY_PARTS.every((p) => parseAmount(r[side][p]) !== null)
            ? formatAmount(total(r[side]))
            : "?"}
        </td>
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        No employees on this list yet. Use “Add employees”.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Type an increment and it is added to the basic salary; or change any column directly and
            the increment follows.
          </p>
          <div className="flex items-center gap-2">
            {dirty ? <span className="text-status-warning text-xs">Unsaved changes</span> : null}
            <Button size="sm" onClick={onSave} disabled={saving || invalid || !dirty}>
              <Save />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th rowSpan={2} className="border px-1.5 py-1">
                Sr
              </th>
              <th rowSpan={2} className="border px-1.5 py-1">
                Employee ID
              </th>
              <th rowSpan={2} className="border px-1.5 py-1 text-left">
                Name
              </th>
              <th rowSpan={2} className="border px-1.5 py-1">
                Sponsor
              </th>
              <th rowSpan={2} className="border px-1.5 py-1 text-left">
                Position
              </th>
              <th colSpan={5} className="bg-inc-current border px-1.5 py-1">
                CURRENT SALARY
              </th>
              <th colSpan={6} className="bg-inc-demand border px-1.5 py-1">
                NEW DEMANDED SALARY
              </th>
              <th colSpan={6} className="bg-inc-propose border px-1.5 py-1">
                NEW PROPOSED SALARY
              </th>
              {canManage ? <th rowSpan={2} className="border px-1.5 py-1" /> : null}
            </tr>
            <tr>
              {SALARY_PARTS.map((p) => (
                <th key={`c-${p}`} className="bg-inc-current border px-1.5 py-1 font-medium">
                  {PART_SHORT[p]}
                </th>
              ))}
              <th className="bg-inc-current border px-1.5 py-1">Total</th>
              {(["demanded", "proposed"] as const).map((side) => (
                <React.Fragment key={side}>
                  <th
                    className={`${side === "demanded" ? "bg-inc-demand" : "bg-inc-propose"} border px-1.5 py-1`}
                  >
                    Increment {side === "demanded" ? "Demand" : "Proposed"}
                  </th>
                  {SALARY_PARTS.map((p) => (
                    <th
                      key={`${side}-${p}`}
                      className={`${side === "demanded" ? "bg-inc-demand" : "bg-inc-propose"} border px-1.5 py-1 font-medium`}
                    >
                      {PART_SHORT[p]}
                    </th>
                  ))}
                  <th
                    className={`${side === "demanded" ? "bg-inc-demand" : "bg-inc-propose"} border px-1.5 py-1`}
                  >
                    Total
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="border px-1.5 py-1 text-center">{i + 1}</td>
                <td className="border px-1.5 py-1 text-center font-mono">{r.employeeNo}</td>
                <td className="border px-1.5 py-1 whitespace-nowrap">{r.name}</td>
                <td className="border px-1.5 py-1 text-center">{r.sponsor}</td>
                <td className="border px-1.5 py-1">{r.position}</td>
                {SALARY_PARTS.map((p) => (
                  <td key={p} className={cell}>
                    {formatAmount(r.current[p])}
                  </td>
                ))}
                <td className={`${cell} font-semibold`}>{formatAmount(total(r.current))}</td>
                {sideCells(r, "demanded")}
                {sideCells(r, "proposed")}
                {canManage ? (
                  <td className="border px-1 py-1 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label={`Remove ${r.employeeNo}`}
                      onClick={() => {
                        onRemove(r);
                      }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot className="font-semibold">
            <tr>
              <td colSpan={5} className="border px-1.5 py-1 text-right">
                Total Amount SR
              </td>
              {SALARY_PARTS.map((p) => (
                <td key={p} className={cell}>
                  {formatAmount(totals.current[p])}
                </td>
              ))}
              <td className={cell}>{formatAmount(total(totals.current))}</td>
              {(["demanded", "proposed"] as const).map((side) => (
                <React.Fragment key={side}>
                  <td className={`${cell} bg-inc-highlight`}>
                    {formatAmount(incrementOf(totals.current, totals[side]), {
                      dashForZero: false,
                    })}
                  </td>
                  {SALARY_PARTS.map((p) => (
                    <td key={p} className={cell}>
                      {formatAmount(totals[side][p])}
                    </td>
                  ))}
                  <td className={cell}>{formatAmount(total(totals[side]))}</td>
                </React.Fragment>
              ))}
              {canManage ? <td className="border" /> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
