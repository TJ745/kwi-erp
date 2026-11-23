"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addListEmployeesAction } from "@/server/actions/increments";

export type PickableEmployee = {
  id: string;
  employeeNo: string;
  name: string;
  company: string;
  position: string;
  status: string;
  hasSalary: boolean;
};

/** Pick several employees at once; their current salary fills in on add. */
export function AddEmployeesDialog({
  listId,
  employees,
}: {
  listId: string;
  employees: PickableEmployee[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.employeeNo, e.name, e.company, e.position].some((v) => v.toLowerCase().includes(q)),
    );
  }, [employees, query]);

  const allShownPicked = shown.length > 0 && shown.every((e) => picked.has(e.id));

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllShown() {
    setPicked((current) => {
      const next = new Set(current);
      for (const e of shown) {
        if (allShownPicked) next.delete(e.id);
        else next.add(e.id);
      }
      return next;
    });
  }

  function onAdd() {
    startTransition(async () => {
      const result = await addListEmployeesAction({ listId, employeeIds: [...picked] });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const { added, withoutSalary } = result.data;
      toast.success(
        `Added ${String(added)} employee${added === 1 ? "" : "s"}.${
          withoutSalary > 0
            ? ` ${String(withoutSalary)} had no salary on record, so their current salary shows as 0.`
            : ""
        }`,
      );
      setOpen(false);
      setPicked(new Set());
      setQuery("");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <UserPlus />
        Add employees
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add employees</DialogTitle>
            <DialogDescription>
              Tick the employees to add. Their current salary is copied from their employee record;
              demanded and proposed start the same as current.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Search ID, name, company or position…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              aria-label="Search employees"
            />
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allShownPicked}
                  onChange={toggleAllShown}
                  aria-label="Select all shown"
                />
                Select all shown ({shown.length})
              </label>
              <span className="text-muted-foreground">{picked.size} selected</span>
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border">
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
                      <tr key={e.id} className="hover:bg-muted/40 border-t first:border-t-0">
                        <td className="w-8 px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={picked.has(e.id)}
                            onChange={() => {
                              toggle(e.id);
                            }}
                            aria-label={`Select ${e.employeeNo} ${e.name}`}
                          />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs">{e.employeeNo}</td>
                        <td className="px-2 py-1.5">
                          {e.name}
                          {e.status !== "ACTIVE" ? (
                            <span className="text-muted-foreground ml-1 text-xs">
                              ({e.status.replace(/_/g, " ").toLowerCase()})
                            </span>
                          ) : null}
                        </td>
                        <td className="text-muted-foreground px-2 py-1.5 text-xs">{e.company}</td>
                        <td className="text-muted-foreground px-2 py-1.5 text-xs">{e.position}</td>
                        <td className="px-2 py-1.5 text-right text-xs">
                          {e.hasSalary ? null : (
                            <span className="text-status-warning">no salary</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
            <Button onClick={onAdd} disabled={pending || picked.size === 0}>
              {pending
                ? "Adding…"
                : `Add ${String(picked.size)} employee${picked.size === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
