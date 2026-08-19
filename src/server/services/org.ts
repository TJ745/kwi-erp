import "server-only";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere, optionalCompanyScopeWhere, requireCompanyAccess } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";
import {
  isLetterheadEligible,
  slotColumn,
  type LetterheadSlot,
} from "@/lib/letterhead";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/result";
import type {
  CompanyInput,
  DepartmentInput,
  PositionInput,
} from "@/lib/schemas/org";

/** Companies, departments, and positions. */

// --- Companies ---------------------------------------------------------------

export async function listCompanies(ctx: ActorContext) {
  return prisma.company.findMany({
    where: {
      ...(ctx.companyScope === "ALL" ? {} : { id: { in: [...ctx.companyScope] } }),
    },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      shortName: true,
      city: true,
      status: true,
      crNumber: true,
      registrationNo: true,
      vatNumber: true,
      addressLine: true,
      country: true,
      phone: true,
      email: true,
      website: true,
      // Presence only — the page renders an <img> at the branding route and
      // never needs the file id itself.
      headerImageFileId: true,
      footerImageFileId: true,
      _count: { select: { employees: true, departments: true } },
    },
  });
}

export async function getCompany(ctx: ActorContext, id: string) {
  const company = await prisma.company.findFirst({
    where: { id, ...(ctx.companyScope === "ALL" ? {} : { id: { in: [...ctx.companyScope] } }) },
  });
  if (!company) throw new NotFoundError("Company not found.");
  return company;
}

/**
 * Optional form fields arrive as `undefined`, but the columns are nullable.
 * Mapping explicitly keeps `exactOptionalPropertyTypes` satisfied and makes
 * "cleared by the user" (null) distinct from "not supplied".
 */
function companyData(input: CompanyInput) {
  return {
    code: input.code,
    name: input.name,
    nameAr: input.nameAr ?? null,
    shortName: input.shortName,
    registrationNo: input.registrationNo ?? null,
    crNumber: input.crNumber ?? null,
    vatNumber: input.vatNumber ?? null,
    addressLine: input.addressLine ?? null,
    city: input.city ?? null,
    country: input.country,
    phone: input.phone ?? null,
    email: input.email ? input.email : null,
    website: input.website ?? null,
    status: input.status,
    notes: input.notes ?? null,
  };
}

export async function createCompany(ctx: ActorContext, input: CompanyInput) {
  void ctx;
  const existing = await prisma.company.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError(`A company with code ${input.code} already exists.`);

  return prisma.company.create({ data: companyData(input) });
}

export async function updateCompany(
  ctx: ActorContext,
  input: CompanyInput & { id: string },
) {
  const before = await getCompany(ctx, input.id);

  const clash = await prisma.company.findFirst({
    where: { code: input.code, id: { not: input.id } },
    select: { id: true },
  });
  if (clash) throw new ConflictError(`A company with code ${input.code} already exists.`);

  const after = await prisma.company.update({
    where: { id: input.id },
    data: companyData(input),
  });

  return { before, after };
}

// --- Company letterhead ------------------------------------------------------

/**
 * Points a company's header or footer artwork at an uploaded file, or clears it.
 *
 * The file is re-checked here rather than trusted from the upload round-trip:
 * the client supplies the id, so "an image, verified, that exists" has to be
 * established server-side or the field becomes a way to point letterhead at any
 * file id in the system.
 */
export async function setCompanyBranding(
  ctx: ActorContext,
  input: { companyId: string; slot: LetterheadSlot; fileId: string | null },
) {
  // Throws NotFoundError for a company outside the caller's scope.
  const company = await getCompany(ctx, input.companyId);

  if (input.fileId !== null) {
    const file = await prisma.fileObject.findFirst({
      where: { id: input.fileId },
      select: { id: true, mimeType: true, detectedType: true, scanStatus: true },
    });
    if (!file) throw new NotFoundError("File not found.");

    if (!isLetterheadEligible(file)) {
      throw new ValidationError("Letterhead artwork must be a PNG, JPEG, or WebP image.");
    }
  }

  const after = await prisma.company.update({
    where: { id: company.id },
    data: { [slotColumn(input.slot)]: input.fileId },
    select: { id: true, code: true, headerImageFileId: true, footerImageFileId: true },
  });

  return {
    company: after,
    before: input.slot === "HEADER" ? company.headerImageFileId : company.footerImageFileId,
  };
}

/**
 * The stored file behind one letterhead slot, for the branding route to stream.
 *
 * Takes no ActorContext: the route establishes the session and checks company
 * scope before calling. "Which company" is the thing being authorised, and once
 * that is settled this only has to resolve a file — so leaving the check out
 * here keeps it in one obvious place instead of two half-places.
 */
export async function resolveCompanyBrandingFile(
  companyId: string,
  slot: LetterheadSlot,
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      headerImage: {
        select: { fileKey: true, mimeType: true, detectedType: true, scanStatus: true },
      },
      footerImage: {
        select: { fileKey: true, mimeType: true, detectedType: true, scanStatus: true },
      },
    },
  });

  const file = slot === "HEADER" ? company?.headerImage : company?.footerImage;

  // Re-checked on the way out, not just on the way in. This route sets a
  // Content-Type from stored data, so a row that stopped being eligible after
  // it was set — a failed rescan, a hand-edited record — must stop serving.
  // An unset slot, an unknown company, and an ineligible file are one outcome.
  if (!file || !isLetterheadEligible(file)) return null;
  return { fileKey: file.fileKey, mimeType: file.mimeType };
}

// --- Departments -------------------------------------------------------------

export async function listDepartments(ctx: ActorContext) {
  return prisma.department.findMany({
    where: companyScopeWhere(ctx),
    orderBy: [{ company: { code: "asc" } }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      companyId: true,
      parentId: true,
      headEmployeeId: true,
      company: { select: { code: true } },
      parent: { select: { name: true } },
      headEmployee: { select: { id: true, fullName: true, employeeNo: true } },
      _count: { select: { employees: true, children: true } },
    },
  });
}

export async function createDepartment(ctx: ActorContext, input: DepartmentInput) {
  requireCompanyAccess(ctx, input.companyId);

  const existing = await prisma.department.findUnique({
    where: { companyId_code: { companyId: input.companyId, code: input.code } },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`Department code ${input.code} already exists for this company.`);
  }

  await assertParentIsSameCompany(input.parentId, input.companyId);
  await assertHeadIsSameCompany(input.headEmployeeId, input.companyId);

  return prisma.department.create({
    data: {
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      nameAr: input.nameAr ?? null,
      parentId: input.parentId ?? null,
      headEmployeeId: input.headEmployeeId ?? null,
      status: input.status,
    },
  });
}

export async function updateDepartment(
  ctx: ActorContext,
  input: DepartmentInput & { id: string },
) {
  const before = await prisma.department.findUnique({ where: { id: input.id } });
  if (!before) throw new NotFoundError("Department not found.");
  requireCompanyAccess(ctx, before.companyId);
  requireCompanyAccess(ctx, input.companyId);

  const clash = await prisma.department.findFirst({
    where: { companyId: input.companyId, code: input.code, id: { not: input.id } },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictError(`Department code ${input.code} already exists for this company.`);
  }

  // A department cannot be its own ancestor — that would create a cycle the
  // manager-scope walk could never terminate on.
  if (input.parentId) {
    if (input.parentId === input.id) {
      throw new ConflictError("A department cannot be its own parent.");
    }
    await assertNotDescendant(input.id, input.parentId);
    await assertParentIsSameCompany(input.parentId, input.companyId);
  }

  await assertHeadIsSameCompany(input.headEmployeeId, input.companyId);

  const after = await prisma.department.update({
    where: { id: input.id },
    data: {
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      nameAr: input.nameAr ?? null,
      parentId: input.parentId ?? null,
      headEmployeeId: input.headEmployeeId ?? null,
      status: input.status,
    },
  });

  return { before, after };
}

/**
 * A department head must be an employee of the same company.
 *
 * Without this, a head could be set to anyone whose id was guessed — including
 * someone in the other entity — and the department card would then name a
 * person the viewer may have no right to see.
 */
async function assertHeadIsSameCompany(
  headEmployeeId: string | undefined,
  companyId: string,
) {
  if (!headEmployeeId) return;

  const head = await prisma.employee.findUnique({
    where: { id: headEmployeeId },
    select: { companyId: true, deletedAt: true },
  });
  if (!head || head.deletedAt) throw new NotFoundError("That employee was not found.");
  if (head.companyId !== companyId) {
    throw new ConflictError("A department head must belong to the same company.");
  }
}

async function assertParentIsSameCompany(parentId: string | undefined, companyId: string) {
  if (!parentId) return;
  const parent = await prisma.department.findUnique({
    where: { id: parentId },
    select: { companyId: true },
  });
  if (!parent) throw new NotFoundError("Parent department not found.");
  if (parent.companyId !== companyId) {
    throw new ConflictError("The parent department must belong to the same company.");
  }
}

/** Walks up from `candidateParent`; if we meet `id`, the move creates a cycle. */
async function assertNotDescendant(id: string, candidateParentId: string) {
  let cursor: string | null = candidateParentId;

  for (let depth = 0; cursor && depth < 20; depth += 1) {
    if (cursor === id) {
      throw new ConflictError("That would place the department inside its own subtree.");
    }
    const parent: { parentId: string | null } | null = await prisma.department.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
}

// --- Positions ---------------------------------------------------------------

export async function listPositions(ctx: ActorContext) {
  return prisma.position.findMany({
    where: optionalCompanyScopeWhere(ctx),
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      titleAr: true,
      grade: true,
      status: true,
      companyId: true,
      company: { select: { code: true } },
      _count: { select: { employees: true } },
    },
  });
}

export async function createPosition(ctx: ActorContext, input: PositionInput) {
  if (input.companyId) requireCompanyAccess(ctx, input.companyId);

  const existing = await prisma.position.findFirst({
    where: { title: input.title, companyId: input.companyId ?? null },
    select: { id: true },
  });
  if (existing) throw new ConflictError(`Position "${input.title}" already exists.`);

  return prisma.position.create({
    data: {
      title: input.title,
      titleAr: input.titleAr ?? null,
      grade: input.grade ?? null,
      companyId: input.companyId ?? null,
      status: input.status,
    },
  });
}

export async function updatePosition(
  ctx: ActorContext,
  input: PositionInput & { id: string },
) {
  const before = await prisma.position.findUnique({ where: { id: input.id } });
  if (!before) throw new NotFoundError("Position not found.");
  if (before.companyId) requireCompanyAccess(ctx, before.companyId);
  if (input.companyId) requireCompanyAccess(ctx, input.companyId);

  const after = await prisma.position.update({
    where: { id: input.id },
    data: {
      title: input.title,
      titleAr: input.titleAr ?? null,
      grade: input.grade ?? null,
      companyId: input.companyId ?? null,
      status: input.status,
    },
  });

  return { before, after };
}

/** Options for the department/position selects on the employee form. */
export async function orgOptions(ctx: ActorContext) {
  const [companies, departments, positions] = await Promise.all([
    prisma.company.findMany({
      where: ctx.companyScope === "ALL" ? {} : { id: { in: [...ctx.companyScope] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.department.findMany({
      where: { status: "ACTIVE", ...companyScopeWhere(ctx) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    prisma.position.findMany({
      where: { status: "ACTIVE", ...optionalCompanyScopeWhere(ctx) },
      orderBy: { title: "asc" },
      select: { id: true, title: true, companyId: true },
    }),
  ]);

  return { companies, departments, positions };
}
