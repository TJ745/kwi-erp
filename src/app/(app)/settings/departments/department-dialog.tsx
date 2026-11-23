"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { createDepartmentAction, updateDepartmentAction } from "@/server/actions/org";

type Company = { id: string; code: string; name: string };
type Parent = { id: string; name: string; companyId: string };
type Employee = { id: string; fullName: string; employeeNo: string; companyId: string };

export function DepartmentDialog({
  mode,
  companies,
  parents,
  employees,
  department,
}: {
  mode: "create" | "edit";
  companies: Company[];
  parents: Parent[];
  employees: Employee[];
  department?: {
    id: string;
    code: string;
    name: string;
    companyId: string;
    parentId: string | null;
    headEmployeeId: string | null;
    status: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [companyId, setCompanyId] = React.useState(department?.companyId ?? companies[0]?.id ?? "");

  // A parent must be in the same company, and a department cannot parent itself.
  const parentChoices = parents.filter((p) => p.companyId === companyId && p.id !== department?.id);

  // A department head can be an employee of any company.
  const headChoices = employees;
  const codeOf = (id: string) => {
    const code = companies.find((c) => c.id === id)?.code;
    return code ? ` · ${code}` : "";
  };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    const payload = {
      companyId,
      code: readString(fd, "code").toUpperCase(),
      name: readString(fd, "name"),
      parentId: readString(fd, "parentId"),
      headEmployeeId: readString(fd, "headEmployeeId"),
      status: readString(fd, "status") || "ACTIVE",
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createDepartmentAction(payload)
          : await updateDepartmentAction({ ...payload, id: department?.id ?? "" });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Department created." : "Department updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size={mode === "create" ? "sm" : "icon-sm"}
        variant={mode === "create" ? "default" : "ghost"}
        aria-label={mode === "edit" ? `Edit ${department?.name ?? ""}` : undefined}
        onClick={() => {
          setOpen(true);
        }}
      >
        {mode === "create" ? (
          <>
            <Plus />
            Add department
          </>
        ) : (
          <Pencil />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add department" : "Edit department"}</DialogTitle>
            <DialogDescription>
              The code must be unique within its company. Nesting is optional.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="dept-company" className="text-sm font-medium">
                Company <span className="text-destructive">*</span>
              </label>
              <select
                id="dept-company"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                }}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              {errors.companyId ? (
                <p className="text-destructive text-xs">{errors.companyId[0]}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="code"
                label="Code"
                required
                defaultValue={department?.code ?? ""}
                errors={errors.code}
              />
              <TextField
                name="name"
                label="Name"
                required
                defaultValue={department?.name ?? ""}
                errors={errors.name}
              />
            </div>

            <SelectField
              name="parentId"
              label="Parent department"
              defaultValue={department?.parentId ?? "none"}
              options={[
                { value: "none", label: "— None (top level) —" },
                ...parentChoices.map((p) => ({ value: p.id, label: p.name })),
              ]}
              errors={errors.parentId}
            />

            <SelectField
              name="headEmployeeId"
              label="Department head"
              hint="An employee of any company."
              defaultValue={department?.headEmployeeId ?? "none"}
              options={[
                { value: "none", label: "— Not set —" },
                ...headChoices.map((e) => ({
                  value: e.id,
                  label: `${e.fullName} (${e.employeeNo}${codeOf(e.companyId)})`,
                })),
              ]}
              errors={errors.headEmployeeId}
            />

            <SelectField
              name="status"
              label="Status"
              defaultValue={department?.status ?? "ACTIVE"}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
                { value: "ARCHIVED", label: "Archived" },
              ]}
              errors={errors.status}
            />

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
                {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
