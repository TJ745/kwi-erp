"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectField, TextField } from "@/components/forms/field";
import { readString } from "@/lib/form-data";
import { CHECKLIST_CATEGORIES, CHECKLIST_TYPES } from "@/lib/schemas/platform";
import {
  createChecklistTemplateAction,
  updateChecklistTemplateAction,
} from "@/server/actions/platform";

type Item = {
  label: string;
  category: string;
  requiresAttachment: boolean;
  requiresDate: boolean;
  defaultDueDays: string;
  responsibleDepartmentId: string;
};

export type TemplateValues = {
  id: string;
  key: string;
  name: string;
  type: string;
  companyId: string | null;
  isActive: boolean;
  items: Item[];
};

const BLANK: Item = {
  label: "",
  category: "HR",
  requiresAttachment: false,
  requiresDate: false,
  defaultDueDays: "",
  responsibleDepartmentId: "",
};

const NONE = "__none";

export function ChecklistTemplateForm({
  companies,
  departments,
  template,
}: {
  companies: { id: string; code: string; name: string }[];
  departments: { id: string; name: string; companyId: string }[];
  template?: TemplateValues | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const [items, setItems] = React.useState<Item[]>(
    template?.items.length ? template.items : [{ ...BLANK }],
  );
  const [isActive, setIsActive] = React.useState(template?.isActive ?? true);

  function setRow(index: number, patch: Partial<Item>) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  /** Order is the array order; the server renumbers from 1 on save. */
  function move(index: number, direction: -1 | 1) {
    setItems((rows) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      const a = next[index];
      const b = next[target];
      if (!a || !b) return rows;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const fd = new FormData(event.currentTarget);

    const payload = {
      key: readString(fd, "key"),
      name: readString(fd, "name"),
      type: readString(fd, "type"),
      companyId: readString(fd, "companyId"),
      isActive,
      items: items
        .filter((i) => i.label.trim() !== "")
        .map((i) => ({
          label: i.label,
          category: i.category,
          requiresAttachment: i.requiresAttachment,
          requiresDate: i.requiresDate,
          defaultDueDays: i.defaultDueDays,
          responsibleDepartmentId:
            i.responsibleDepartmentId === NONE ? "" : i.responsibleDepartmentId,
        })),
    };

    startTransition(async () => {
      const result = template
        ? await updateChecklistTemplateAction({ ...payload, id: template.id })
        : await createChecklistTemplateAction(payload);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) setFormError(result.error);
        return;
      }

      toast.success(template ? "Template updated." : "Template created.");
      router.push("/settings/checklists");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
        >
          {formError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="name"
          label="Template name"
          required
          defaultValue={template?.name ?? ""}
          errors={errors.name}
        />
        <TextField
          name="key"
          label="Key"
          required
          hint="Lowercase identifier used by seeds and automations."
          defaultValue={template?.key ?? ""}
          errors={errors.key}
        />
        <SelectField
          name="type"
          label="Type"
          required
          options={CHECKLIST_TYPES.map((t) => ({ value: t, label: t }))}
          defaultValue={template?.type ?? "ONBOARDING"}
          errors={errors.type}
        />
        <SelectField
          name="companyId"
          label="Company"
          placeholder="All companies"
          hint="Leave blank to share across both entities."
          options={companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          defaultValue={template?.companyId ?? ""}
          errors={errors.companyId}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isActive"
          checked={isActive}
          onCheckedChange={(checked) => {
            setIsActive(checked === true);
          }}
        />
        <Label htmlFor="isActive" className="font-normal">
          Active — available when starting a new checklist
        </Label>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Steps</h2>
          {errors.items?.[0] ? (
            <p className="text-destructive text-xs">{errors.items[0]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-6 pt-2 text-center text-xs tabular-nums">
                  {index + 1}
                </span>

                <Input
                  placeholder="What has to be done"
                  value={item.label}
                  onChange={(e) => {
                    setRow(index, { label: e.target.value });
                  }}
                  aria-label={`Step ${String(index + 1)} label`}
                />

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Move step ${String(index + 1)} up`}
                    disabled={index === 0}
                    onClick={() => {
                      move(index, -1);
                    }}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Move step ${String(index + 1)} down`}
                    disabled={index === items.length - 1}
                    onClick={() => {
                      move(index, 1);
                    }}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove step ${String(index + 1)}`}
                    disabled={items.length === 1}
                    onClick={() => {
                      setItems((rows) => rows.filter((_, i) => i !== index));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 pl-8 sm:grid-cols-4">
                <Select
                  value={item.category}
                  onValueChange={(v) => {
                    setRow(index, { category: v });
                  }}
                >
                  <SelectTrigger size="sm" aria-label={`Step ${String(index + 1)} category`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHECKLIST_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={item.responsibleDepartmentId || NONE}
                  onValueChange={(v) => {
                    setRow(index, { responsibleDepartmentId: v === NONE ? "" : v });
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Step ${String(index + 1)} responsible department`}
                  >
                    <SelectValue placeholder="Any department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Any department</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Due in N days"
                  value={item.defaultDueDays}
                  onChange={(e) => {
                    setRow(index, { defaultDueDays: e.target.value });
                  }}
                  className="h-8 tabular-nums"
                  aria-label={`Step ${String(index + 1)} due days`}
                />

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={item.requiresAttachment}
                      onCheckedChange={(checked) => {
                        setRow(index, { requiresAttachment: checked === true });
                      }}
                    />
                    File
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={item.requiresDate}
                      onCheckedChange={(checked) => {
                        setRow(index, { requiresDate: checked === true });
                      }}
                    />
                    Date
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setItems((rows) => [...rows, { ...BLANK }]);
          }}
        >
          <Plus />
          Add step
        </Button>
      </section>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : template ? "Save changes" : "Create template"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            router.push("/settings/checklists");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
