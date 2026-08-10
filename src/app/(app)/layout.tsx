import { redirect } from "next/navigation";
import { getActorContext } from "@/server/auth/context";
import { logoutAction } from "@/server/actions/auth";

/**
 * The authenticated shell.
 *
 * This is the real gate — middleware only checks that a cookie exists.
 * The full sidebar and header arrive in Phase 4.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getActorContext();
  if (!ctx) redirect("/login");
  if (ctx.mustChangePassword) redirect("/change-password");

  return (
    <div className="min-h-screen">
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <span className="text-sm font-semibold">Operations Management</span>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">
            {ctx.name} · {ctx.roleKey.replace(/_/g, " ")}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
