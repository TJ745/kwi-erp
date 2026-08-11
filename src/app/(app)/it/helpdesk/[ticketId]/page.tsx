import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requirePageAnyPermission } from "@/server/auth/page-guards";
import { getTicket, itStaff } from "@/server/services/helpdesk";
import { TicketComments } from "./ticket-comments";
import { TicketControls } from "./ticket-controls";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const ctx = await requirePageAnyPermission(["it.tickets.view", "it.tickets.create"]);
  const { ticketId } = await params;
  const ticket = await getTicket(ctx, ticketId);

  const canAssign = ctx.permissions.has("it.tickets.assign");
  const canResolve = ctx.permissions.has("it.tickets.resolve");
  const isItStaff = canAssign || ctx.permissions.has("it.manage");

  const staff = canAssign ? await itStaff() : [];

  return (
    <PageShell>
      <Link
        href="/it/helpdesk"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Back to helpdesk
      </Link>

      <PageHeader
        title={ticket.subject}
        description={`${ticket.ticketNo} · ${ticket.category.name} · raised by ${ticket.requesterName} on ${ticket.createdAt.toISOString().slice(0, 10)}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {ticket.resolution ? (
            <Card className="border-status-valid/40">
              <CardHeader>
                <CardTitle className="text-status-valid text-sm">Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{ticket.resolution}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Comments{ticket.comments.length > 0 ? ` (${String(ticket.comments.length)})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TicketComments
                ticketId={ticket.id}
                canPostInternal={isItStaff}
                comments={ticket.comments.map((c) => ({
                  id: c.id,
                  authorName: c.authorName,
                  body: c.body,
                  isInternal: c.isInternal,
                  createdAt: c.createdAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <Detail label="Company" value={ticket.company.code} />
                <Detail label="Department" value={ticket.department?.name ?? null} />
                <Detail label="Assigned to" value={ticket.assignedToName} />
                <Detail
                  label="Due"
                  value={ticket.dueDate ? ticket.dueDate.toISOString().slice(0, 16).replace("T", " ") : null}
                />
                <Detail
                  label="Resolved"
                  value={ticket.resolvedAt ? ticket.resolvedAt.toISOString().slice(0, 10) : null}
                />
              </dl>

              {ticket.asset ? (
                <Link
                  href={`/it/assets/${ticket.asset.id}`}
                  className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
                >
                  {ticket.asset.assetCode} — {ticket.asset.brand} {ticket.asset.model}
                </Link>
              ) : null}
            </CardContent>
          </Card>

          {canAssign || canResolve ? (
            <TicketControls
              ticket={{
                id: ticket.id,
                ticketNo: ticket.ticketNo,
                status: ticket.status,
                assignedToId: ticket.assignedToId,
                resolution: ticket.resolution,
              }}
              staff={staff}
              canAssign={canAssign}
              canResolve={canResolve}
            />
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>{value ? value : <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
