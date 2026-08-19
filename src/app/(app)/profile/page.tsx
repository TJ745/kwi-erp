import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getSessionToken } from "@/server/auth/context";
import { ownProfile, ownSessions } from "@/server/services/profile";
import { NameForm } from "./name-form";
import { Sessions } from "./sessions";

export const metadata: Metadata = { title: "Profile" };

/**
 * A user's own account.
 *
 * Everything editable here addresses the caller and nobody else. What is shown
 * read-only — role, company access, employee link — is shown deliberately:
 * "what am I allowed to do" is a question people otherwise answer by trial and
 * error against pages that refuse them.
 */
export default async function ProfilePage() {
  const ctx = await requirePagePermission("dashboard.view");

  const token = await getSessionToken();
  const [profile, sessions] = await Promise.all([
    ownProfile(ctx),
    ownSessions(ctx, token),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Profile & settings"
        description="Your account, what you have access to, and where you are signed in."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NameForm name={profile.name} />

            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate">{profile.email}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Account status</dt>
                <dd>
                  <Badge variant={profile.status === "ACTIVE" ? "default" : "outline"}>
                    {profile.status}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Last signed in</dt>
                <dd className="tabular-nums">
                  {profile.lastLoginAt
                    ? profile.lastLoginAt.toISOString().slice(0, 16).replace("T", " ")
                    : "—"}
                </dd>
              </div>
            </dl>

            <p className="text-muted-foreground text-xs">
              Your email is your sign-in identifier, so only an administrator can change it.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4" />
              Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="text-right">
                  <p className="font-medium">{profile.role.name}</p>
                  {profile.role.description ? (
                    <p className="text-muted-foreground text-xs">{profile.role.description}</p>
                  ) : null}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Companies</dt>
                <dd className="text-right">
                  {ctx.companyScope === "ALL"
                    ? "All companies"
                    : profile.companyAccess.length === 0
                      ? "None assigned"
                      : profile.companyAccess.map((a) => a.company.code).join(", ")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Employee record</dt>
                <dd className="text-right">
                  {profile.employee ? (
                    <Link
                      href={`/people/employees/${profile.employee.id}`}
                      className="hover:underline"
                    >
                      {profile.employee.fullName} ({profile.employee.employeeNo})
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Not linked</span>
                  )}
                </dd>
              </div>
            </dl>

            <p className="text-muted-foreground text-xs">
              Role and company access are set by an administrator. A permission you could
              grant yourself would not be a permission.
            </p>

            <Link
              href="/change-password"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <KeyRound />
              Change password
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Where you are signed in</CardTitle>
        </CardHeader>
        <CardContent>
          <Sessions
            sessions={sessions.map((s) => ({
              id: s.id,
              ipAddress: s.ipAddress,
              userAgent: s.userAgent,
              createdAt: s.createdAt.toISOString().slice(0, 10),
              updatedAt: s.updatedAt.toISOString().slice(0, 16).replace("T", " "),
              isCurrent: s.isCurrent,
            }))}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
