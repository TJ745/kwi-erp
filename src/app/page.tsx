import { PERMISSION_KEYS } from "@/lib/permissions";

/**
 * Phase 2 placeholder. The authenticated shell, sidebar, and dashboard arrive
 * in Phase 4; this page exists so the build has a route and the foundation is
 * verifiably wired up.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div>
        <p className="text-muted-foreground text-sm font-medium">Phase 2 · Foundation</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Operations Management System
        </h1>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Database schema, migrations, and the permission catalogue are in place. Authentication
        and the application shell follow in Phases 3 and 4.
      </p>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div className="border-border rounded-lg border p-4">
          <dt className="text-muted-foreground">Database models</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">87</dd>
        </div>
        <div className="border-border rounded-lg border p-4">
          <dt className="text-muted-foreground">Permissions defined</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {PERMISSION_KEYS.length}
          </dd>
        </div>
      </dl>
    </main>
  );
}
