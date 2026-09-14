import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BedDouble } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-header";
import { AppError } from "@/lib/result";
import { requirePagePermission } from "@/server/auth/page-guards";
import {
  getAccommodation,
  unhousedEmployees,
} from "@/server/services/accommodation";
import { orgOptions } from "@/server/services/org";
import { AccommodationEditButton } from "./accommodation-edit-button";
import { BedCell } from "./bed-cell";
import { RoomDialog } from "./room-dialog";
import { RoomActions } from "./room-actions";
import { DocumentsPanel } from "@/components/shared/documents-panel";

export const metadata: Metadata = { title: "Accommodation" };

export default async function AccommodationDetailPage({
  params,
}: {
  params: Promise<{ accommodationId: string }>;
}) {
  const ctx = await requirePagePermission("accommodation.view");
  const { accommodationId } = await params;
  const canManage = ctx.permissions.has("accommodation.manage");

  const accommodation = await getAccommodation(ctx, accommodationId).catch(
    (error: unknown) => {
      if (error instanceof AppError) notFound();
      throw error;
    },
  );

  const [employees, options] = await Promise.all([
    canManage
      ? unhousedEmployees(ctx, accommodation.companyId)
      : Promise.resolve([]),
    orgOptions(ctx),
  ]);

  const beds = accommodation.rooms.flatMap((r) => r.beds);
  const occupied = beds.filter((b) => b.assignments.length > 0).length;

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/accommodation">
              <ArrowLeft />
              All properties
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{accommodation.name}</h1>
            <p className="text-muted-foreground text-xs">
              {accommodation.company.code} · {accommodation.type.toLowerCase()}
              {accommodation.city ? ` · ${accommodation.city}` : ""} · {occupied}/
              {beds.length} beds occupied
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {accommodation.status !== "ACTIVE" ? (
            <Badge variant="outline">{accommodation.status}</Badge>
          ) : null}
          {canManage ? (
            <>
              <AccommodationEditButton
                accommodation={{
                  id: accommodation.id,
                  companyId: accommodation.companyId,
                  name: accommodation.name,
                  addressLine: accommodation.addressLine,
                  city: accommodation.city,
                  type: accommodation.type,
                  status: accommodation.status,
                  // Decimals and dates cross to the client as strings: a
                  // Decimal is not serialisable, and a date input wants
                  // YYYY-MM-DD rather than an ISO timestamp.
                  rentAmount: accommodation.rentAmount?.toString() ?? null,
                  rentCurrency: accommodation.rentCurrency,
                  rentFrequency: accommodation.rentFrequency,
                  rentDueDate: accommodation.rentDueDate?.toISOString().slice(0, 10) ?? null,
                  leaseStartDate:
                    accommodation.leaseStartDate?.toISOString().slice(0, 10) ?? null,
                  leaseEndDate: accommodation.leaseEndDate?.toISOString().slice(0, 10) ?? null,
                  notes: accommodation.notes,
                }}
                companies={options.companies}
              />
              <RoomDialog accommodationId={accommodation.id} />
            </>
          ) : null}
        </div>
      </div>

      {accommodation.addressLine ? (
        <p className="text-muted-foreground text-sm">{accommodation.addressLine}</p>
      ) : null}

      {accommodation.rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <BedDouble className="text-muted-foreground mx-auto size-6" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">No rooms yet</p>
          <p className="text-muted-foreground text-sm">
            Add a room, then add the beds it contains.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {accommodation.rooms.map((room) => (
            <section key={room.id} className="rounded-lg border">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    Room {room.roomNumber}
                    {room.floor ? (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · floor {room.floor}
                      </span>
                    ) : null}
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    {room.beds.length} of {room.capacity} bed
                    {room.capacity === 1 ? "" : "s"} added ·{" "}
                    {room.beds.filter((b) => b.assignments.length > 0).length} occupied
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {room.status !== "ACTIVE" ? (
                    <Badge variant="outline">{room.status}</Badge>
                  ) : null}
                  {canManage ? (
                    <RoomActions
                      room={{
                        id: room.id,
                        accommodationId: accommodation.id,
                        roomNumber: room.roomNumber,
                        floor: room.floor,
                        capacity: room.capacity,
                        status: room.status,
                        bedCount: room.beds.length,
                      }}
                    />
                  ) : null}
                </div>
              </header>

              {room.beds.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  No beds in this room yet.
                </p>
              ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  {room.beds.map((bed) => (
                    <BedCell
                      key={bed.id}
                      bed={{
                        id: bed.id,
                        roomId: room.id,
                        bedLabel: bed.bedLabel,
                        status: bed.status,
                        occupant: bed.assignments[0]
                          ? {
                              assignmentId: bed.assignments[0].id,
                              employeeName: bed.assignments[0].employee.fullName,
                              employeeNo: bed.assignments[0].employee.employeeNo,
                              checkInDate: bed.assignments[0].checkInDate
                                .toISOString()
                                .slice(0, 10),
                            }
                          : null,
                      }}
                      employees={employees}
                      canManage={canManage}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* The record's own document library. Renders nothing without
          documents.view, so no page needs to repeat that check. */}
      <DocumentsPanel
        ctx={ctx}
        entityType="ACCOMMODATION"
        entityId={accommodation.id}
        companyId={accommodation.companyId}
        title="Property documents"
      />
    </PageShell>
  );
}
