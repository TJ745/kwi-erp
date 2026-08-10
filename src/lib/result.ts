/**
 * Uniform Server Action result — docs/ARCHITECTURE.md §6.
 * Services throw typed AppErrors; the action wrapper is the ONLY place that
 * converts them into this shape, so Prisma messages and stack traces never
 * cross the boundary to the browser.
 */

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "RATE_LIMITED",
  "VAULT_LOCKED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      code: ErrorCode;
      fieldErrors?: Record<string, string[]>;
      /** Correlates the user-facing message with the server log entry. */
      reference?: string;
    };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function err<T = never>(
  code: ErrorCode,
  error: string,
  extra?: { fieldErrors?: Record<string, string[]>; reference?: string },
): ActionResult<T> {
  return { success: false, code, error, ...extra };
}

// --- Typed domain errors -----------------------------------------------------

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "You must be signed in to do that.") {
    super("UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super("FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Record not found.") {
    super("NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message);
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super("VALIDATION", message);
    this.fieldErrors = fieldErrors;
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many attempts. Please try again shortly.") {
    super("RATE_LIMITED", message);
  }
}

export class VaultLockedError extends AppError {
  constructor(message = "The vault is locked. Unlock it to continue.") {
    super("VAULT_LOCKED", message);
  }
}

/**
 * `NOT_FOUND` and `FORBIDDEN` are deliberately indistinguishable to callers who
 * lack access, so record existence cannot be probed. Use this when the actor
 * should not learn whether the row exists.
 */
export function notFoundOrForbidden(): never {
  throw new NotFoundError();
}
