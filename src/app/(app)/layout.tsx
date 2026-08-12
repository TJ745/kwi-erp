import { redirect } from "next/navigation";
import Link from "next/link";
import { CommandMenu } from "@/components/shell/command-menu";
import { Header } from "@/components/shell/header";
import { SidebarNav } from "@/components/shell/sidebar";
import { visibleNavigation } from "@/lib/navigation";
import { getActorContext } from "@/server/auth/context";
import { logoutAction } from "@/server/actions/auth";

/**
 * The authenticated shell. This is the real gate — middleware only checks that
 * a session cookie exists and cannot reach the database (docs/SECURITY.md §3).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getActorContext();
  if (!ctx) redirect("/login");
  if (ctx.mustChangePassword) redirect("/change-password");

  // Navigation is filtered server-side, so a route the actor cannot use is
  // never even sent to the browser.
  const sections = visibleNavigation(ctx.permissions);

  const companyLabel =
    ctx.companyScope === "ALL"
      ? "All companies"
      : `${String(ctx.companyScope.length)} ${ctx.companyScope.length === 1 ? "company" : "companies"}`;

  return (
    <div className="flex min-h-screen">
      <aside className="bg-sidebar hidden w-64 shrink-0 border-r lg:block print:lg:hidden">
        <div className="flex h-14 items-center border-b px-5">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            Operations
          </Link>
        </div>
        <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
          <SidebarNav sections={sections} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          sections={sections}
          user={{
            name: ctx.name,
            email: ctx.email,
            roleKey: ctx.roleKey,
            companyLabel,
          }}
          logoutAction={async () => {
            "use server";
            await logoutAction();
          }}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <CommandMenu sections={sections} />
    </div>
  );
}
