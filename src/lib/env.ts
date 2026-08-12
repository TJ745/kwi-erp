import "server-only";
import { z } from "zod";

/**
 * Environment validation. A missing or malformed secret is a BOOT FAILURE,
 * not a runtime surprise on first use — see docs/SECURITY.md §9.
 */

/** A base64 value that decodes to exactly `bytes` bytes. */
const base64Bytes = (bytes: number) =>
  z
    .string()
    .min(1)
    .refine(
      (value) => {
        try {
          return Buffer.from(value, "base64").length === bytes;
        } catch {
          return false;
        }
      },
      { message: `must be base64 decoding to exactly ${bytes} bytes` },
    );

/** Rejects the placeholder values shipped in .env.example. */
const notPlaceholder = (value: string) =>
  !value.startsWith("replace-me") && !value.includes("replace-me-with");

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),

    APP_URL: z.string().url(),

    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "must be at least 32 characters")
      .refine(notPlaceholder, "still set to the .env.example placeholder"),
    BETTER_AUTH_URL: z.string().url(),

    // Vault master key. Losing this makes every credential unrecoverable.
    VAULT_KEK_V1: base64Bytes(32).refine(
      notPlaceholder,
      "still set to the .env.example placeholder — generate a real key",
    ),
    VAULT_KEK_V2: base64Bytes(32).optional(),
    VAULT_KEK_ACTIVE_VERSION: z.coerce.number().int().min(1).default(1),

    UPLOADTHING_TOKEN: z
      .string()
      .min(1)
      .refine(notPlaceholder, "still set to the .env.example placeholder"),

    /**
     * Storage tier — the single switch described in docs/SECURITY.md §6.0.
     *
     * "free": UploadThing's free plan rejects `acl: "private"` outright (HTTP
     *   400), so objects are stored world-readable and the URL becomes the
     *   secret. The application never discloses that URL — downloads are
     *   streamed through `/api/files/[id]` — but a leaked or logged URL is
     *   sufficient to read the file with no session.
     * "pro": objects are private and only reachable via a short-lived signed
     *   URL that the server mints and consumes internally.
     *
     * Flipping this to "pro" is the whole upgrade: no other code changes.
     */
    UPLOADTHING_TIER: z.enum(["free", "pro"]).default("free"),

    /**
     * Required to run the free tier in production. Deliberately separate from
     * UPLOADTHING_TIER so a development default cannot reach production by
     * being copied along with the rest of the file.
     */
    ACCEPT_PUBLIC_FILE_STORAGE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    CRON_SECRET: z
      .string()
      .min(16, "must be at least 16 characters")
      .refine(notPlaceholder, "still set to the .env.example placeholder"),

    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
    ALLOW_PRODUCTION_SEED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .superRefine((env, ctx) => {
    // The active KEK version must actually exist, or the vault silently breaks.
    const activeKey = env[`VAULT_KEK_V${env.VAULT_KEK_ACTIVE_VERSION}` as "VAULT_KEK_V1"];
    if (!activeKey) {
      ctx.addIssue({
        code: "custom",
        path: ["VAULT_KEK_ACTIVE_VERSION"],
        message: `VAULT_KEK_V${env.VAULT_KEK_ACTIVE_VERSION} is not set, but it is the active vault key version`,
      });
    }

    // NOTE: the "free tier in production" guard is deliberately NOT here.
    // `next build` runs with NODE_ENV=production and Turbopack exposes no
    // build-phase signal, so a check in env parsing fails the build itself
    // rather than the deployment. It lives in `assertStorageTierAllowed`,
    // called per request — see lib/storage-policy.ts.
  });

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/**
 * Validates and returns the server environment.
 *
 * Throws on the first call if anything is missing or malformed. The error lists
 * every problem at once rather than one per restart, and never prints values.
 */
export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    // Names and reasons only — never the offending values.
    throw new Error(
      `Invalid environment configuration:\n${problems}\n\n` +
        `See .env.example for the expected shape.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Resolves a specific KEK version for vault decryption / key rotation. */
export function getVaultKek(version: number): Buffer {
  const env = getEnv();
  const raw =
    version === 1 ? env.VAULT_KEK_V1 : version === 2 ? env.VAULT_KEK_V2 : undefined;

  if (!raw) {
    throw new Error(`Vault key version ${version} is not configured`);
  }
  return Buffer.from(raw, "base64");
}
