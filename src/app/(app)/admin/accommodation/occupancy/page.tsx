import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandscapePrint } from "@/components/shared/landscape-print";
import { PrintPageButton } from "@/components/shared/print-page-button";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/page-guards";
import { occupancySheet } from "@/server/services/accommodation";
import { orgOptions } from "@/server/services/org";

export const metadata: Metadata = { title: "Occupancy sheet" };

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
/** "PK" → "Pakistan"; anything that is not a country code prints as given. */
function country(code: string): string {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "1" → "Room 1"; a named room ("Hall") keeps its name. */
const roomLabel = (n: string) => (/^\d/.test(n) ? `Room ${n}` : n);

/**
 * Who lives where, one column per property — after the company's occupancy
 * spreadsheet: names and nationalities under each room, counts in red, and a
 * nationality summary.
 */
export default async function OccupancySheetPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const ctx = await requirePagePermission("accommodation.view");
  const { company } = await searchParams;
  const [{ companies }, properties] = await Promise.all([
    orgOptions(ctx),
    occupancySheet(ctx, company || undefined),
  ]);

  const byCountry = new Map<string, number>();
  for (const p of properties)
    for (const r of p.rooms)
      for (const o of r.occupants) {
        const c = country(o.nationality);
        byCountry.set(c, (byCountry.get(c) ?? 0) + 1);
      }
  const summary = [...byCountry.entries()].sort((a, b) => b[1] - a[1]);
  const total = summary.reduce((n, [, c]) => n + c, 0);
  const selected = companies.find((c) => c.id === company);

  return (
    <div className="mx-auto w-full space-y-4 p-6 print:space-y-0 print:p-0">
      <LandscapePrint />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/accommodation">
              <ArrowLeft />
              Accommodation
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">
            Occupancy sheet{selected ? ` — ${selected.code}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {companies.length > 1 ? (
            <div className="flex flex-wrap gap-1 text-xs">
              <CompanyChip href="/admin/accommodation/occupancy" active={!company} label="All" />
              {companies.map((c) => (
                <CompanyChip
                  key={c.id}
                  href={`/admin/accommodation/occupancy?company=${c.id}`}
                  active={company === c.id}
                  label={c.code}
                />
              ))}
            </div>
          ) : null}
          <PrintPageButton />
        </div>
      </div>

      <div
        className="occupancy-sheet bg-white p-4 text-[10.5px] leading-tight text-black print:p-0"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        {properties.length === 0 ? (
          <p className="text-sm">No active accommodation.</p>
        ) : (
          <div className="flex flex-wrap items-start gap-x-[1.6%] gap-y-4">
            {properties.map((p) => (
              <table
                key={p.id}
                className="w-[15.4%] min-w-[150px] table-fixed border-collapse border-2 border-black"
              >
                <colgroup>
                  <col className="w-[60%]" />
                  <col className="w-[40%]" />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="px-1 py-0.5 text-left text-[11.5px] font-bold">{p.name}</th>
                    <th className="px-1 py-0.5 text-right text-[11.5px] font-bold text-red-600">
                      {p.total}
                    </th>
                  </tr>
                </thead>
                {p.rooms.map((r) => (
                  <tbody key={r.id} className="border-b-2 border-black">
                    <tr className="border-b border-black">
                      <td className="px-1 font-bold">{roomLabel(r.roomNumber)}</td>
                      <td className="px-1 text-right font-bold text-red-600">
                        {r.occupants.length}
                      </td>
                    </tr>
                    {r.occupants.map((o) => (
                      <tr key={o.id} className="border-b border-neutral-400">
                        <td className="border-r border-neutral-400 px-1 break-words">{o.name}</td>
                        <td className="px-1 break-words">{country(o.nationality)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: r.freeBeds }, (_, i) => (
                      <tr
                        key={`free-${String(i)}`}
                        className="h-[15px] border-b border-neutral-400"
                      >
                        <td className="border-r border-neutral-400" />
                        <td />
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            ))}

            <table className="w-[15.4%] min-w-[150px] table-fixed border-collapse border-2 border-black">
              <tbody>
                {summary.map(([c, n]) => (
                  <tr key={c} className="border-b border-neutral-400">
                    <td className="border-r border-neutral-400 px-1">{c}</td>
                    <td className="px-1 text-right">{n}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-black font-bold text-red-600">
                  <td className="px-1">Total</td>
                  <td className="px-1 text-right">{total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md border px-2 py-1",
        active
          ? "bg-primary text-primary-foreground border-transparent"
          : "hover:bg-accent text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
}
