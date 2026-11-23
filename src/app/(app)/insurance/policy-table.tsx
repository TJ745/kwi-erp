"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpiryDate } from "@/components/shared/expiry-alert";
import { StatusBadge } from "@/components/shared/status-badge";
import { setPolicyWorkingAction } from "@/server/actions/insurance";
import { PolicyDialog } from "./policy-dialog";

import { EnrolmentsDialog, type EnrolmentRow } from "./enrolments-dialog";

export type PolicyRow = {
  id: string;
  policyNumber: string;
  providerName: string;
  companyCode: string;
  /** Carried so the edit dialog can preselect the real company and provider —
   *  defaulting to the first in the list would silently reassign the policy. */
  companyId: string;
  providerId: string;
  className: string | null;
  startDate: string;
  expiryDate: string;
  status: string;
  isWorking: boolean;
  memberCount: number;
};

export function PolicyTable({
  policies,
  canManage,
  enrolments,
  employees,
  companies,
  providers,
}: {
  policies: PolicyRow[];
  canManage: boolean;
  enrolments: { policyId: string; rows: EnrolmentRow[] }[];
  employees: {
    id: string;
    fullName: string;
    employeeNo: string;
    companyId: string;
    status: string;
  }[];
  companies: { id: string; code: string; name: string }[];
  providers: { id: string; name: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">Medical insurance policies</caption>
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Policy</th>
            <th className="px-4 py-2 font-medium">Company</th>
            <th className="px-4 py-2 font-medium">Class</th>
            <th className="px-4 py-2 font-medium">Expires</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Working</th>
            <th className="px-4 py-2 font-medium">Members</th>
            {canManage ? <th className="px-4 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id} className="border-t">
              <td className="px-4 py-2">
                <p className="font-medium">{policy.providerName}</p>
                <p className="text-muted-foreground font-mono text-xs">{policy.policyNumber}</p>
              </td>
              <td className="px-4 py-2">{policy.companyCode}</td>
              <td className="text-muted-foreground px-4 py-2">{policy.className ?? "—"}</td>
              <td className="px-4 py-2">
                <ExpiryDate date={policy.expiryDate} horizonDays={60} />
              </td>
              <td className="px-4 py-2">
                <StatusBadge status={policy.status} />
              </td>
              <td className="px-4 py-2">
                <WorkingToggle policy={policy} canManage={canManage} />
              </td>
              <td className="px-4 py-2">
                <span className="inline-flex items-center gap-1">
                  <span className="tabular-nums">{policy.memberCount}</span>
                  <EnrolmentsDialog
                    policy={{
                      id: policy.id,
                      policyNumber: policy.policyNumber,
                      className: policy.className,
                      closed: policy.status === "EXPIRED" || policy.status === "CANCELLED",
                    }}
                    enrolments={enrolments.find((e) => e.policyId === policy.id)?.rows ?? []}
                    // Employees of every company can be covered.
                    employees={employees.map((e) => ({
                      id: e.id,
                      fullName: e.fullName,
                      employeeNo: e.employeeNo,
                      status: e.status,
                    }))}
                    canManage={canManage}
                  />
                </span>
              </td>
              {canManage ? (
                <td className="px-4 py-2 text-right">
                  <PolicyDialog companies={companies} providers={providers} policy={policy} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * "Working / not working" is a one-click change because it is reported by
 * phone from a clinic and needs recording immediately — opening a full edit
 * form for it would mean it often does not get recorded at all.
 */
function WorkingToggle({ policy, canManage }: { policy: PolicyRow; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (!canManage) {
    return (
      <Badge variant={policy.isWorking ? "valid" : "expired"}>
        {policy.isWorking ? "Working" : "Not working"}
      </Badge>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Mark ${policy.policyNumber} as ${policy.isWorking ? "not working" : "working"}`}
      onClick={() => {
        startTransition(async () => {
          const result = await setPolicyWorkingAction({
            id: policy.id,
            isWorking: !policy.isWorking,
          });
          if (result.success) {
            toast.success(policy.isWorking ? "Marked as not working." : "Marked as working again.");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      {policy.isWorking ? (
        <>
          <CircleCheck className="text-status-valid" />
          Working
        </>
      ) : (
        <>
          <CircleX className="text-status-expired" />
          Not working
        </>
      )}
    </Button>
  );
}
