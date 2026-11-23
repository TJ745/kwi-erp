import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-header";
import { AppError } from "@/lib/result";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getEvaluation, managerOptions } from "@/server/services/evaluations";
import { RemoveEvaluation } from "../remove-evaluation";
import { StaffForm } from "./staff-form";
import { WorkerForm } from "./worker-form";

export const metadata: Metadata = { title: "Evaluation" };

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ listId: string; evaluationId: string }>;
}) {
  const ctx = await requirePagePermission("hr.evaluations.view");
  const canManage = ctx.permissions.has("hr.evaluations.manage");
  const { listId, evaluationId } = await params;

  const e = await getEvaluation(ctx, evaluationId).catch((error: unknown) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  if (e.list.id !== listId) notFound();
  const managers = e.template === "STAFF" ? await managerOptions(ctx) : [];

  const employee = {
    name: e.employee.fullName,
    employeeNo: e.employee.employeeNo,
    position: e.employee.position?.title ?? "",
  };

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/hr/evaluations/${listId}`}>
              <ArrowLeft />
              {e.list.title}
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {e.employee.fullName}{" "}
              <span className="text-muted-foreground font-mono text-sm">
                {e.employee.employeeNo}
              </span>
            </h1>
            <Badge variant="outline">
              {e.template === "STAFF"
                ? "Staff — Performance & Development Plan"
                : "Worker — Performance Appraisal"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/hr/evaluations/${listId}/${e.id}/print`}>
              <Printer />
              Print
            </Link>
          </Button>
          {canManage ? (
            <RemoveEvaluation
              id={e.id}
              label={`${e.employee.employeeNo} — ${e.employee.fullName}`}
              afterDelete={`/hr/evaluations/${listId}`}
            />
          ) : null}
        </div>
      </div>

      {e.staff ? (
        <StaffForm
          canManage={canManage}
          managers={managers}
          evaluation={{
            id: e.id,
            evaluationDate: day(e.evaluationDate),
            managerId: e.managerId,
            timeInPosition: e.timeInPosition ?? "",
            pdpStarted: day(e.pdpStarted),
            pdpCompleted: day(e.pdpCompleted),
            managerComments: e.managerComments ?? "",
            employeeComments: e.employeeComments ?? "",
            finalRating: e.finalRating ?? "",
            data: e.staff,
            employee,
          }}
        />
      ) : e.worker ? (
        <WorkerForm
          canManage={canManage}
          evaluation={{
            id: e.id,
            evaluationDate: day(e.evaluationDate),
            section: e.section ?? "",
            data: e.worker,
            employee: {
              ...employee,
              department: e.employee.department?.name ?? "",
              joiningDate: day(e.employee.joiningDate),
            },
          }}
        />
      ) : null}
    </PageShell>
  );
}
