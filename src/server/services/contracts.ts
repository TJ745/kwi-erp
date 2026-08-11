import "server-only";
import type { ContractStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import {
  paginate,
  paginationFor,
  parseSort,
  type ListQuery,
  type Paginated,
} from "@/lib/list-query";
import type { ContractInput } from "@/lib/schemas/hr";
import { deactivateExpiry, syncExpiry } from "./expiry";

/**
 * Employment contracts.
 *
 * Contracts with an end date feed the ExpiryIndex projection, so a contract
 * expiring in 30 days appears on the dashboard alongside Iqama and passport
 * expiries without a second query path (ADR-005).
 *
 * Salary is sensitive: it is only selected when the actor holds
 * employees.salary.view, so it cannot leak through a list endpoint.
 */

const SORTABLE = ["startDate", "endDate", "status", "createdAt"] as const;

export type ContractListRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  companyCode: string;
  contractType: string;
  startDate: Date;
  endDate: Date | null;
  status: ContractStatus;
  /** Null when the actor may not see salary. */
  basicSalary: string | null;
  currency: string;
};

export async function listContracts(
  ctx: ActorContext,
  query: ListQuery,
  filters: { status?: string | undefined; employeeId?: string | undefined } = {},
): Promise<Paginated<ContractListRow>> {
  const sort = parseSort(query.sort, SORTABLE, { field: "endDate", direction: "asc" });
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  const where: Prisma.ContractWhereInput = {
    ...companyScopeWhere(ctx),
    ...(filters.status ? { status: filters.status as ContractStatus } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    ...(query.q
      ? {
          employee: {
            OR: [
              { fullName: { contains: query.q, mode: "insensitive" } },
              { employeeNo: { contains: query.q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy:
        sort.field === "endDate"
          ? { endDate: { sort: sort.direction, nulls: "last" } }
          : { [sort.field]: sort.direction },
      ...paginationFor(query),
      select: {
        id: true,
        employeeId: true,
        contractType: true,
        startDate: true,
        endDate: true,
        status: true,
        currency: true,
        // Selected conditionally — an unauthorised actor never receives it.
        basicSalary: canSeeSalary,
        employee: { select: { fullName: true, employeeNo: true } },
        company: { select: { code: true } },
      },
    }),
    prisma.contract.count({ where }),
  ]);

  return paginate(
    rows.map((c) => ({
      id: c.id,
      employeeId: c.employeeId,
      employeeName: c.employee.fullName,
      employeeNo: c.employee.employeeNo,
      companyCode: c.company.code,
      contractType: c.contractType,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      basicSalary: canSeeSalary && c.basicSalary ? c.basicSalary.toString() : null,
      currency: c.currency,
    })),
    total,
    query,
  );
}

export async function getContract(ctx: ActorContext, id: string) {
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  const contract = await prisma.contract.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      employeeId: true,
      companyId: true,
      contractType: true,
      startDate: true,
      endDate: true,
      probationEndDate: true,
      status: true,
      currency: true,
      notes: true,
      basicSalary: canSeeSalary,
      allowances: canSeeSalary,
      employee: { select: { fullName: true, employeeNo: true } },
    },
  });
  if (!contract) throw new NotFoundError("Contract not found.");
  return contract;
}

function allowancesOf(input: ContractInput): Prisma.InputJsonValue | undefined {
  const entries = {
    housing: input.housingAllowance ?? null,
    transport: input.transportAllowance ?? null,
    other: input.otherAllowance ?? null,
  };
  const hasAny = Object.values(entries).some((v) => v !== null);
  return hasAny ? entries : undefined;
}

export async function createContract(ctx: ActorContext, input: ContractInput) {
  requireCompanyAccess(ctx, input.companyId);

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, ...companyScopeWhere(ctx) },
    select: { id: true, fullName: true, companyId: true },
  });
  if (!employee) throw new NotFoundError("Employee not found.");
  if (employee.companyId !== input.companyId) {
    throw new ConflictError("The contract company must match the employee's company.");
  }

  // Two ACTIVE contracts would make "which one governs?" ambiguous for every
  // downstream report and letter.
  if (input.status === "ACTIVE") {
    const existing = await prisma.contract.findFirst({
      where: { employeeId: input.employeeId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError(
        "This employee already has an active contract. Mark it renewed or terminated first.",
      );
    }
  }

  const allowances = allowancesOf(input);

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        employeeId: input.employeeId,
        companyId: input.companyId,
        contractType: input.contractType,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        probationEndDate: input.probationEndDate ?? null,
        basicSalary: input.basicSalary ?? null,
        ...(allowances === undefined ? {} : { allowances }),
        currency: input.currency,
        status: input.status,
        notes: input.notes ?? null,
      },
      select: { id: true, endDate: true, status: true, companyId: true },
    });

    // Only an active, dated contract belongs in the expiry projection.
    if (contract.endDate && contract.status === "ACTIVE") {
      await syncExpiry(
        {
          source: "EMPLOYEE_CONTRACT",
          sourceId: contract.id,
          label: `Contract — ${employee.fullName}`,
          expiryDate: contract.endDate,
          employeeId: employee.id,
          companyId: contract.companyId,
        },
        tx,
      );
    }

    return { ...contract, employeeName: employee.fullName };
  });
}

export async function updateContract(
  ctx: ActorContext,
  input: ContractInput & { id: string },
) {
  const before = await getContract(ctx, input.id);
  requireCompanyAccess(ctx, input.companyId);

  if (input.status === "ACTIVE" && before.status !== "ACTIVE") {
    const existing = await prisma.contract.findFirst({
      where: {
        employeeId: input.employeeId,
        status: "ACTIVE",
        deletedAt: null,
        id: { not: input.id },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError("This employee already has an active contract.");
    }
  }

  const allowances = allowancesOf(input);

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.contract.update({
      where: { id: input.id },
      data: {
        contractType: input.contractType,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        probationEndDate: input.probationEndDate ?? null,
        basicSalary: input.basicSalary ?? null,
        ...(allowances === undefined ? {} : { allowances }),
        currency: input.currency,
        status: input.status,
        notes: input.notes ?? null,
      },
      select: { id: true, endDate: true, status: true, companyId: true },
    });

    // A contract that is no longer active, or has lost its end date, must stop
    // generating reminders.
    if (updated.endDate && updated.status === "ACTIVE") {
      await syncExpiry(
        {
          source: "EMPLOYEE_CONTRACT",
          sourceId: updated.id,
          label: `Contract — ${before.employee.fullName}`,
          expiryDate: updated.endDate,
          employeeId: input.employeeId,
          companyId: updated.companyId,
        },
        tx,
      );
    } else {
      await deactivateExpiry("EMPLOYEE_CONTRACT", updated.id, tx);
    }

    return updated;
  });

  return { before, after };
}

export type ContractCounts = { active: number; expiringIn90Days: number; expired: number };

export async function contractCounts(ctx: ActorContext): Promise<ContractCounts> {
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const scope = companyScopeWhere(ctx);

  const [active, expiringIn90Days, expired] = await Promise.all([
    prisma.contract.count({ where: { ...scope, status: "ACTIVE" } }),
    prisma.contract.count({
      where: { ...scope, status: "ACTIVE", endDate: { gte: now, lte: in90 } },
    }),
    prisma.contract.count({
      where: { ...scope, status: "ACTIVE", endDate: { lt: now } },
    }),
  ]);

  return { active, expiringIn90Days, expired };
}

/** Contracts for one employee — powers the profile tab. */
export async function contractsForEmployee(ctx: ActorContext, employeeId: string) {
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  return prisma.contract.findMany({
    where: { employeeId, ...companyScopeWhere(ctx) },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      contractType: true,
      startDate: true,
      endDate: true,
      probationEndDate: true,
      status: true,
      currency: true,
      basicSalary: canSeeSalary,
    },
  });
}
