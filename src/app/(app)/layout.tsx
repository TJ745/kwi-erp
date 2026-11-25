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
      The page itself scrolls; the sidebar and header stay put by being
      sticky. A fixed-height shell with its own scrolling panel scrolled
      twice — the panel, then the page under it — and on a phone a nested
      scroller also stops the browser bar from tucking away.
    */
    <div className="flex min-h-dvh">
      <AppSidebar
        sections={sections}
        companyLabel={companyLabel}
        initialCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
        initialClosed={closedSections(jar.get(NAV_CLOSED_COOKIE)?.value)}
      />

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
        <main className="min-w-0 flex-1">
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
