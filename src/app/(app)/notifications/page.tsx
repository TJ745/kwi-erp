import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listNotifications, unreadCount } from "@/server/services/notifications";
import { NotificationList } from "./notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const ctx = await requirePagePermission("notifications.view");
  const { filter } = await searchParams;
  const unreadOnly = filter === "unread";

  const [notifications, unread] = await Promise.all([
    listNotifications(ctx, { unreadOnly }),
    unreadCount(ctx),
  ]);

  return (
    <PageShell>
      <PageHeader
        printable
        title="Notifications"
        description="Expiry reminders and approval requests."
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={unreadOnly ? "Nothing unread" : "No notifications"}
          description="Expiring documents, contracts, vehicle registrations, insurance policies, and pending approvals all appear here."
        />
      ) : (
        <NotificationList
          unreadCount={unread}
          unreadOnly={unreadOnly}
          notifications={notifications.map((n) => ({
            id: n.id,
            kind: n.kind,
            severity: n.severity,
            title: n.title,
            body: n.body,
            entityType: n.entityType,
            entityId: n.entityId,
            isRead: n.readAt !== null,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      )}
    </PageShell>
  );
}
