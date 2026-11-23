"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionOverridesDialog, type OverrideRow } from "./permission-overrides-dialog";
import {
  linkUserEmployeeAction,
  setUserCompanyAccessAction,
  updateUserRoleAction,
  updateUserStatusAction,
} from "@/server/actions/users";

type Role = { id: string; key: string; name: string; description: string | null; rank: number };
type Company = { id: string; code: string; name: string };
type LinkedEmployee = { id: string; fullName: string; employeeNo: string };

export function UserRowActions({
  user,
  roles,
  companies,
  isSelf,
  canLinkSelf,
  employees,
  overrides,
  grantablePermissions,
  allPermissions,
}: {
  user: {
    id: string;
    name: string;
    status: string;
    roleKey: string;
    employee: LinkedEmployee | null;
    /** Sees every company already, so an access list would do nothing. */
    allCompanies: boolean;
  };
  /** A super admin may link their own account; nobody else may. */
  canLinkSelf: boolean;
  /** Employees without an account, to link this user to. */
  employees: LinkedEmployee[];
  roles: Role[];
  companies: Company[];
  isSelf: boolean;
  overrides: OverrideRow[];
  grantablePermissions: { key: string; label: string }[];
  allPermissions: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [roleOpen, setRoleOpen] = React.useState(false);
  const [companyOpen, setCompanyOpen] = React.useState(false);
  const [overridesOpen, setOverridesOpen] = React.useState(false);
  const [employeeOpen, setEmployeeOpen] = React.useState(false);

  function run(fn: () => Promise<{ success: boolean; error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(successMessage);
        setRoleOpen(false);
        setCompanyOpen(false);
        setEmployeeOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf}
            onSelect={() => {
              setRoleOpen(true);
            }}
          >
            Change role
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={user.allCompanies}
            onSelect={() => {
              setCompanyOpen(true);
            }}
          >
            {user.allCompanies ? "Company access: all companies" : "Company access"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isSelf && !canLinkSelf}
            onSelect={() => {
              setEmployeeOpen(true);
            }}
          >
            {user.employee ? "Change linked employee" : "Link to employee"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isSelf}
            onSelect={() => {
              setOverridesOpen(true);
            }}
          >
            Permission overrides
            {overrides.length > 0 ? ` (${String(overrides.length)})` : ""}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.status === "ACTIVE" ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={isSelf}
              onSelect={() => {
                run(
                  () => updateUserStatusAction({ userId: user.id, status: "DISABLED" }),
                  "Account disabled and sessions revoked.",
                );
              }}
            >
              Disable account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={isSelf}
              onSelect={() => {
                run(
                  () => updateUserStatusAction({ userId: user.id, status: "ACTIVE" }),
                  "Account re-enabled.",
                );
              }}
            >
              Enable account
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RoleDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        user={user}
        roles={roles}
        pending={pending}
        onSubmit={(roleId) => {
          run(() => updateUserRoleAction({ userId: user.id, roleId }), "Role updated.");
        }}
      />

      <PermissionOverridesDialog
        open={overridesOpen}
        onOpenChange={setOverridesOpen}
        user={user}
        overrides={overrides}
        grantablePermissions={grantablePermissions}
        allPermissions={allPermissions}
        isSelf={isSelf}
      />

      <EmployeeDialog
        open={employeeOpen}
        onOpenChange={setEmployeeOpen}
        user={user}
        employees={employees}
        pending={pending}
        onSubmit={(employeeId) => {
          run(
            () => linkUserEmployeeAction({ userId: user.id, employeeId }),
            employeeId ? "Linked to the employee." : "Employee link removed.",
          );
        }}
      />

      <CompanyDialog
        open={companyOpen}
        onOpenChange={setCompanyOpen}
        user={user}
        companies={companies}
        pending={pending}
        onSubmit={(companyIds) => {
          run(
            () => setUserCompanyAccessAction({ userId: user.id, companyIds }),
            "Company access updated.",
          );
        }}
      />
    </>
  );
}

function RoleDialog({
  open,
  onOpenChange,
  user,
  roles,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { name: string; roleKey: string };
  roles: Role[];
  pending: boolean;
  onSubmit: (roleId: string) => void;
}) {
  const [roleId, setRoleId] = React.useState<string>("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            {user.name} is currently {user.roleKey.replace(/_/g, " ")}. You can only assign roles
            below your own level.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="role">New role</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id="role" className="w-full">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {roles.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              There are no roles below your own level to assign.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!roleId || pending}
            onClick={() => {
              onSubmit(roleId);
            }}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompanyDialog({
  open,
  onOpenChange,
  user,
  companies,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { name: string };
  companies: Company[];
  pending: boolean;
  onSubmit: (companyIds: string[]) => void;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Company access</DialogTitle>
          <DialogDescription>
            {user.name} will only see records belonging to the selected companies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {companies.map((company) => (
            <div key={company.id} className="flex items-center gap-2">
              <Checkbox
                id={company.id}
                checked={selected.has(company.id)}
                onCheckedChange={(checked) => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (checked === true) next.add(company.id);
                    else next.delete(company.id);
                    return next;
                  });
                }}
              />
              <Label htmlFor={company.id} className="font-normal">
                {company.code} — {company.name}
              </Label>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              onSubmit([...selected]);
            }}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const UNLINK = "none";

function EmployeeDialog({
  open,
  onOpenChange,
  user,
  employees,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { name: string; employee: LinkedEmployee | null };
  employees: LinkedEmployee[];
  pending: boolean;
  onSubmit: (employeeId: string | null) => void;
}) {
  const current = user.employee?.id ?? "";
  const [employeeId, setEmployeeId] = React.useState<string>(current);
  // The current link is listed too, so the dialog opens on what is saved.
  const options = user.employee
    ? [user.employee, ...employees.filter((e) => e.id !== current)]
    : employees;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setEmployeeId(current);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Linked employee</DialogTitle>
          <DialogDescription>
            Link {user.name}&apos;s account to their employee record. Only employees without an
            account are listed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="link-employee">Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger id="link-employee" className="w-full">
              <SelectValue placeholder="Select an employee" />
            </SelectTrigger>
            <SelectContent>
              {user.employee ? (
                <SelectItem value={UNLINK}>None — remove the link</SelectItem>
              ) : null}
              {options.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.fullName} · {e.employeeNo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {options.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Every active employee already has an account.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!employeeId || employeeId === current || pending}
            onClick={() => {
              onSubmit(employeeId === UNLINK ? null : employeeId);
            }}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
