import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { requireCompanyAccess } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { monthStart } from "@/lib/schemas/timesheet";
import type { CreateTimesheetInput, SaveTimesheetInput } from "@/lib/schemas/timesheet";
import {
  initialDays,
  monthKey,
  periodDays,
  type DayCode,
  type TimesheetGroupValue,
  type Weekend,
} from "@/lib/timesheet";

/**
 * Monthly timesheets: the attendance grid, built from the employee records
 * (who was employed in the period, their days off, their leave), marked day by
 * day, printed, and the signed copy uploaded back.
 */

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** A sheet is visible only to someone who can see every company on it. */
function canSee(ctx: ActorContext, companyIds: readonly string[]) {
  return ctx.companyScope === "ALL" || companyIds.every((id) => ctx.companyScope.includes(id));
}

async function sheetInScope(ctx: ActorContext, id: string) {
  const sheet = await prisma.timesheet.findUnique({
    where: { id },
    select: { id: true, month: true, title: true, companyIds: true, group: true },
  });
  if (!sheet || !canSee(ctx, sheet.companyIds)) throw new NotFoundError("Timesheet not found.");
  return sheet;
}

export async function listTimesheets(ctx: ActorContext) {
  const rows = await prisma.timesheet.findMany({
    orderBy: [{ month: "desc" }, { title: "asc" }],
    take: 300,
    select: {
      id: true,
      month: true,
      title: true,
      companyIds: true,
      group: true,
      signedFileId: true,
      signedAt: true,
      signedFile: { select: { originalName: true } },
      _count: { select: { entries: true } },
    },
  });
  return rows.filter((r) => canSee(ctx, r.companyIds));
}

/**
 * Who belongs on a sheet: employees of its companies (and nationality group)
 * who were employed at some point in the period — joined by its last day, and
 * either still working or with a last working day inside or after it.
 */
async function eligibleEmployees(companyIds: string[], group: TimesheetGroupValue, days: Date[]) {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  return prisma.employee.findMany({
    where: {
      companyId: { in: companyIds },
      deletedAt: null,
      joiningDate: { lte: last },
      ...(group === "SAUDI" ? { nationality: "SA" } : {}),
      ...(group === "NON_SAUDI" ? { nationality: { not: "SA" } } : {}),
      OR: [
        { lastWorkingDate: { gte: first } },
        { lastWorkingDate: null, status: { in: ["ACTIVE", "ON_LEAVE"] } },
      ],
    },
    orderBy: { employeeNo: "asc" },
    select: {
      id: true,
      employeeNo: true,
      joiningDate: true,
      lastWorkingDate: true,
      contracts: { orderBy: { startDate: "desc" }, take: 1, select: { workDaysPerWeek: true } },
      leaveRequests: {
        where: { status: "APPROVED", startDate: { lte: last }, endDate: { gte: first } },
        select: { startDate: true, endDate: true, leaveType: { select: { key: true } } },
      },
    },
  });
}

type Eligible = Awaited<ReturnType<typeof eligibleEmployees>>[number];

function newRow(e: Eligible, days: Date[]) {
  // Five-day contracts have Friday and Saturday off; everyone else Friday.
  const weekend: Weekend = e.contracts[0]?.workDaysPerWeek === 5 ? "FRI_SAT" : "FRI";
  const codes = initialDays({
    days,
    weekend,
    joiningDate: e.joiningDate,
    lastWorkingDate: e.lastWorkingDate,
    leave: e.leaveRequests.map((l) => ({
      start: l.startDate,
      end: l.endDate,
      typeKey: l.leaveType.key,
    })),
  });
  return { employeeId: e.id, weekend, days: codes, extra: days.map(() => null) };
}

export async function createTimesheet(ctx: ActorContext, input: CreateTimesheetInput) {
  for (const id of input.companyIds) requireCompanyAccess(ctx, id);
  const companies = await prisma.company.findMany({
    where: { id: { in: input.companyIds } },
    orderBy: { code: "asc" },
    select: { id: true, code: true },
  });
  if (companies.length !== input.companyIds.length) throw new NotFoundError("Company not found.");

  const codes = companies.map((c) => c.code).join(" & ");
  const title = input.title ?? (input.group === "SAUDI" ? `S_${codes}` : codes);
  const days = periodDays(input.month);
  const employees = await eligibleEmployees(input.companyIds, input.group, days);

  const sheet = await prisma.timesheet.create({
    data: {
      month: monthStart(input.month),
      title,
      companyIds: companies.map((c) => c.id),
      group: input.group,
      createdById: ctx.userId,
      entries: {
        create: employees.map((e, i) => {
          const row = newRow(e, days);
          return {
            employeeId: row.employeeId,
            sortOrder: i,
            weekend: row.weekend,
            days: json(row.days),
            extra: json(row.extra),
          };
        }),
      },
    },
    select: { id: true, title: true, companyIds: true },
  });
  return { ...sheet, rows: employees.length };
}

/** The sheet with its rows, ready for the grid and the printout. */
export async function getTimesheet(ctx: ActorContext, id: string) {
  await sheetInScope(ctx, id);
  const sheet = await prisma.timesheet.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      month: true,
      title: true,
      companyIds: true,
      group: true,
      signedFileId: true,
      signedAt: true,
      signedFile: { select: { originalName: true } },
      entries: {
        orderBy: [{ sortOrder: "asc" }],
        select: {
          employeeId: true,
          weekend: true,
          updatedAt: true,
          days: true,
          extra: true,
          foodAllowance: true,
          employee: {
            select: {
              employeeNo: true,
              fullName: true,
              joiningDate: true,
              lastWorkingDate: true,
              company: { select: { code: true } },
            },
          },
        },
      },
    },
  });
  const companies = await prisma.company.findMany({
    where: { id: { in: sheet.companyIds } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, logoFileId: true, headerImageFileId: true },
  });
  const key = monthKey(sheet.month);
  const days = periodDays(key);
  return {
    ...sheet,
    monthKey: key,
    days: days.map((d) => d.toISOString().slice(0, 10)),
    companies,
    rows: sheet.entries.map((e) => ({
      employeeId: e.employeeId,
      employeeNo: e.employee.employeeNo,
      fullName: e.employee.fullName,
      companyCode: e.employee.company.code,
      joiningDate: e.employee.joiningDate.toISOString().slice(0, 10),
      lastWorkingDate: e.employee.lastWorkingDate?.toISOString().slice(0, 10) ?? null,
      weekend: toWeekend(e.weekend),
      days: fit<DayCode>(e.days, days.length, ""),
      extra: fit<number | null>(e.extra, days.length, null),
      foodAllowance: e.foodAllowance === null ? null : Number(e.foodAllowance),
    })),
    // Changes whenever a row is saved or added: the grid remounts on it.
    version: `${String(sheet.entries.length)}:${String(
      Math.max(0, ...sheet.entries.map((e) => e.updatedAt.getTime())),
    )}`,
  };
}

const toWeekend = (v: string): Weekend => (v === "FRI_SAT" ? "FRI_SAT" : "FRI");

/** A stored day array, padded or cut to the period's length. */
function fit<T>(value: unknown, length: number, blank: T): T[] {
  const arr = Array.isArray(value) ? (value as T[]) : [];
  return Array.from({ length }, (_, i) => arr[i] ?? blank);
}

export async function saveTimesheet(ctx: ActorContext, input: SaveTimesheetInput) {
  const sheet = await sheetInScope(ctx, input.id);
  const length = periodDays(monthKey(sheet.month)).length;
  for (const r of input.rows) {
    if (r.days.length !== length || r.extra.length !== length) {
      throw new ConflictError("The sheet changed size; reload the page and try again.");
    }
  }
  // One statement for the whole sheet: row-by-row updates of seventy people
  // over a remote database outlast a transaction's time limit.
  if (input.rows.length > 0) {
    const values = Prisma.join(
      input.rows.map(
        (r) =>
          Prisma.sql`(${r.employeeId}, ${r.weekend}, ${JSON.stringify(r.days)}::jsonb, ${JSON.stringify(r.extra)}::jsonb, ${r.foodAllowance}::numeric)`,
      ),
    );
    await prisma.$executeRaw`
      UPDATE "TimesheetEntry" AS t
      SET "weekend" = v.weekend, "days" = v.days, "extra" = v.extra, "foodAllowance" = v.food, "updatedAt" = now()
      FROM (VALUES ${values}) AS v(employee_id, weekend, days, extra, food)
      WHERE t."timesheetId" = ${input.id} AND t."employeeId" = v.employee_id`;
  }
  return { id: sheet.id, title: sheet.title, companyId: sheet.companyIds[0] ?? null };
}

/** Adds anyone who belongs on the sheet but is not on it yet (e.g. a new joiner). */
export async function addMissingRows(ctx: ActorContext, id: string) {
  const sheet = await sheetInScope(ctx, id);
  const days = periodDays(monthKey(sheet.month));
  const [eligible, existing] = await Promise.all([
    eligibleEmployees(sheet.companyIds, sheet.group, days),
    prisma.timesheetEntry.findMany({
      where: { timesheetId: id },
      select: { employeeId: true, sortOrder: true },
    }),
  ]);
  const have = new Set(existing.map((e) => e.employeeId));
  const missing = eligible.filter((e) => !have.has(e.id));
  let order = existing.reduce((n, e) => Math.max(n, e.sortOrder), -1);
  if (missing.length > 0) {
    await prisma.timesheetEntry.createMany({
      data: missing.map((e) => {
        const row = newRow(e, days);
        order += 1;
        return {
          timesheetId: id,
          employeeId: row.employeeId,
          sortOrder: order,
          weekend: row.weekend,
          days: json(row.days),
          extra: json(row.extra),
        };
      }),
    });
  }
  return { id, title: sheet.title, companyId: sheet.companyIds[0] ?? null, added: missing.length };
}

export async function removeRow(ctx: ActorContext, input: { id: string; employeeId: string }) {
  const sheet = await sheetInScope(ctx, input.id);
  await prisma.timesheetEntry.delete({
    where: { timesheetId_employeeId: { timesheetId: input.id, employeeId: input.employeeId } },
  });
  return { id: sheet.id, title: sheet.title, companyId: sheet.companyIds[0] ?? null };
}

export async function attachSignedCopy(ctx: ActorContext, input: { id: string; fileId: string }) {
  const sheet = await sheetInScope(ctx, input.id);
  const file = await prisma.fileObject.findUnique({
    where: { id: input.fileId },
    select: { uploadedById: true, scanStatus: true },
  });
  if (!file || file.scanStatus !== "CLEAN" || file.uploadedById !== ctx.userId) {
    throw new NotFoundError("Upload the signed copy again.");
  }
  await prisma.timesheet.update({
    where: { id: input.id },
    data: { signedFileId: input.fileId, signedAt: new Date() },
  });
  return { id: sheet.id, title: sheet.title, companyId: sheet.companyIds[0] ?? null };
}

export async function deleteTimesheet(ctx: ActorContext, id: string) {
  const sheet = await sheetInScope(ctx, id);
  await prisma.timesheet.delete({ where: { id } });
  return { id, title: sheet.title, companyId: sheet.companyIds[0] ?? null };
}
