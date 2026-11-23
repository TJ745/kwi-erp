"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PROGRESS_MARKS,
  progressMarksReached,
  SUMMARY_BOXES,
  summaryBoxOf,
  WORKER_CRITERIA,
  WORKER_SCALE,
  workerResult,
  type WorkerData,
} from "@/lib/evaluation-forms";
import { saveWorkerEvaluationAction } from "@/server/actions/evaluations";
import { RatingSelect } from "./staff-form";

const FIELD =
  "border-input focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-2 py-1 text-sm outline-none focus-visible:ring-2";

export function WorkerForm({
  evaluation,
  canManage,
}: {
  evaluation: {
    id: string;
    evaluationDate: string;
    section: string;
    data: WorkerData;
    employee: {
      name: string;
      employeeNo: string;
      position: string;
      department: string;
      joiningDate: string;
    };
  };
  canManage: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = React.useState(evaluation.evaluationDate);
  const [section, setSection] = React.useState(evaluation.section);
  const [scores, setScores] = React.useState(evaluation.data.scores);
  const [dirty, setDirty] = React.useState(false);
  const [saving, startSaving] = React.useTransition();
  const ro = !canManage;

  const result = workerResult({ scores });
  const reached = progressMarksReached(result);
  const box = summaryBoxOf(result);

  function onSave() {
    startSaving(async () => {
      const r = await saveWorkerEvaluationAction({
        id: evaluation.id,
        evaluationDate: date,
        section,
        data: { scores },
      });
      if (!r.success) {
        const first = r.fieldErrors ? Object.values(r.fieldErrors)[0]?.[0] : undefined;
        toast.error(first ?? r.error);
        return;
      }
      toast.success("Appraisal saved.");
      setDirty(false);
      router.refresh();
    });
  }

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

      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Department" value={evaluation.employee.department || "—"} />
        <Info label="Name of employee" value={evaluation.employee.name} />
        <Info label="Position" value={evaluation.employee.position || "—"} />
        <label className="space-y-1 text-sm">
          <span className="font-medium">Section</span>
          <input
            aria-label="Section"
            className={FIELD}
            value={section}
            disabled={ro}
            onChange={(e) => {
              setDirty(true);
              setSection(e.target.value);
            }}
          />
        </label>
        <Info label="Employee no." value={evaluation.employee.employeeNo} />
        <Info label="Date of joining" value={evaluation.employee.joiningDate} />
        <label className="space-y-1 text-sm">
          <span className="font-medium">Date of evaluation</span>
          <input
            type="date"
            aria-label="Date of evaluation"
            className={FIELD}
            value={date}
            disabled={ro}
            onChange={(e) => {
              setDirty(true);
              setDate(e.target.value);
            }}
          />
        </label>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Scores — 1 (lowest) to 10 (highest)</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {WORKER_CRITERIA.map((c) => (
              <div
                key={c.key}
                className="grid grid-cols-[1fr_5rem] items-center gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-semibold">{c.title}</p>
                  <p className="text-muted-foreground text-xs">{c.text}</p>
                </div>
                <RatingSelect
                  label={`${c.title} score`}
                  max={10}
                  value={scores[c.key]}
                  disabled={ro}
                  onChange={(v) => {
                    setDirty(true);
                    setScores((s) => ({ ...s, [c.key]: v }));
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-md border border-dashed p-3 text-xs">
            {WORKER_SCALE.map((s) => (
              <p key={s.label} className="grid grid-cols-[6rem_1fr]">
                <span className="font-semibold">{s.label}</span>
                <span>{s.points}</span>
              </p>
            ))}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              Result:{" "}
              <span aria-label="Result">{result === null ? "—" : `${String(result)}%`}</span>
            </p>
            <div className="bg-eval-meter grid grid-cols-10 rounded border">
              {PROGRESS_MARKS.map((m, i) => (
                <span
                  key={m}
                  className={`h-4 border-r last:border-r-0 ${i < reached ? "bg-eval-meter-fill" : ""}`}
                />
              ))}
            </div>
            <div className="text-muted-foreground grid grid-cols-10 text-[10px]">
              {PROGRESS_MARKS.map((m) => (
                <span key={m} className="text-center">
                  {m}%
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-center text-xs font-semibold">PERFORMANCE RESULT SUMMARY</p>
            <div className="grid grid-cols-4 overflow-hidden rounded border text-center text-sm">
              {SUMMARY_BOXES.map((b) => (
                <div key={b.box} className="bg-eval-summary border-r last:border-r-0">
                  <p className="text-muted-foreground text-[10px]">{b.label}</p>
                  <p className="py-1 font-semibold tabular-nums">
                    {b.box === box && result !== null ? `${String(result)}%` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <p className="bg-muted/40 rounded-md px-2 py-1">{value}</p>
    </div>
  );
}
