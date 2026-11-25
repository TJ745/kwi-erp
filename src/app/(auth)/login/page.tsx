import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel: deep ink with a soft glow, hidden on phones. */}
      <section className="bg-sidebar text-sidebar-foreground relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="bg-sidebar-primary/40 absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl"
        />
        <div
          aria-hidden="true"
          className="bg-brand-teal/25 absolute -right-24 -bottom-40 size-[26rem] rounded-full blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <Building2 className="size-5" />
          </span>
          <span className="text-lg font-bold text-white">Operations</span>
        </div>
        <div className="relative max-w-md space-y-4">
          <h2 className="text-4xl leading-tight font-bold tracking-tight text-white">
            People, documents and daily work — in one place.
          </h2>
          <p className="text-sidebar-foreground/80">
            Employees, HR letters, leave, fleet, accommodation and renewals for every company in
            the group.
          </p>
        </div>
        <p className="text-sidebar-muted relative text-xs">Internal system · authorised users only</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 space-y-2">
            <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl lg:hidden">
              <Building2 className="size-5" />
            </span>
            <h1 className="text-[1.75rem] font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm">
              Sign in to continue. Accounts are created by an administrator.
            </p>
          </div>
          <LoginForm nextPath={next ?? null} />
        </div>
      </section>
    </main>
  );
}
