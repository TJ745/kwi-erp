import { describe, expect, it } from "vitest";
import { renderNotificationEmail } from "./templates";

/**
 * The template is the point where system data leaves the system. These tests
 * are about what must NOT end up in an inbox, and about names that break markup.
 */

const base = {
  recipientName: "Ahmed Khan",
  title: "Leave request needs approval: 5 days",
  body: "Annual leave — 1 to 5 March",
  kind: "APPROVAL_REQUIRED" as const,
  appUrl: "https://oms.example.com",
  entityType: "LEAVE_REQUEST" as const,
  entityId: "abc123",
};

describe("renderNotificationEmail", () => {
  it("produces a subject, an HTML body, and a text alternative", () => {
    const mail = renderNotificationEmail(base);
    expect(mail.subject).toBe(base.title);
    expect(mail.html).toContain("Leave request needs approval");
    expect(mail.text).toContain("Leave request needs approval");
    // A text/plain part is not optional: some clients show nothing without it.
    expect(mail.text.length).toBeGreaterThan(40);
  });

  it("links into the app rather than reproducing the record", () => {
    const mail = renderNotificationEmail(base);
    expect(mail.html).toContain("https://oms.example.com/people/leave");
    expect(mail.text).toContain("https://oms.example.com/people/leave");
  });

  it("does not double the slash when APP_URL has a trailing one", () => {
    const mail = renderNotificationEmail({ ...base, appUrl: "https://oms.example.com/" });
    expect(mail.html).not.toContain("com//people");
  });

  it("falls back to the notifications list for an unmapped entity", () => {
    const mail = renderNotificationEmail({
      ...base,
      entityType: "CREDENTIAL",
      entityId: "secret1",
    });
    // A vault credential must never get a deep link in an email.
    expect(mail.html).toContain("/notifications");
    expect(mail.html).not.toContain("secret1");
  });

  it("falls back when there is no entity at all", () => {
    const mail = renderNotificationEmail({ ...base, entityType: null, entityId: null });
    expect(mail.text).toContain("/notifications");
  });

  it("escapes a name that would otherwise break the markup", () => {
    const mail = renderNotificationEmail({
      ...base,
      title: `Leave request from Ahmed O'Brien <script>alert(1)</script>`,
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("&#39;");
  });

  it("escapes the body as well as the title", () => {
    const mail = renderNotificationEmail({ ...base, body: `<img src=x onerror="alert(1)">` });
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img");
  });

  it("omits the body block entirely when there is none", () => {
    const mail = renderNotificationEmail({ ...base, body: null });
    expect(mail.html).toContain(base.title);
    // No empty paragraph left behind.
    expect(mail.html).not.toContain('<p style="margin:0 0 16px');
  });

  it("labels the kind without inventing detail", () => {
    const approval = renderNotificationEmail(base);
    expect(approval.html).toContain("Waiting for your approval");

    const expiry = renderNotificationEmail({ ...base, kind: "EXPIRY" });
    expect(expiry.html).toContain("Something is expiring");
  });

  it("says why the recipient is receiving it", () => {
    const mail = renderNotificationEmail(base);
    expect(mail.text).toMatch(/you are receiving this/i);
    expect(mail.html).toMatch(/you are receiving this/i);
  });
});
