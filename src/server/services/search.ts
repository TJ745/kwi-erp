import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import type { PermissionKey } from "@/lib/permissions";

/**
 * Global search — brief §38.
 *
 * A third cross-cutting read path, after reports and exports, and the same rule
 * governs it: a result must never reveal something the actor cannot open.
 * Every source below carries its own permission AND its own company scope, and
 * a source whose permission is missing is not queried at all — an empty result
 * set is cheaper and safer than filtering afterwards.
 *
 * Credentials are searchable by NAME only, behind vault.view. The name is what
 * makes the vault navigable; nothing else about a credential appears here.
 *
 * Backed by the trigram GIN indexes added in Phase 2, so `contains` stays
 * indexed rather than degrading to a sequential scan.
 */

export type SearchHit = {
  id: string;
  group: string;
  title: string;
  subtitle: string | null;
  href: string;
};

/** Below this a trigram search matches most of the table. */
const MIN_QUERY_LENGTH = 2;
const PER_SOURCE_LIMIT = 5;

export async function globalSearch(ctx: ActorContext, rawQuery: string): Promise<SearchHit[]> {
  const query = rawQuery.trim().slice(0, 100);
  if (query.length < MIN_QUERY_LENGTH) return [];
  if (!ctx.permissions.has("search.global")) return [];

  const can = (permission: PermissionKey) => ctx.permissions.has(permission);
  const insensitive = { contains: query, mode: "insensitive" as const };

  const sources: Promise<SearchHit[]>[] = [];

  if (can("employees.view")) {
    sources.push(
      prisma.employee
        .findMany({
          where: {
            deletedAt: null,
            ...companyScopeWhere(ctx),
            OR: [
              { fullName: insensitive },
              { fullNameAr: insensitive },
              { employeeNo: insensitive },
            ],
          },
          orderBy: { fullName: "asc" },
          take: PER_SOURCE_LIMIT,
          select: {
            id: true,
            fullName: true,
            employeeNo: true,
            status: true,
            company: { select: { code: true } },
          },
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            group: "Employees",
            title: r.fullName,
            subtitle: `${r.employeeNo} · ${r.company.code} · ${r.status.toLowerCase()}`,
            href: `/people/employees/${r.id}`,
          })),
        ),
    );
  }

  if (can("it.assets.view")) {
    sources.push(
      prisma.iTAsset
        .findMany({
          where: {
            deletedAt: null,
            ...companyScopeWhere(ctx),
            OR: [{ assetCode: insensitive }, { serialNumber: insensitive }],
          },
          take: PER_SOURCE_LIMIT,
          select: { id: true, assetCode: true, brand: true, model: true, status: true },
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            group: "IT assets",
            title: `${r.assetCode} — ${r.brand} ${r.model}`,
            subtitle: r.status.toLowerCase(),
            href: `/it/assets/${r.id}`,
          })),
        ),
    );
  }

  if (can("vehicles.view")) {
    sources.push(
      prisma.vehicle
        .findMany({
          where: {
            deletedAt: null,
            ...companyScopeWhere(ctx),
            OR: [{ plateNumber: insensitive }, { vehicleCode: insensitive }],
          },
          take: PER_SOURCE_LIMIT,
          select: { id: true, plateNumber: true, make: true, model: true, vehicleCode: true },
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            group: "Vehicles",
            title: `${r.plateNumber} — ${r.make} ${r.model}`,
            subtitle: r.vehicleCode,
            href: `/vehicles/${r.id}`,
          })),
        ),
    );
  }

  if (can("documents.view")) {
    sources.push(
      prisma.document
        .findMany({
          where: { deletedAt: null, ...companyScopeWhere(ctx), title: insensitive },
          take: PER_SOURCE_LIMIT,
          select: {
            id: true,
            title: true,
            documentNo: true,
            documentType: { select: { name: true } },
          },
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            group: "Documents",
            title: r.title,
            subtitle: `${r.documentType.name}${r.documentNo ? ` · ${r.documentNo}` : ""}`,
            href: "/documents",
          })),
        ),
    );
  }

  if (can("subcontractors.view")) {
    sources.push(
      prisma.subcontractor
        .findMany({
          where: { deletedAt: null, name: insensitive },
          take: PER_SOURCE_LIMIT,
          select: { id: true, name: true, code: true },
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            group: "Subcontractors",
            title: r.name,
            subtitle: r.code,
            href: `/admin/subcontractors/${r.id}`,
          })),
        ),
    );
  }

  // Names only, behind vault.view. A credential's name is what makes the vault
  // navigable; nothing else about it is searchable, and the secret itself is
  // only ever reached through the vault's own reveal flow (SECURITY.md §5).
  if (can("vault.view")) {
    sources.push(
      prisma.credential
        .findMany({
          where: { deletedAt: null, ...companyScopeWhere(ctx), name: insensitive },
          take: PER_SOURCE_LIMIT,
          select: { id: true, name: true, category: { select: { name: true } } },
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            group: "Vault",
            title: r.name,
            subtitle: r.category?.name ?? "Credential",
            href: "/it/vault",
          })),
        ),
    );
  }

  const results = await Promise.all(sources);
  return results.flat();
}
