import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { PERMISSIONS, PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getRoleWithPermissions } from "@/server/services/users";
import { RolePermissionEditor } from "./role-permission-editor";

export const metadata: Metadata = { title: "Edit role" };

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const ctx = await requirePagePermission("roles.manage");
  const { roleId } = await params;
  const role = await getRoleWithPermissions(ctx, roleId);

  const granted = new Set(role.permissions.map((p) => p.permission.key));

  // Group by module for a scannable editor, and mark permissions the actor
  // cannot grant because they do not hold them (docs/SECURITY.md §3).
  const modules = new Map<string, { key: PermissionKey; label: string; sensitive: boolean; grantable: boolean }[]>();

  for (const key of PERMISSION_KEYS) {
    const meta = PERMISSIONS[key];
    const list = modules.get(meta.module) ?? [];
    list.push({
      key,
      label: meta.label,
      sensitive: "sensitive" in meta && meta.sensitive === true,
      grantable: ctx.permissions.has(key),
    });
    modules.set(meta.module, list);
  }

  const editable = role.rank > ctx.roleRank && role.key !== "SUPER_ADMIN";

  return (
    <PageShell>
      <Link
        href="/settings/roles"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to roles
      </Link>

      <PageHeader
        title={role.name}
        description={role.description ?? `Permissions granted to the ${role.key} role.`}
      />

      {editable ? (
        <RolePermissionEditor
          roleId={role.id}
          roleKey={role.key}
          modules={[...modules.entries()].map(([module, permissions]) => ({
            module,
            permissions,
          }))}
          initiallyGranted={[...granted]}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          This role is at or above your own level, so it is read only.
        </p>
      )}
    </PageShell>
  );
}
