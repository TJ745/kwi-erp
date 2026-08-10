import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActorContext } from "@/server/auth/context";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password" };

/**
 * Deliberately OUTSIDE the (app) group: that layout redirects here when
 * mustChangePassword is set, so nesting it would loop.
 */
export default async function ChangePasswordPage() {
  const ctx = await getActorContext();
  if (!ctx) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Change your password</h1>
        <p className="text-muted-foreground mt-1 mb-8 text-sm">
          {ctx.mustChangePassword
            ? "You must set a new password before continuing."
            : "Choose a new password for your account."}
        </p>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
