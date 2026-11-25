import "server-only";
import { PAY_SELECT } from "@/lib/salary";
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
import { NATIONALITIES } from "@/lib/employment-contract";
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

/** The printed contract's fields, mapped for create and update alike. */
function documentData(input: ContractInput) {
  return {
    contractDate: input.contractDate ?? null,
    positionTitle: input.positionTitle ?? null,
    jobDescriptionId: input.jobDescriptionId ?? null,
    termYears: input.termYears,
    workDaysPerWeek: input.workDaysPerWeek,
    hoursPerDay: input.hoursPerDay,
    ...(input.particulars ? { particulars: input.particulars } : {}),
  };
}

function allowancesOf(input: ContractInput): Prisma.InputJsonValue | undefined {
  const entries = {
    housing: input.housingAllowance ?? null,
    transport: input.transportAllowance ?? null,
    other: input.otherAllowance ?? null,
    food: input.foodAllowance ?? null,
    additional: input.additionalAllowance ?? null,
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
        ...documentData(input),
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

export async function updateContract(ctx: ActorContext, input: ContractInput & { id: string }) {
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
        ...documentData(input),
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
      notes: true,
      basicSalary: canSeeSalary,
      allowances: canSeeSalary,
      contractDate: true,
      positionTitle: true,
      jobDescriptionId: true,
      termYears: true,
      workDaysPerWeek: true,
      hoursPerDay: true,
      particulars: true,
    },
  });
}

/** The editable fields of the given contracts (the Contracts page's rows). */
export async function contractsForEdit(ctx: ActorContext, ids: string[]) {
  const canSeeSalary = ctx.permissions.has("employees.salary.view");

  return prisma.contract.findMany({
    where: { id: { in: ids }, ...companyScopeWhere(ctx) },
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
      contractDate: true,
      positionTitle: true,
      jobDescriptionId: true,
      termYears: true,
      workDaysPerWeek: true,
      hoursPerDay: true,
      particulars: true,
    },
  });
}

/** Reads a single allowance out of the Json column without trusting its shape. */
export function allowanceValue(
  allowances: unknown,
  key: "housing" | "transport" | "other" | "food" | "additional",
): string | null {
  if (allowances === null || typeof allowances !== "object") return null;
  const value = (allowances as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

const dmy = (d: Date | null | undefined) =>
  d
    ? [
        String(d.getUTCDate()).padStart(2, "0"),
        String(d.getUTCMonth() + 1).padStart(2, "0"),
        String(d.getUTCFullYear()),
      ].join("/")
    : "";

/**
 * What a new contract starts from: the employee's record (particulars,
 * addresses, salary and terms), and for anything the record leaves blank, the
 * offer they were hired on. Everything here is a suggestion the form can change.
 */
export async function contractDefaults(ctx: ActorContext, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ...companyScopeWhere(ctx) },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      familyName: true,
      fullNameAr: true,
      nationality: true,
      dateOfBirth: true,
      saudiAddressEn: true,
      saudiAddressAr: true,
      homeAddressEn: true,
      homeAddressAr: true,
      homePhone: true,
      contractYears: true,
      ticketDestination: true,
      ticketCover: true,
      ...PAY_SELECT,
      position: { select: { title: true } },
      iqama: { select: { iqamaNumber: true } },
      passport: { select: { passportNumber: true } },
      jobOfferOrigin: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          contractYears: true,
          ticketDestination: true,
          ticketCover: true,
          candidateAddress: true,
          basicSalary: true,
          housingAllowance: true,
          transportAllowance: true,
          mobileAllowance: true,
          candidateIdType: true,
          candidateIdNumber: true,
        },
      },
    },
  });
  if (!employee) throw new NotFoundError("Employee not found.");
  const offer = employee.jobOfferOrigin[0];
  const nat = NATIONALITIES[employee.nationality];
  const legalName = [
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.familyName,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  const canSeeSalary = ctx.permissions.has("employees.salary.view");
  const str = (v: { toString(): string } | null | undefined) => (v ? v.toString() : "");

  return {
    positionTitle: employee.position?.title ?? "",
    termYears: employee.contractYears ?? offer?.contractYears ?? 1,
    salary: canSeeSalary
      ? {
          basicSalary: str(employee.basicSalary ?? offer?.basicSalary),
          housingAllowance: str(employee.housingAllowance ?? offer?.housingAllowance),
          transportAllowance: str(employee.transportAllowance ?? offer?.transportAllowance),
          // The contract's "Phone allowance" line is the mobile allowance.
          otherAllowance: str(employee.mobileAllowance ?? offer?.mobileAllowance),
          foodAllowance: str(employee.foodAllowance),
          additionalAllowance: str(employee.otherAllowance),
        }
      : null,
    particulars: {
      nameEn: legalName,
      nameAr: employee.fullNameAr ?? "",
      nationalityEn: nat?.en ?? employee.nationality,
      nationalityAr: nat?.ar ?? "",
      iqamaNo:
        employee.iqama?.iqamaNumber ??
        (offer?.candidateIdType === "IQAMA" ? (offer.candidateIdNumber ?? "") : ""),
      passportNo:
        employee.passport?.passportNumber ??
        (offer?.candidateIdType === "PASSPORT" ? (offer.candidateIdNumber ?? "") : ""),
      dateOfBirth: dmy(employee.dateOfBirth),
      homeAddressEn: employee.homeAddressEn ?? offer?.candidateAddress ?? "",
      homeAddressAr: employee.homeAddressAr ?? "",
      saudiAddressEn: employee.saudiAddressEn ?? "",
      saudiAddressAr: employee.saudiAddressAr ?? "",
      homePhone: employee.homePhone ?? "",
      ticketDestinationEn: employee.ticketDestination ?? offer?.ticketDestination ?? "",
      ticketDestinationAr: "",
      ticketWife: (employee.ticketCover ?? offer?.ticketCover) === "SELF_FAMILY",
      ticketChildren: 0,
    },
  };
}

/** Everything the printed contract needs. */
export async function getContractForPrint(ctx: ActorContext, id: string) {
  const contract = await prisma.contract.findFirst({
    where: { id, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      startDate: true,
      contractDate: true,
      createdAt: true,
      positionTitle: true,
      jobDescriptionId: true,
      termYears: true,
      workDaysPerWeek: true,
      hoursPerDay: true,
      particulars: true,
      basicSalary: true,
      allowances: true,
      employee: {
        select: {
          id: true,
          employeeNo: true,
          fullName: true,
          gender: true,
          position: { select: { title: true } },
        },
      },
      company: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          crNumber: true,
          addressLine: true,
          addressAr: true,
          city: true,
          cityAr: true,
          headOfficeCity: true,
          headOfficeCityAr: true,
          signatoryName: true,
          signatoryNameAr: true,
          signatoryTitle: true,
          signatoryTitleAr: true,
          headerImageFileId: true,
          footerImageFileId: true,
        },
      },
    },
  });
  if (!contract) throw new NotFoundError("Contract not found.");

  const jd = contract.jobDescriptionId
    ? await prisma.jobDescription.findUnique({
        where: { id: contract.jobDescriptionId },
        select: { title: true, departmental: true, organizational: true },
      })
    : null;

  return {
    ...contract,
    jobDescription: jd,
    contractDateLabel: dmy(contract.contractDate ?? contract.startDate),
  };
}
