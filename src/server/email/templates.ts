import "server-only";
import type { EntityType, NotificationKind } from "@/generated/prisma/client";

/**
 * The notification email.
 *
 * One template, deliberately. A house style per notification kind would mean
 * five places to check whenever the question "could this email contain
 * something it should not?" comes up.
 *
 * What it may contain is the notification's own title and body, which are
 * written for an in-app list and are already conservative — the increment
 * notification says a rise needs approval and names nobody's salary, because
 * `hr.increments.approve` does not imply `employees.salary.view`. Email is a
 * copy that leaves the system and lands somewhere with no permission model at
 * all, so anything beyond that is a link, not a detail.
 */

export type NotificationEmailInput = {
  recipientName: string;
  title: string;
  body: string | null;
  kind: NotificationKind;
  appUrl: string;
  entityType: EntityType | null;
  entityId: string | null;
};

/** Where the notification points, if anywhere. Never a deep link to a file. */
function targetPath(entityType: EntityType | null, entityId: string | null): string {
  if (!entityType || !entityId) return "/notifications";

  switch (entityType) {
    case "EMPLOYEE":
      return `/people/employees/${entityId}`;
    case "TASK":
      return `/tasks/${entityId}`;
    case "IT_TICKET":
      return `/it/helpdesk/${entityId}`;
    case "PETTY_CASH_TRANSACTION":
      return "/admin/petty-cash";
    case "LEAVE_REQUEST":
      return "/people/leave";
    case "INCREMENT":
      return "/hr/increments";
    default:
      return "/notifications";
  }
}

const KIND_LABEL: Partial<Record<NotificationKind, string>> = {
  APPROVAL_REQUIRED: "Waiting for your approval",
  EXPIRY: "Something is expiring",
  TASK_DUE: "A task is due",
  TASK_OVERDUE: "A task is overdue",
  TICKET_ASSIGNED: "A ticket was assigned to you",
  MENTION: "You were mentioned",
  SYSTEM: "Notice",
};

export function renderNotificationEmail(input: NotificationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const label = KIND_LABEL[input.kind] ?? "Notice";
  const link = `${input.appUrl.replace(/\/$/, "")}${targetPath(input.entityType, input.entityId)}`;

  const subject = input.title;

  const text = [
    `${label}`,
    "",
    input.title,
    ...(input.body ? ["", input.body] : []),
    "",
    `Open it: ${link}`,
    "",
    "You are receiving this because you have a role in the Operations Management System.",
  ].join("\n");

  // Inline styles and a table-free layout: this has to survive Outlook, and a
  // stylesheet will not.
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#666;">${escapeHtml(label)}</p>
      <h1 style="margin:0 0 12px;font-size:18px;line-height:1.4;">${escapeHtml(input.title)}</h1>
      ${input.body ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333;">${escapeHtml(input.body)}</p>` : ""}
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;">Open in the system</a>
      </p>
      <p style="margin:0;font-size:12px;color:#888;line-height:1.5;">
        You are receiving this because you have a role in the Operations Management System.
        The details stay in the system — this message only tells you there is something to look at.
      </p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}

/**
 * Escapes the notification text before it is interpolated.
 *
 * Titles are assembled from record names — an employee name, an account name —
 * which are user-supplied. An apostrophe in a name would break the markup and a
 * tag in one would be worse.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
