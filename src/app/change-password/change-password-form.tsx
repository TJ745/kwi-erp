"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { readString } from "@/lib/form-data";
import { changePasswordAction } from "@/server/actions/auth-password";

export function ChangePasswordForm() {
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
      currentPassword: readString(formData, "currentPassword"),
      newPassword: readString(formData, "newPassword"),
      confirmPassword: readString(formData, "confirmPassword"),
    };

    startTransition(async () => {
      const result = await changePasswordAction(input);
      if (!result.success) {
        setFormError(result.fieldErrors ? null : result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.push("/dashboard");
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

      <PasswordField
        id="currentPassword"
        label="Current password"
        autoComplete="current-password"
        errors={fieldErrors.currentPassword}
        disabled={isPending}
      />
      <PasswordField
        id="newPassword"
        label="New password"
        autoComplete="new-password"
        hint="At least 12 characters."
        errors={fieldErrors.newPassword}
        disabled={isPending}
      />
      <PasswordField
        id="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        errors={fieldErrors.confirmPassword}
        disabled={isPending}
      />

      <button
        type="submit"
        disabled={isPending}
        className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {isPending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  hint,
  errors,
  disabled,
}: {
  id: string;
  label: string;
  autoComplete: string;
  hint?: string;
  errors: string[] | undefined;
  disabled: boolean;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hasError = Boolean(errors?.length);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
        required
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : hint ? hintId : undefined}
        className="border-input bg-background focus-visible:ring-ring aria-invalid:border-destructive h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      />
      {hasError ? (
        <p id={errorId} className="text-destructive text-xs">
          {errors?.[0]}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
