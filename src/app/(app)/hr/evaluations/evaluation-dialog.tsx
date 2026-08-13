"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField, SelectField, TextAreaField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { overallScore } from "@/lib/hr-calc";
import {
  createEvaluationAction,
  updateEvaluationAction,
} from "@/server/actions/hr-records";

type Criterion = { criterion: string; weight: string; score: string; comment: string };

export type EvaluationValues = {
  id: string;
  employeeId: string;
  evaluatorId: string;
  periodStart: string;
  periodEnd: string;
  summary: string | null;
  scores: Criterion[];
};

const BLANK: Criterion = { criterion: "", weight: "1", score: "", comment: "" };

export function EvaluationDialog({
  employees,
  evaluation,
  open: controlledOpen,
  onOpenChange,
}: {
  employees: { id: string; fullName: string; employeeNo: string }[];
  evaluation?: EvaluationValues | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange],
  );

  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const [criteria, setCriteria] = React.useState<Criterion[]>(
    evaluation?.scores.length ? evaluation.scores : [{ ...BLANK }],
  );

  // Previewed with the SAME function the server uses to store it.
  const preview = React.useMemo(
    () => overallScore(criteria.filter((c) => c.criterion && c.score)),
    [criteria],
  );

  function setRow(index: number, patch: Partial<Criterion>) {
    setCriteria((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const values = {
      employeeId: readString(fd, "employeeId"),
      evaluatorId: readString(fd, "evaluatorId"),
      periodStart: readString(fd, "periodStart"),
      periodEnd: readString(fd, "periodEnd"),
      summary: readString(fd, "summary"),
      // Blank rows are dropped rather than rejected — an empty last row is a
      // normal state of a form people add rows to.
      scores: criteria
        .filter((c) => c.criterion.trim() !== "" && c.score.trim() !== "")
        .map((c) => ({
          criterion: c.criterion,
          weight: c.weight || "1",
          score: c.score,
          comment: c.comment,
        })),
    };

    startTransition(async () => {
      const result = evaluation
        ? await updateEvaluationAction({ ...values, id: evaluation.id })
        : await createEvaluationAction(values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(evaluation ? "Evaluation updated." : "Evaluation recorded.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {!isControlled ? (
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus />
          Record evaluation
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>
                {evaluation ? "Edit evaluation" : "Record evaluation"}
              </DialogTitle>
              <DialogDescription>
                Weights are relative — they need not add up to 100. The overall score is
                their weighted average.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError ? (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
                >
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  name="employeeId"
                  label="Employee"
                  required
                  options={employees.map((e) => ({
                    value: e.id,
                    label: `${e.fullName} · ${e.employeeNo}`,
                  }))}
                  defaultValue={evaluation?.employeeId ?? ""}
                  errors={errors.employeeId}
                />
                <SelectField
                  name="evaluatorId"
                  label="Evaluator"
                  required
                  hint="Cannot be the same person."
                  options={employees.map((e) => ({
                    value: e.id,
                    label: `${e.fullName} · ${e.employeeNo}`,
                  }))}
                  defaultValue={evaluation?.evaluatorId ?? ""}
                  errors={errors.evaluatorId}
                />
                <DateField
                  name="periodStart"
                  label="Period start"
                  required
                  defaultValue={evaluation?.periodStart ?? ""}
                  errors={errors.periodStart}
                />
                <DateField
                  name="periodEnd"
                  label="Period end"
                  required
                  defaultValue={evaluation?.periodEnd ?? ""}
                  errors={errors.periodEnd}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Criteria</Label>
                  {preview ? (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Overall score: </span>
                      <span className="font-semibold tabular-nums">{preview}</span>
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {criteria.map((row, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_5rem_5rem_1fr_auto] items-center gap-2"
                    >
                      <Input
                        placeholder="Criterion"
                        value={row.criterion}
                        onChange={(e) => {
                          setRow(index, { criterion: e.target.value });
                        }}
                        aria-label={`Criterion ${String(index + 1)}`}
                      />
                      <Input
                        placeholder="Weight"
                        value={row.weight}
                        onChange={(e) => {
                          setRow(index, { weight: e.target.value });
                        }}
                        aria-label={`Weight ${String(index + 1)}`}
                        className="tabular-nums"
                      />
                      <Input
                        placeholder="Score"
                        value={row.score}
                        onChange={(e) => {
                          setRow(index, { score: e.target.value });
                        }}
                        aria-label={`Score ${String(index + 1)}`}
                        className="tabular-nums"
                      />
                      <Input
                        placeholder="Comment"
                        value={row.comment}
                        onChange={(e) => {
                          setRow(index, { comment: e.target.value });
                        }}
                        aria-label={`Comment ${String(index + 1)}`}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove criterion ${String(index + 1)}`}
                        disabled={criteria.length === 1}
                        onClick={() => {
                          setCriteria((rows) => rows.filter((_, i) => i !== index));
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCriteria((rows) => [...rows, { ...BLANK }]);
                  }}
                >
                  <Plus />
                  Add criterion
                </Button>
              </div>

              <TextAreaField
                name="summary"
                label="Summary"
                rows={4}
                defaultValue={evaluation?.summary ?? ""}
                errors={errors.summary}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : evaluation ? "Save changes" : "Record evaluation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
