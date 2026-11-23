import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listRolesWithPermissionCounts } from "@/server/services/users";
import { DeleteRoleButton, RoleDialog } from "./role-dialog";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { ReportLink } from "@/components/shared/report-link";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default async function RolesPage() {
  const ctx = await requirePagePermission("roles.manage");
  const roles = await listRolesWithPermissionCounts(ctx);

  // Offered as the default for a new role: one step junior to the most junior
  // that exists, and never senior to the actor — the server refuses that
  // anyway, so proposing it would only produce a failed submit.
  const mostJunior = roles.reduce((max, r) => Math.max(max, r.rank), ctx.roleRank);
  const suggestedRank = Math.max(mostJunior + 1, ctx.roleRank + 1);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Roles & Permissions"
        description={`${String(PERMISSION_KEYS.length)} permissions across the system. A role can only be edited by someone more senior than it.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportLink reportId="role-register" ctx={ctx} />
            <RoleDialog suggestedRank={suggestedRank} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => {
          const editable = role.rank > ctx.roleRank && role.key !== "SUPER_ADMIN";

          return (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{role.name}</CardTitle>
                    <CardDescription className="mt-1">{role.description}</CardDescription>
                  </div>
                  {role.isSystem ? (
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <Lock className="size-3" />
                      System
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="flex gap-6 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">Permissions</dt>
                    <dd className="font-medium tabular-nums">
                      {role.key === "SUPER_ADMIN" ? "All" : role._count.permissions}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Users</dt>
                    <dd className="font-medium tabular-nums">{role._count.users}</dd>
                  </div>
                </dl>

                {editable ? (
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/settings/roles/${role.id}`}
                      className="text-sm font-medium underline underline-offset-4"
                    >
                      Edit permissions
                    </Link>
                    {role.isSystem ? null : (
                      <DeleteRoleButton
                        roleId={role.id}
                        roleName={role.name}
                        userCount={role._count.users}
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {role.key === "SUPER_ADMIN"
                      ? "Always holds every permission."
                      : "At or above your own level — read only."}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
