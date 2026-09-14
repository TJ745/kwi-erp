import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
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
    /*
      The shell is a fixed viewport with two independent scroll regions: the
      sidebar's own nav, and the main content. Previously the whole page
      scrolled, which carried the sidebar and header off the top — on a long
      page like the dashboard the navigation disappeared exactly when it was
      most useful.

      Print is exempted: a clipped, fixed-height page prints one screenful.
    */
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-64 shrink-0 flex-col border-r lg:flex print:lg:hidden">
        {/*
          Brand block. The mark is a plain glyph and the second line is the
          caller's company scope, not a hard-coded group name: the system
          serves more than one company, and a sidebar that names one of them
          is wrong for everyone else.
        */}
        <div className="border-sidebar-border flex h-16 shrink-0 items-center border-b px-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-[10px]"
            >
              <Building2 className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm leading-tight font-bold">Operations</span>
              <span className="text-sidebar-muted block truncate text-[11px] leading-tight">
                {companyLabel}
              </span>
            </span>
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav sections={sections} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
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
        <main className="min-w-0 flex-1 overflow-y-auto print:overflow-visible">
          {children}
        </main>
      </div>

      <CommandMenu sections={sections} />
    </div>
  );
}
