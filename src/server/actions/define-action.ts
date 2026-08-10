import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { AuditAction, EntityType } from "@/generated/prisma/enums";
import type { PermissionKey } from "@/lib/permissions";
import { AppError, err, ok, ValidationError, type ActionResult } from "@/lib/result";
import type { ActorContext } from "@/server/auth/context";
import { requireAuth, requirePermission } from "@/server/auth/guards";
import { recordAudit, type AuditInput } from "@/server/audit/log";
import { logger } from "@/server/logger";

/**
 * The Server Action pipeline — docs/ARCHITECTURE.md §6.
 *
 * Every mutation runs the same steps in the same order:
 *   authenticate → authorise → validate → execute → audit → revalidate → return
 *
 * Encoding it once means it cannot be half-applied in one of ~200 actions, and
 * it is the single place typed AppErrors become safe ActionResults.
 */

type AuditSpec = {
  action: AuditAction;
  entity: EntityType;
};

/** What the handler may record; entityId is only known after execution. */
export type AuditRecorder = {
  record: (input: Omit<AuditInput, "action" | "entityType"> & { entityId: string }) => void;
};

type HandlerArgs<TInput> = {
  input: TInput;
  ctx: ActorContext;
  audit: AuditRecorder;
};

type DefineActionConfig<TSchema extends z.ZodType, TOutput> = {
  /** Required permission, or null for actions any signed-in user may run. */
  permission: PermissionKey | null;
  schema: TSchema;
  audit?: AuditSpec;
  handler: (args: HandlerArgs<z.infer<TSchema>>) => Promise<TOutput>;
  /** Paths to revalidate on success. */
  revalidate?: (input: z.infer<TSchema>, output: TOutput) => readonly string[];
};

export function defineAction<TSchema extends z.ZodType, TOutput>(
  config: DefineActionConfig<TSchema, TOutput>,
) {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    // 1 + 2. Authenticate, then authorise BEFORE validating, so an
    // unauthorised caller learns nothing about the expected input shape.
    let ctx: ActorContext;
    try {
      ctx = config.permission ? await requirePermission(config.permission) : await requireAuth();
    } catch (error) {
      return toResult(error, config);
    }

    // 3. Validate. Only the parsed output is ever used downstream.
    const parsed = config.schema.safeParse(rawInput);
    if (!parsed.success) {
      return err("VALIDATION", "Please correct the highlighted fields.", {
        fieldErrors: flattenFieldErrors(parsed.error),
      });
    }
    const input = parsed.data;

    // 4-5. Execute, collecting audit entries the handler asks for.
    const pending: AuditInput[] = [];
    const audit: AuditRecorder = {
      record: (entry) => {
        if (!config.audit) return;
        pending.push({ ...entry, action: config.audit.action, entityType: config.audit.entity });
      },
    };

    try {
      const output = await config.handler({ input, ctx, audit });

      for (const entry of pending) {
        await recordAudit(ctx, entry);
      }

      // 6. Revalidate affected paths.
      for (const path of config.revalidate?.(input, output) ?? []) {
        revalidatePath(path);
      }

      // 7. Return a safe result.
      return ok(output);
    } catch (error) {
      return toResult(error, config);
    }
  };
}

/**
 * Converts a thrown error into a safe result.
 *
 * Typed AppErrors carry a message intended for users. Anything else is logged
 * with a correlation id and reported generically — stack traces, Prisma
 * messages, and schema details never reach the browser.
 */
function toResult<TSchema extends z.ZodType, TOutput>(
  error: unknown,
  config: DefineActionConfig<TSchema, TOutput>,
): ActionResult<TOutput> {
  if (error instanceof ValidationError && error.fieldErrors) {
    return err(error.code, error.message, { fieldErrors: error.fieldErrors });
  }
  if (error instanceof AppError) {
    return err(error.code, error.message);
  }

  const reference = randomUUID().slice(0, 8);
  logger.error("Unhandled action error", {
    reference,
    permission: config.permission,
    error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
  });

  return err("INTERNAL", "Something went wrong. Please try again.", { reference });
}

function flattenFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_form";
    (out[path] ??= []).push(issue.message);
  }
  return out;
}
