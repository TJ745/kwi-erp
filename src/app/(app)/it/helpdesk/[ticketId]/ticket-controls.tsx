"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextAreaField } from "@/components/forms/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readString } from "@/lib/form-data";
import { TICKET_STATUSES } from "@/lib/schemas/it";
import { assignTicketAction, setTicketStatusAction } from "@/server/actions/it";

const titleCase = (v: string) =>
  v.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** Statuses that require a recorded resolution before they can be set. */
const NEEDS_RESOLUTION = ["RESOLVED", "CLOSED"];

export function TicketControls({
  ticket,
  staff,
  canAssign,
  canResolve,
}: {
  ticket: {
    id: string;
    ticketNo: string;
    status: string;
    assignedToId: string | null;
    resolution: string | null;
  };
  staff: { id: string; name: string }[];
  canAssign: boolean;
  canResolve: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [targetStatus, setTargetStatus] = React.useState<string>("RESOLVED");
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  function assign(assignedToId: string) {
    startTransition(async () => {
      const result = await assignTicketAction({
        id: ticket.id,
        assignedToId: assignedToId === "none" ? undefined : assignedToId,
      });
      if (result.success) {
        toast.success("Ticket reassigned.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function changeStatus(status: string) {
    // Resolving or closing needs a resolution note, so route through the dialog
    // rather than firing a request the server would reject.
    if (NEEDS_RESOLUTION.includes(status) && !ticket.resolution) {
      setTargetStatus(status);
      setResolveOpen(true);
      return;
    }

    startTransition(async () => {
      const result = await setTicketStatusAction({ id: ticket.id, status });
      if (result.success) {
        toast.success(`Ticket moved to ${titleCase(status)}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function submitResolution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await setTicketStatusAction({
        id: ticket.id,
        status: targetStatus,
        resolution: readString(fd, "resolution"),
      });
      if (result.success) {
        toast.success(`Ticket ${titleCase(targetStatus).toLowerCase()}.`);
        setResolveOpen(false);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canAssign ? (
            <div className="space-y-1.5">
              <label htmlFor="ticket-assignee" className="text-sm font-medium">
                Assigned technician
              </label>
              <Select
                value={ticket.assignedToId ?? "none"}
                disabled={pending}
                onValueChange={assign}
              >
                <SelectTrigger id="ticket-assignee" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {canResolve ? (
            <div className="space-y-1.5">
              <label htmlFor="ticket-status" className="text-sm font-medium">
                Status
              </label>
              <Select value={ticket.status} disabled={pending} onValueChange={changeStatus}>
                <SelectTrigger id="ticket-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <form onSubmit={submitResolution} noValidate>
            <DialogHeader>
              <DialogTitle>{titleCase(targetStatus)} {ticket.ticketNo}</DialogTitle>
              <DialogDescription>
                Record what fixed the issue. Closing a ticket without this destroys the value of
                keeping a helpdesk history.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <TextAreaField
                name="resolution"
                label="Resolution"
                required
                rows={4}
                errors={errors.resolution}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResolveOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : titleCase(targetStatus)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
