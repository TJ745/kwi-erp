"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { readString } from "@/lib/form-data";
import { safeRedirect } from "@/lib/safe-redirect";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ nextPath }: { nextPath: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const input = {
      email: readString(formData, "email"),
      password: readString(formData, "password"),
    };

    startTransition(async () => {
      const result = await loginAction(input);

      if (!result.success) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      // The server decides the destination; `next` is validated, never trusted.
      const destination =
        nextPath && result.data.redirectTo === "/dashboard"
          ? safeRedirect(nextPath)
          : result.data.redirectTo;

      router.push(destination);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="username"
        errors={fieldErrors.email}
        disabled={isPending}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        errors={fieldErrors.password}
        disabled={isPending}
      />

      <button
        type="submit"
        disabled={isPending}
        className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  errors,
  disabled,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  errors: string[] | undefined;
  disabled: boolean;
}) {
  const errorId = `${id}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className="border-input bg-background focus-visible:ring-ring aria-invalid:border-destructive h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      />
      {hasError ? (
        <p id={errorId} className="text-destructive text-xs">
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}
