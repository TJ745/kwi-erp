import "server-only";
import { getEnv } from "@/lib/env";
import { logger } from "@/server/logger";

/**
 * Email transport.
 *
 * Resend over its HTTP API rather than an SDK: one `fetch` call, no dependency,
 * and nothing to keep in step with a package release. The shape below is the
 * whole surface a second provider would have to satisfy, so swapping to SMTP
 * later is a contained change.
 *
 * The important property is that this is **optional infrastructure**. With no
 * API key configured every send returns `skipped` and the application carries
 * on: notifications still appear in-app, and nothing that matters is blocked on
 * an email that could not go out. A missing key is a configuration state, not
 * an error.
 */

export type SendResult =
  | { outcome: "sent"; messageId: string | null }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; error: string };

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Whether a transport is configured at all. Cheap, so callers can pre-check. */
export function isEmailConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const env = getEnv();

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return { outcome: "skipped", reason: "Email is not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
      }),
      // A hung provider must not hold a request open. The dispatcher retries.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // The body can echo the recipient address back, so it is trimmed hard
      // before being stored on a row that other people can read.
      const detail = (await response.text()).slice(0, 200);
      return {
        outcome: "failed",
        error: `Provider returned ${String(response.status)}: ${redact(detail)}`,
      };
    }

    // `in` already narrows this, so no cast is needed to read the id.
    const body: unknown = await response.json();
    const messageId =
      typeof body === "object" && body !== null && "id" in body ? String(body.id) : null;

    return { outcome: "sent", messageId };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.name === "TimeoutError"
          ? "Provider timed out"
          : error.message
        : String(error);

    logger.warn("Email send failed", { reason: redact(reason) });
    return { outcome: "failed", error: redact(reason).slice(0, 200) };
  }
}

/**
 * Strips anything that looks like an address or a key from provider output.
 *
 * The error is stored on the Notification row and shown to administrators, so
 * it must not become a place where a recipient list or an API key leaks.
 */
function redact(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/re_[A-Za-z0-9_]+/g, "[key]");
}
