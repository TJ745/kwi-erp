import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CommandMenu } from "@/components/shell/command-menu";
import { Header } from "@/components/shell/header";
import { AppSidebar } from "@/components/shell/sidebar";
import { NAV_CLOSED_COOKIE, SIDEBAR_COOKIE } from "@/lib/sidebar-state";
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
  // The sidebar's collapsed state and folded sections, as last left.
  const jar = await cookies();

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
      <AppSidebar
        sections={sections}
        companyLabel={companyLabel}
        initialCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
        initialClosed={closedSections(jar.get(NAV_CLOSED_COOKIE)?.value)}
      />

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

/** Folded sidebar sections from their cookie; a mangled cookie folds nothing. */
function closedSections(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    return decodeURIComponent(raw).split("|").filter(Boolean);
  } catch {
    return raw.split("|").filter(Boolean);
  }
}
