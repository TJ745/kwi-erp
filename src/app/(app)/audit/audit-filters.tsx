"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ANY = "__any";

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "ASSIGN",
  "RETURN",
  "UPLOAD",
  "DOWNLOAD",
  "EXPORT",
  "VIEW",
  "LOGIN",
] as const;

const ENTITIES = [
  "EMPLOYEE",
  "COMPANY",
  "VEHICLE",
  "IT_ASSET",
  "CREDENTIAL",
  "GENERATED_LETTER",
  "PETTY_CASH_TRANSACTION",
  "USER",
  "ROLE",
] as const;

/** Filters live in the URL so a filtered investigation is shareable. */
export function AuditFilters({
  actors,
  current,
}: {
  actors: { id: string; label: string }[];
  current: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === ANY) params.delete(key);
      else params.set(key, value);
    }
    // Any filter change invalidates the current page number.
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    });
  }

  const hasAny = Object.values(current).some((v) => v !== "");

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <Field label="Action">
        <Select
          value={current.action || ANY}
          onValueChange={(v) => {
            apply({ action: v });
          }}
          disabled={pending}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="Any action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any action</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Entity">
        <Select
          value={current.entityType || ANY}
          onValueChange={(v) => {
            apply({ entityType: v });
          }}
          disabled={pending}
        >
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder="Any entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any entity</SelectItem>
            {ENTITIES.map((e) => (
              <SelectItem key={e} value={e}>
                {e.replace(/_/g, " ").toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Who">
        <Select
          value={current.actorUserId || ANY}
          onValueChange={(v) => {
            apply({ actorUserId: v });
          }}
          disabled={pending}
        >
          <SelectTrigger size="sm" className="w-52">
            <SelectValue placeholder="Anyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Anyone</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="From">
        <Input
          type="date"
          defaultValue={current.from}
          className="h-8 w-36"
          onChange={(e) => {
            apply({ from: e.target.value });
          }}
        />
      </Field>

      <Field label="To">
        <Input
          type="date"
          defaultValue={current.to}
          className="h-8 w-36"
          onChange={(e) => {
            apply({ to: e.target.value });
          }}
        />
      </Field>

      <Field label="Search">
        <Input
          defaultValue={current.q}
          placeholder="Summary or actor"
          className="h-8 w-52"
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ q: e.currentTarget.value });
          }}
          onBlur={(e) => {
            apply({ q: e.target.value });
          }}
        />
      </Field>

      {hasAny ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(() => {
              router.push(pathname);
            });
          }}
        >
          <X />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  );
}
