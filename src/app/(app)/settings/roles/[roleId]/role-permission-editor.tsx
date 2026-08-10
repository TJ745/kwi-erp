"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setRolePermissionsAction } from "@/server/actions/users";

type PermissionEntry = {
  key: string;
  label: string;
  sensitive: boolean;
  /** False when the actor does not hold it and therefore cannot grant it. */
  grantable: boolean;
};

export function RolePermissionEditor({
  roleId,
  roleKey,
  modules,
  initiallyGranted,
}: {
  roleId: string;
  roleKey: string;
  modules: { module: string; permissions: PermissionEntry[] }[];
  initiallyGranted: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [granted, setGranted] = React.useState<Set<string>>(new Set(initiallyGranted));

  const initial = React.useMemo(() => new Set(initiallyGranted), [initiallyGranted]);
  const isDirty =
    granted.size !== initial.size || [...granted].some((key) => !initial.has(key));

  function toggle(key: string, checked: boolean) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await setRolePermissionsAction({
        roleId,
        permissionKeys: [...granted],
      });
      if (result.success) {
        toast.success(`Permissions updated for ${roleKey}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-background/95 sticky top-14 z-10 flex items-center justify-between gap-4 border-b py-3 backdrop-blur">
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium tabular-nums">{granted.size}</span>{" "}
          permission{granted.size === 1 ? "" : "s"} selected
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!isDirty || pending}
            onClick={() => {
              setGranted(new Set(initiallyGranted));
            }}
          >
            Reset
          </Button>
          <Button size="sm" disabled={!isDirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {modules.map(({ module, permissions }) => (
          <Card key={module}>
            <CardHeader>
              <CardTitle className="text-sm capitalize">{module}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {permissions.map((permission) => (
                <div key={permission.key} className="flex items-start gap-2">
                  <Checkbox
                    id={permission.key}
                    checked={granted.has(permission.key)}
                    disabled={!permission.grantable || pending}
                    onCheckedChange={(checked) => {
                      toggle(permission.key, checked === true);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor={permission.key}
                      className="flex-wrap font-normal data-[disabled]:opacity-100"
                    >
                      <span className={permission.grantable ? "" : "text-muted-foreground"}>
                        {permission.label}
                      </span>
                      {permission.sensitive ? (
                        <Badge variant="warning" className="gap-1">
                          <ShieldAlert className="size-3" />
                          Sensitive
                        </Badge>
                      ) : null}
                    </Label>
                    <p className="text-muted-foreground font-mono text-[11px]">
                      {permission.key}
                    </p>
                    {!permission.grantable ? (
                      <p className="text-muted-foreground text-[11px] italic">
                        You do not hold this permission, so you cannot grant it.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
