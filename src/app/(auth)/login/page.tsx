import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Operations Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sign in to continue. Accounts are created by an administrator.
          </p>
        </div>
        <LoginForm nextPath={next ?? null} />
      </div>
    </main>
  );
}
