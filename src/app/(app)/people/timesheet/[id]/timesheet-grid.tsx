"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer, Save, Upload, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing";
import { extensionOf, maxBytesFor } from "@/lib/file-validation";
import {
  applyBrush,
  delayLabel,
  longOrdinal,
  monthLabel,
  rowSegments,
  rowTotals,
  weekendCode,
  type Brush,
  type DayCode,
  type Weekend,
} from "@/lib/timesheet";
import {
  addMissingRowsAction,
  attachSignedTimesheetAction,
  removeTimesheetRowAction,
  saveTimesheetAction,
} from "@/server/actions/timesheets";

export type GridRow = {
  employeeId: string;
  employeeNo: string;
  fullName: string;
  companyCode: string;
  joiningDate: string;
  lastWorkingDate: string | null;
  weekend: Weekend;
  days: DayCode[];
  extra: (number | null)[];
  /** SAR, typed on the sheet; non-Saudi sheets only. */
  foodAllowance: number | null;
};

const BRUSHES: { key: Brush; label: string; hint: string }[] = [
  { key: "TOGGLE", label: "P / A", hint: "Click a day to switch present ↔ absent" },
  { key: "V", label: "V", hint: "Vacation" },
  { key: "S", label: "S", hint: "Sick leave" },
  { key: "L", label: "L", hint: "Leave without pay" },
  { key: "OFF", label: "Day off", hint: "Back to the weekly day off" },
];

export const CODE_STYLE: Record<string, string> = {
  P: "",
  A: "bg-yellow-300 text-red-600 font-semibold",
  V: "bg-sky-100",
  S: "bg-sky-200",
  L: "bg-neutral-300",
  FRI: "bg-neutral-300 font-semibold",
  SAT: "bg-neutral-300 font-semibold",
};

/**
 * The monthly sheet, marked day by day. Every working day starts as P; a
 * click flips it to A (or applies the chosen mark). The row under each person
 * takes overtime hours — or delay minutes on a Saudi sheet.
 */
export function TimesheetGrid({
  sheet,
  rows: initialRows,
  canManage,
  canUpload,
  canDownload,
}: {
  sheet: {
    id: string;
    title: string;
    monthKey: string;
    group: string;
    days: string[];
    signedFileId: string | null;
    signedName: string | null;
    uploadCompanyId: string;
  };
  rows: GridRow[];
  canManage: boolean;
  canUpload: boolean;
  canDownload: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initialRows);
  const [brush, setBrush] = React.useState<Brush>("TOGGLE");
  const [dirty, setDirty] = React.useState(false);
  // Only the rows that changed are sent on save.
  const [changed, setChanged] = React.useState<Set<string>>(new Set());
  const touch = (employeeId: string) => {
    setChanged((prev) => (prev.has(employeeId) ? prev : new Set(prev).add(employeeId)));
    setDirty(true);
  };
  const [pending, startTransition] = React.useTransition();
  const saudi = sheet.group === "SAUDI";
  const dates = sheet.days.map((d) => new Date(`${d}T00:00:00Z`));

  // Unsaved marks are easy to lose on a sheet this size.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);

  function mark(r: number, d: number) {
    if (!canManage) return;
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[r]! };
      const off = weekendCode(dates[d]!, row.weekend);
      row.days = [...row.days];
      row.days[d] = applyBrush(row.days[d]!, brush, off);
      next[r] = row;
      return next;
    });
    touch(rows[r]!.employeeId);
  }

  function setExtra(r: number, d: number, value: string) {
    const n = value.trim() === "" ? null : Number(value);
    if (n !== null && (Number.isNaN(n) || n < 0)) return;
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[r]! };
      row.extra = [...row.extra];
      row.extra[d] = n;
      next[r] = row;
      return next;
    });
    touch(rows[r]!.employeeId);
  }

  function setFood(r: number, value: string) {
    const v = value.trim();
    const n = v === "" ? null : Number(v);
    if (n !== null && (Number.isNaN(n) || n < 0)) return;
    setRows((prev) => {
      const next = [...prev];
      next[r] = { ...next[r]!, foodAllowance: n };
      return next;
    });
    touch(rows[r]!.employeeId);
  }

  function setWeekend(r: number, weekend: Weekend) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[r]! };
      // Days that were the old day off follow the new pattern; marks stay.
      row.days = row.days.map((c, i) => {
        if (c !== "P" && c !== "FRI" && c !== "SAT") return c;
        return weekendCode(dates[i]!, weekend) ?? (c === "SAT" ? "P" : c);
      });
      row.weekend = weekend;
      next[r] = row;
      return next;
    });
    touch(rows[r]!.employeeId);
  }

  function save() {
    startTransition(async () => {
      const result = await saveTimesheetAction({
        id: sheet.id,
        rows: rows
          .filter((r) => changed.has(r.employeeId))
          .map((r) => ({
            employeeId: r.employeeId,
            weekend: r.weekend,
            days: r.days,
            extra: r.extra,
            foodAllowance: r.foodAllowance,
          })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Timesheet saved.");
      setDirty(false);
      router.refresh();
    });
  }

  function addMissing() {
    startTransition(async () => {
      const result = await addMissingRowsAction({ id: sheet.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.added === 0
          ? "Everyone is already on the sheet."
          : `Added ${String(result.data.added)} employee(s).`,
      );
      router.refresh();
    });
  }

  function removeRow(row: GridRow) {
    if (!window.confirm(`Remove ${row.fullName} from this sheet?`)) return;
    startTransition(async () => {
      const result = await removeTimesheetRowAction({ id: sheet.id, employeeId: row.employeeId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Row removed.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/people/timesheet">
              <ArrowLeft />
              Timesheets
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {sheet.title} — {monthLabel(sheet.monthKey)}
            </h1>
            <p className="text-muted-foreground text-xs">
              {sheet.days[0]} to {sheet.days[sheet.days.length - 1]} · {rows.length} employees
              {dirty ? " · unsaved changes" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <>
              <Button variant="outline" size="sm" disabled={pending} onClick={addMissing}>
                <UserPlus />
                Add missing employees
              </Button>
              <Button size="sm" disabled={pending || !dirty} onClick={save}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />}
                Save
              </Button>
            </>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/people/timesheet/${sheet.id}/print`}
              onClick={(e) => {
                if (dirty) {
                  e.preventDefault();
                  toast.error("Save the sheet before printing it.");
                }
              }}
            >
              <Printer />
              Print
            </Link>
          </Button>
          {canManage && canUpload ? (
            <SignedUpload sheetId={sheet.id} companyId={sheet.uploadCompanyId} />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {sheet.signedFileId ? (
          <span>
            Signed copy:{" "}
            {canDownload ? (
              <a href={`/api/files/${sheet.signedFileId}`} className="font-medium hover:underline">
                {sheet.signedName ?? "download"}
              </a>
            ) : (
              "uploaded"
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">No signed copy uploaded yet.</span>
        )}
        {canManage ? (
          <div
            className="flex flex-wrap items-center gap-1"
            role="radiogroup"
            aria-label="Mark with"
          >
            <span className="text-muted-foreground mr-1 text-xs">Mark with:</span>
            {BRUSHES.map((b) => (
              <button
                key={b.key}
                type="button"
                role="radio"
                aria-checked={brush === b.key}
                title={b.hint}
                onClick={() => {
                  setBrush(b.key);
                }}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs",
                  brush === b.key
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "hover:bg-accent",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="border-collapse text-xs">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="bg-muted sticky left-0 z-20 min-w-[16rem] border px-2 text-left">
                Employee
              </th>
              {dates.map((d, i) => (
                <th key={i} className="w-8 min-w-8 border px-0 text-center font-normal">
                  <span className="block text-[10px] text-red-600">{sheet.days[i]!.slice(8)}</span>
                  <span className="block text-[10px]">
                    {d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                  </span>
                </th>
              ))}
              {(saudi
                ? ["Work", "Abs", "Vac", "F&H", "Month", "Delay"]
                : ["Work", "Vac", "Abs", "F&H", "Month", "OT", "Food (SAR)"]
              ).map((h) => (
                <th key={h} className="border px-1 text-center font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const t = rowTotals(row.days, row.extra);
              const segments = rowSegments(row.days);
              return (
                <React.Fragment key={row.employeeId}>
                  <tr className="border-t-2">
                    <td className="bg-background sticky left-0 z-10 border px-2 py-0.5" rowSpan={2}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.fullName}</p>
                          <p className="text-muted-foreground font-mono">
                            {row.employeeNo} · {row.companyCode}
                          </p>
                        </div>
                        {canManage ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <select
                              aria-label={`Days off for ${row.fullName}`}
                              value={row.weekend}
                              onChange={(e) => {
                                setWeekend(r, e.target.value as Weekend);
                              }}
                              className="border-input h-6 rounded border bg-transparent text-[10px]"
                            >
                              <option value="FRI">Fri off</option>
                              <option value="FRI_SAT">Fri+Sat off</option>
                            </select>
                            <button
                              type="button"
                              aria-label={`Remove ${row.fullName}`}
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                removeRow(row);
                              }}
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    {segments.map((s) =>
                      s.kind === "gap" ? (
                        <td
                          key={`g${String(s.start)}`}
                          colSpan={s.length}
                          rowSpan={2}
                          className="border bg-yellow-200 px-1 text-center text-[11px] font-medium"
                        >
                          {s.before
                            ? `Joined: ${longOrdinal(new Date(`${row.joiningDate}T00:00:00Z`))}`
                            : row.lastWorkingDate
                              ? `Last Working Day: ${longOrdinal(new Date(`${row.lastWorkingDate}T00:00:00Z`))}`
                              : "Not employed"}
                        </td>
                      ) : (
                        <td key={s.index} className="border p-0">
                          <button
                            type="button"
                            aria-label={`${row.fullName} ${sheet.days[s.index]!}: ${row.days[s.index]!}`}
                            disabled={!canManage}
                            onClick={() => {
                              mark(r, s.index);
                            }}
                            className={cn(
                              "h-6 w-8 text-center text-[11px]",
                              CODE_STYLE[row.days[s.index]!],
                              canManage && "hover:ring-primary hover:ring-1",
                            )}
                          >
                            {row.days[s.index]}
                          </button>
                        </td>
                      ),
                    )}
                    <Total>{t.working}</Total>
                    <Total>{saudi ? t.absent : t.vacation}</Total>
                    <Total>{saudi ? t.vacation : t.absent}</Total>
                    <Total>{t.fridaysHolidays}</Total>
                    <Total>{t.monthDays}</Total>
                    <Total rowSpan={2}>{saudi ? delayLabel(t.extra) : t.extra}</Total>
                    {saudi ? null : (
                      <td rowSpan={2} className="border p-0">
                        <input
                          aria-label={`${row.fullName} food allowance (SAR)`}
                          inputMode="decimal"
                          disabled={!canManage}
                          value={row.foodAllowance ?? ""}
                          onChange={(e) => {
                            setFood(r, e.target.value);
                          }}
                          className="h-10 w-16 bg-transparent text-center text-xs outline-none focus:bg-white"
                        />
                      </td>
                    )}
                  </tr>
                  <tr>
                    {segments.map((s) =>
                      s.kind === "gap" ? null : (
                        <td
                          key={s.index}
                          className={cn(
                            "border p-0",
                            weekendCode(dates[s.index]!, row.weekend) && "bg-neutral-200",
                          )}
                        >
                          <input
                            aria-label={`${row.fullName} ${sheet.days[s.index]!} ${saudi ? "delay minutes" : "overtime hours"}`}
                            inputMode="decimal"
                            disabled={!canManage}
                            value={row.extra[s.index] ?? ""}
                            onChange={(e) => {
                              setExtra(r, s.index, e.target.value);
                            }}
                            className="h-5 w-8 bg-transparent text-center text-[10px] outline-none focus:bg-white"
                          />
                        </td>
                      ),
                    )}
                    <td className="border" colSpan={5} />
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        P present · A absent · V vacation · S sick · L leave without pay · FRI/SAT day off. The row
        under each name takes {saudi ? "delay in minutes" : "overtime hours"} per day.
      </p>
    </div>
  );
}

function Total({ children, rowSpan }: { children: React.ReactNode; rowSpan?: number }) {
  return (
    <td rowSpan={rowSpan} className="border px-1 text-center font-semibold tabular-nums">
      {children}
    </td>
  );
}

/** Uploads the signed, scanned sheet and attaches it to this timesheet. */
function SignedUpload({ sheetId, companyId }: { sheetId: string; companyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const { startUpload } = useUploadThing("documentUploader", {
    onClientUploadComplete: (result) => {
      const fileId = result[0]?.serverData?.fileId;
      if (!fileId) {
        setBusy(false);
        toast.error("The file uploaded but was not registered. Please try again.");
        return;
      }
      void attachSignedTimesheetAction({ id: sheetId, fileId }).then((r) => {
        setBusy(false);
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        toast.success("Signed copy uploaded.");
        router.refresh();
      });
    },
    onUploadError: (error) => {
      setBusy(false);
      toast.error(error.message);
    },
  });

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
        className="hidden"
        aria-label="Signed copy file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const ext = extensionOf(file.name);
          if (file.size > maxBytesFor(ext)) {
            toast.error("That file is too large.");
            return;
          }
          setBusy(true);
          void startUpload([file], { entityType: "COMPANY", entityId: companyId });
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => {
          input.current?.click();
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        Upload signed copy
      </Button>
    </>
  );
}
