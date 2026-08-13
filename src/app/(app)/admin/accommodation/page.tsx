import type { Metadata } from "next";
import Link from "next/link";
import { Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import { accommodationCounts, listAccommodations } from "@/server/services/accommodation";
import { orgOptions } from "@/server/services/org";
import { AccommodationDialog } from "./accommodation-dialog";

export const metadata: Metadata = { title: "Accommodation" };

export default async function AccommodationPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requirePagePermission("accommodation.view");
  const { q, status } = await searchParams;
  const canManage = ctx.permissions.has("accommodation.manage");

  const [accommodations, counts, options] = await Promise.all([
    listAccommodations(ctx, { ...(q ? { q } : {}), ...(status ? { status } : {}) }),
    accommodationCounts(ctx),
    orgOptions(ctx),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Accommodation"
        description="Properties, rooms, and beds. Occupancy is counted from live check-ins, and one occupant per bed is enforced by the database, not by the form."
        action={canManage ? <AccommodationDialog companies={options.companies} /> : null}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Properties" value={counts.properties} />
        <StatCard label="Beds" value={counts.beds} />
        <StatCard label="Occupied" value={counts.occupied} />
        <StatCard
          label="Available"
          value={counts.available}
          tone={counts.available === 0 && counts.beds > 0 ? "warning" : "neutral"}
        />
      </div>

      <SearchInput placeholder="Search name or city…" />

      {accommodations.length === 0 ? (
        <EmptyState
          icon={Building}
          title={q ? "No matching properties" : "No accommodation"}
          description={
            q
              ? "Try a different search term."
              : "Add a property, then give it rooms and beds."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accommodations.map((a) => {
            const occupancy = a.bedCount > 0 ? Math.round((a.occupied / a.bedCount) * 100) : 0;

            return (
              <Link key={a.id} href={`/admin/accommodation/${a.id}`}>
                <Card className="hover:border-foreground/20 h-full gap-0 py-4 transition-colors">
                  <CardContent className="space-y-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{a.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {a.companyCode} · {a.type.toLowerCase()}
                          {a.city ? ` · ${a.city}` : ""}
                        </p>
                      </div>
                      {a.status !== "ACTIVE" ? (
                        <Badge variant="outline">{a.status}</Badge>
                      ) : null}
                    </div>

                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-semibold tabular-nums">
                        {a.occupied}/{a.bedCount}
                      </p>
                      <p className="text-muted-foreground text-xs">beds occupied</p>
                    </div>

                    {/* A bar rather than a number alone: "18/20" reads slower
                        than a nearly-full bar when scanning a list. */}
                    <div
                      className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                      role="img"
                      aria-label={`${String(occupancy)} percent occupied`}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          occupancy >= 100 ? "bg-status-warning" : "bg-foreground/60",
                        )}
                        style={{ width: `${String(occupancy)}%` }}
                      />
                    </div>

                    <p className="text-muted-foreground text-xs">
                      {a.roomCount} room{a.roomCount === 1 ? "" : "s"} · {a.available}{" "}
                      available
                      {a.outOfService > 0 ? ` · ${a.outOfService} out of service` : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            tone === "warning" && "text-status-warning",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
