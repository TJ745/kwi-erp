"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  STAFF_COMPETENCIES,
  STAFF_DEVELOPMENT_ROWS,
  STAFF_GOAL_ROWS,
  STAFF_TEXT,
  staffSuggestion,
  type StaffData,
} from "@/lib/evaluation-forms";
import { saveStaffEvaluationAction } from "@/server/actions/evaluations";

type Goal = StaffData["goals"][number];
type Dev = StaffData["development"][number];

const blankGoal = (): Goal => ({
  category: "",
  weight: "",
  deliverables: "",
  actionPlan: "",
  timeline: "",
  rating: "",
  results: "",
});
const blankDev = (): Dev => ({ area: "", observed: "", addressed: "" });

const pad = <T,>(rows: T[], n: number, blank: () => T) => [
  ...rows,
  ...Array.from({ length: Math.max(0, n - rows.length) }, blank),
];

const FIELD =
  "border-input focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-2 py-1 text-sm outline-none focus-visible:ring-2";

function Bi({ en, ar }: { en: string; ar: string }) {
  return (
    <span className="block leading-tight">
      <span className="block">{en}</span>
      {ar ? (
        <span dir="rtl" lang="ar" className="text-muted-foreground block text-xs">
          {ar}
        </span>
      ) : null}
    </span>
  );
}

export function StaffForm({
  evaluation,
  managers,
  canManage,
}: {
  evaluation: {
    id: string;
    evaluationDate: string;
    managerId: string | null;
    timeInPosition: string;
    pdpStarted: string;
    pdpCompleted: string;
    managerComments: string;
    employeeComments: string;
    finalRating: string;
    data: StaffData;
    employee: { name: string; employeeNo: string; position: string };
  };
  managers: { id: string; employeeNo: string; name: string; position: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(() => ({
    evaluationDate: evaluation.evaluationDate,
    managerId: evaluation.managerId ?? "",
    timeInPosition: evaluation.timeInPosition,
    pdpStarted: evaluation.pdpStarted,
    pdpCompleted: evaluation.pdpCompleted,
    managerComments: evaluation.managerComments,
    employeeComments: evaluation.employeeComments,
    finalRating: evaluation.finalRating,
  }));
  const [goals, setGoals] = React.useState(() =>
    pad(evaluation.data.goals, STAFF_GOAL_ROWS, blankGoal),
  );
  const [competencies, setCompetencies] = React.useState(evaluation.data.competencies);
  const [development, setDevelopment] = React.useState(() =>
    pad(evaluation.data.development, STAFF_DEVELOPMENT_ROWS, blankDev),
  );
  const [dirty, setDirty] = React.useState(false);
  const [saving, startSaving] = React.useTransition();

  const touch = () => {
    setDirty(true);
  };
  const manager = managers.find((m) => m.id === form.managerId);
  const data: StaffData = { goals, competencies, development };
  const suggestion = staffSuggestion(data);
  const weightTotal = goals.reduce((s, g) => s + (g.weight === "" ? 0 : Number(g.weight) || 0), 0);

  function setGoal(i: number, patch: Partial<Goal>) {
    touch();
    setGoals((rows) => rows.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  }
  function setDev(i: number, patch: Partial<Dev>) {
    touch();
    setDevelopment((rows) => rows.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  function onSave() {
    startSaving(async () => {
      const result = await saveStaffEvaluationAction({
        id: evaluation.id,
        ...form,
        // Blank rows are not stored: a row counts once anything is typed in it.
        data: {
          goals: goals.filter((g) => Object.values(g).some((v) => v.trim() !== "")),
          competencies,
          development: development.filter((d) => Object.values(d).some((v) => v.trim() !== "")),
        },
      });
      if (!result.success) {
        const first = result.fieldErrors ? Object.values(result.fieldErrors)[0]?.[0] : undefined;
        toast.error(first ?? result.error);
        return;
      }
      toast.success("Evaluation saved.");
      setDirty(false);
      router.refresh();
    });
  }

  const ro = !canManage;

  return (
    <div className="space-y-6">
      {canManage ? (
        <div className="bg-background/95 sticky top-0 z-10 flex items-center justify-end gap-2 py-2">
          {dirty ? <span className="text-status-warning text-xs">Unsaved changes</span> : null}
          <Button size="sm" onClick={onSave} disabled={saving || !dirty}>
            <Save />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}

      <section className="rounded-lg border">
        <h2 className="bg-eval-band text-eval-band-foreground flex justify-between rounded-t-lg px-3 py-2 text-sm font-semibold">
          <span>{STAFF_TEXT.title.en}</span>
          <span dir="rtl" lang="ar">
            {STAFF_TEXT.title.ar}
          </span>
        </h2>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label={STAFF_TEXT.employeeName} value={evaluation.employee.name} />
          <Info label={STAFF_TEXT.currentPosition} value={evaluation.employee.position || "—"} />
          <Info label={STAFF_TEXT.id} value={evaluation.employee.employeeNo} />
          <label className="space-y-1 text-sm">
            <Bi {...STAFF_TEXT.timeInPosition} />
            <input
              className={FIELD}
              value={form.timeInPosition}
              disabled={ro}
              onChange={(e) => {
                touch();
                setForm((f) => ({ ...f, timeInPosition: e.target.value }));
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <Bi {...STAFF_TEXT.managerName} />
            <select
              className={FIELD}
              value={form.managerId}
              disabled={ro}
              onChange={(e) => {
                touch();
                setForm((f) => ({ ...f, managerId: e.target.value }));
              }}
            >
              <option value="">— Choose the manager —</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.employeeNo}
                </option>
              ))}
            </select>
          </label>
          <Info
            label={STAFF_TEXT.managerPosition}
            value={manager ? `${manager.position || "—"} · ID ${manager.employeeNo}` : "—"}
          />
          <label className="space-y-1 text-sm">
            <Bi {...STAFF_TEXT.pdpStarted} />
            <input
              type="date"
              className={FIELD}
              value={form.pdpStarted}
              disabled={ro}
              onChange={(e) => {
                touch();
                setForm((f) => ({ ...f, pdpStarted: e.target.value }));
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <Bi {...STAFF_TEXT.pdpCompleted} />
            <input
              type="date"
              className={FIELD}
              value={form.pdpCompleted}
              disabled={ro}
              onChange={(e) => {
                touch();
                setForm((f) => ({ ...f, pdpCompleted: e.target.value }));
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <Bi en="Date of evaluation" ar="" />
            <input
              type="date"
              className={FIELD}
              value={form.evaluationDate}
              disabled={ro}
              onChange={(e) => {
                touch();
                setForm((f) => ({ ...f, evaluationDate: e.target.value }));
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border">
        <h2 className="bg-eval-band text-eval-band-foreground flex justify-between rounded-t-lg px-3 py-2 text-sm font-semibold">
          <span>{STAFF_TEXT.actionPlan.en}</span>
          <span dir="rtl" lang="ar">
            {STAFF_TEXT.actionPlan.ar}
          </span>
        </h2>
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <thead className="text-xs">
              <tr className="bg-eval-head">
                <th className="border p-1.5 font-medium">
                  <Bi {...STAFF_TEXT.goalsCategory} />
                </th>
                <th className="text-destructive w-20 border p-1.5 font-medium">Weight %</th>
                <th className="border p-1.5 font-medium">
                  <Bi {...STAFF_TEXT.deliverables} />
                </th>
                <th className="border p-1.5 font-medium">
                  <Bi {...STAFF_TEXT.successMeasures} />
                </th>
                <th className="w-28 border p-1.5 font-medium">
                  <Bi {...STAFF_TEXT.timeline} />
                </th>
                <th className="w-20 border p-1.5 font-medium">
                  <Bi {...STAFF_TEXT.rating} />
                </th>
                <th className="border p-1.5 font-medium">
                  <Bi {...STAFF_TEXT.results} />
                </th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g, i) => (
                <tr key={i} className="align-top">
                  <td className="border p-1">
                    <textarea
                      aria-label={`Goal ${String(i + 1)} category`}
                      rows={3}
                      className={FIELD}
                      value={g.category}
                      disabled={ro}
                      onChange={(e) => {
                        setGoal(i, { category: e.target.value });
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      aria-label={`Goal ${String(i + 1)} weight`}
                      inputMode="numeric"
                      className={FIELD}
                      value={g.weight}
                      disabled={ro}
                      onChange={(e) => {
                        setGoal(i, { weight: e.target.value });
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <textarea
                      aria-label={`Goal ${String(i + 1)} deliverables`}
                      rows={3}
                      className={FIELD}
                      value={g.deliverables}
                      disabled={ro}
                      onChange={(e) => {
                        setGoal(i, { deliverables: e.target.value });
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <textarea
                      aria-label={`Goal ${String(i + 1)} action plan`}
                      rows={3}
                      className={FIELD}
                      value={g.actionPlan}
                      disabled={ro}
                      onChange={(e) => {
                        setGoal(i, { actionPlan: e.target.value });
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      aria-label={`Goal ${String(i + 1)} timeline`}
                      className={FIELD}
                      value={g.timeline}
                      disabled={ro}
                      onChange={(e) => {
                        setGoal(i, { timeline: e.target.value });
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <input
                      aria-label={`Goal ${String(i + 1)} rating`}
                      className={FIELD}
                      value={g.rating}
                      disabled={ro}
                      onChange={(e) => {
                        setGoal(i, { rating: e.target.value });
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <textarea
                      aria-label={`Goal ${String(i + 1)} results`}
                      rows={3}
                      className={FIELD}
                      value={g.results}
                      disabled={ro}
                      onChange={(e) => {
                        setGoal(i, { results: e.target.value });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p
            className={`mt-1 px-1 text-xs ${weightTotal > 100 ? "text-destructive" : "text-muted-foreground"}`}
          >
            Weights total {weightTotal}% {weightTotal === 100 ? "✓" : "(should add up to 100%)"}
          </p>
        </div>
      </section>

      <section className="rounded-lg border">
        <h2 className="bg-eval-band text-eval-band-foreground flex justify-between gap-4 rounded-t-lg px-3 py-2 text-sm font-semibold">
          <span>{STAFF_TEXT.competencies.en}</span>
          <span dir="rtl" lang="ar">
            {STAFF_TEXT.competencies.ar}
          </span>
        </h2>
        <div className="grid gap-x-6 gap-y-2 p-3 lg:grid-cols-2">
          {STAFF_COMPETENCIES.map((c) => (
            <div
              key={c.key}
              className="grid grid-cols-[1fr_5rem] items-start gap-2 border-b pb-2 sm:grid-cols-[14rem_5rem_1fr]"
            >
              <Bi en={c.en} ar={c.ar} />
              <RatingSelect
                label={`${c.en} rating`}
                max={5}
                value={competencies[c.key].rating}
                disabled={ro}
                onChange={(v) => {
                  touch();
                  setCompetencies((all) => ({ ...all, [c.key]: { ...all[c.key], rating: v } }));
                }}
              />
              <input
                aria-label={`${c.en} comment`}
                placeholder="Comment"
                className={`${FIELD} col-span-2 sm:col-span-1`}
                value={competencies[c.key].comment}
                disabled={ro}
                onChange={(e) => {
                  touch();
                  const comment = e.target.value;
                  setCompetencies((all) => ({ ...all, [c.key]: { ...all[c.key], comment } }));
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border">
        <h2 className="bg-eval-band text-eval-band-foreground flex justify-between rounded-t-lg px-3 py-2 text-sm font-semibold">
          <span>{STAFF_TEXT.developmentPlan.en}</span>
          <span dir="rtl" lang="ar">
            {STAFF_TEXT.developmentPlan.ar}
          </span>
        </h2>
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead className="text-xs">
              <tr className="bg-eval-head">
                <th className="w-56 border p-1.5 font-medium">
                  <Bi {...STAFF_TEXT.developmentAreas} />
                </th>
                <th className="border p-1.5 font-medium">
                  <Bi {...STAFF_TEXT.observed} />
                </th>
                <th className="border p-1.5 font-medium">
                  <Bi {...STAFF_TEXT.addressed} />
                </th>
              </tr>
            </thead>
            <tbody>
              {development.map((d, i) => (
                <tr key={i} className="align-top">
                  <td className="border p-1">
                    <textarea
                      aria-label={`Development area ${String(i + 1)}`}
                      rows={2}
                      className={FIELD}
                      value={d.area}
                      disabled={ro}
                      onChange={(e) => {
                        setDev(i, { area: e.target.value });
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <textarea
                      aria-label={`Development ${String(i + 1)} observed`}
                      rows={2}
                      className={FIELD}
                      value={d.observed}
                      disabled={ro}
                      onChange={(e) => {
                        setDev(i, { observed: e.target.value });
                      }}
                    />
                  </td>
                  <td className="border p-1">
                    <textarea
                      aria-label={`Development ${String(i + 1)} addressed`}
                      rows={2}
                      className={FIELD}
                      value={d.addressed}
                      disabled={ro}
                      onChange={(e) => {
                        setDev(i, { addressed: e.target.value });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(["managerComments", "employeeComments"] as const).map((k) => (
        <section key={k} className="rounded-lg border">
          <h2 className="bg-eval-band text-eval-band-foreground flex justify-between rounded-t-lg px-3 py-2 text-sm font-semibold">
            <span>{STAFF_TEXT[k].en}</span>
            <span dir="rtl" lang="ar">
              {STAFF_TEXT[k].ar}
            </span>
          </h2>
          <div className="p-2">
            <textarea
              aria-label={STAFF_TEXT[k].en}
              rows={4}
              className={FIELD}
              value={form[k]}
              disabled={ro}
              onChange={(e) => {
                touch();
                const v = e.target.value;
                setForm((f) => ({ ...f, [k]: v }));
              }}
            />
          </div>
        </section>
      ))}

      <section className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
        <label className="space-y-1 text-sm">
          <Bi {...STAFF_TEXT.finalRating} />
          <input
            aria-label="Final rating"
            className={`${FIELD} w-40`}
            value={form.finalRating}
            disabled={ro}
            onChange={(e) => {
              touch();
              setForm((f) => ({ ...f, finalRating: e.target.value }));
            }}
          />
        </label>
        <p className="text-muted-foreground text-xs">
          Suggested: <strong className="text-foreground">{suggestion.overall ?? "—"}</strong> out of
          5 (goals by weight {suggestion.goals ?? "—"}, competencies average{" "}
          {suggestion.competencies ?? "—"}). Signatures are signed on the printed form.
        </p>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: { en: string; ar: string }; value: string }) {
  return (
    <div className="space-y-1 text-sm">
      <Bi {...label} />
      <p className="bg-muted/40 rounded-md px-2 py-1">{value}</p>
    </div>
  );
}

export function RatingSelect({
  label,
  max,
  value,
  disabled,
  onChange,
}: {
  label: string;
  max: number;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      className={FIELD}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      <option value="">–</option>
      {Array.from({ length: max }, (_, i) => String(i + 1)).map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
