import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FitToPage } from "@/components/shared/fit-to-page";
import { LandscapePrint } from "@/components/shared/landscape-print";
import { PrintPageButton } from "@/components/shared/print-page-button";
import { ChartTotals, PositionChart } from "@/components/shared/position-chart";
import { requirePagePermission } from "@/server/auth/page-guards";
import { positionChart } from "@/server/services/org-chart";

export const metadata: Metadata = { title: "Organization Chart" };

/** The organization chart on one landscape page, as the company prints it. */
export default async function OrgChartPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const ctx = await requirePagePermission("employees.view");
  const { c } = await searchParams;
  const chart = await positionChart(ctx, c ? c.split(",").filter(Boolean) : []);
  const codes = chart.companies.map((x) => x.code);

  return (
    <div className="mx-auto w-full space-y-4 p-6 print:space-y-0 print:p-0">
      <LandscapePrint />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/people/org-chart${c ? `?c=${c}` : ""}`}>
            <ArrowLeft />
            Organization Chart
          </Link>
        </Button>
        <PrintPageButton />
      </div>

      <div className="overflow-auto bg-white print:overflow-visible">
        <FitToPage>
          <div className="org-print space-y-4 p-2 text-black">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
              <div className="space-y-2">
                {chart.chosen.map((co) => (
                  <div key={co.id} className="flex items-center gap-2">
                    <span className="flex h-10 w-14 items-center justify-center border border-black text-sm font-bold">
                      {co.code}
                    </span>
                    {co.headerImageFileId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/companies/${co.id}/branding/header`}
                        alt={co.name}
                        className="max-h-12 max-w-[200px] object-contain object-left"
                      />
                    ) : (
                      <span className="text-sm font-semibold">{co.name}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-center font-bold" style={{ fontFamily: "Arial, sans-serif" }}>
                <p className="text-base">Organization Chart</p>
                <p className="text-base">{chart.chosen.map((x) => x.code).join(" & ")}</p>
              </div>
              <div />
            </div>

            <PositionChart tree={chart.tree} codes={codes} />

            <div className="flex justify-end">
              <ChartTotals totals={chart.totals} total={chart.total} codes={codes} />
            </div>
          </div>
        </FitToPage>
      </div>
    </div>
  );
}
