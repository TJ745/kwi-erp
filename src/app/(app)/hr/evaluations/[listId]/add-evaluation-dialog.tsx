"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
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
import {
  EVALUATION_TEMPLATES,
  TEMPLATE_LABELS,
  type EvaluationTemplate,
} from "@/lib/evaluation-forms";
import { addEvaluationAction } from "@/server/actions/evaluations";

export type EvaluableEmployee = {
  id: string;
  employeeNo: string;
  name: string;
  company: string;
  position: string;
};

/** Pick one employee and the form to evaluate them on; the form opens next. */
export function AddEvaluationDialog({
  listId,
  listDate,
  employees,
}: {
  listId: string;
  listDate: string;
  employees: EvaluableEmployee[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState<string | null>(null);
  const [template, setTemplate] = React.useState<EvaluationTemplate>("STAFF");
  const [date, setDate] = React.useState(listDate);
  const [pending, startTransition] = React.useTransition();

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? employees.filter((e) =>
          [e.employeeNo, e.name, e.company, e.position].some((v) => v.toLowerCase().includes(q)),
        )
      : employees;
    return list.slice(0, 200);
  }, [employees, query]);

  function onAdd() {
    if (!employeeId) return;
    startTransition(async () => {
      const result = await addEvaluationAction({
        listId,
        employeeId,
        template,
        evaluationDate: date,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.push(`/hr/evaluations/${listId}/${result.data.id}`);
    });
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setOpen(true);
          setEmployeeId(null);
          setQuery("");
        }}
      >
        <UserPlus />
        Add employee
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evaluate an employee</DialogTitle>
            <DialogDescription>
              Choose the employee and the form. Their details fill in automatically; the form opens
              to fill in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Form</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {EVALUATION_TEMPLATES.map((t) => (
                  <label
                    key={t}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm ${
                      template === t ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={t}
                      checked={template === t}
                      onChange={() => {
                        setTemplate(t);
                      }}
                    />
                    {TEMPLATE_LABELS[t]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="evaluation-date">Date of evaluation</Label>
              <Input
                id="evaluation-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                }}
                className="w-48"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evaluation-search">Employee</Label>
              <Input
                id="evaluation-search"
                placeholder="Search ID, name, company or position…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
              />
              <div className="max-h-[38vh] overflow-y-auto rounded-md border">
                {shown.length === 0 ? (
                  <p className="text-muted-foreground p-6 text-center text-sm">
                    {employees.length === 0
                      ? "Everyone you can see is already on this list."
                      : "No employees match."}
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {shown.map((e) => (
                        <tr
                          key={e.id}
                          className={`hover:bg-muted/40 cursor-pointer border-t first:border-t-0 ${
                            employeeId === e.id ? "bg-primary/10" : ""
                          }`}
                          onClick={() => {
                            setEmployeeId(e.id);
                          }}
                        >
                          <td className="w-8 px-3 py-1.5">
                            <input
                              type="radio"
                              name="employee"
                              checked={employeeId === e.id}
                              onChange={() => {
                                setEmployeeId(e.id);
                              }}
                              aria-label={`Choose ${e.employeeNo} ${e.name}`}
                            />
                          </td>
                          <td className="px-2 py-1.5 font-mono text-xs">{e.employeeNo}</td>
                          <td className="px-2 py-1.5">{e.name}</td>
                          <td className="text-muted-foreground px-2 py-1.5 text-xs">{e.company}</td>
                          <td className="text-muted-foreground px-2 py-1.5 text-xs">
                            {e.position}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={onAdd} disabled={pending || !employeeId || !date}>
              {pending ? "Opening…" : "Open the form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
