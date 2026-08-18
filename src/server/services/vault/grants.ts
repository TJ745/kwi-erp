import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { optionalCompanyScopeWhere } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/result";
import { resolvePermissions, SUPER_ADMIN_ROLE_KEY } from "@/lib/permissions";
import { manageHolders, type CandidateUser } from "@/lib/vault-grants";

/**
 * Per-credential access control — the `vault.grant` permission.
 *
 * These rows have always been read and enforced (`grantedCredentialIds` in
 * ./credentials.ts) but nothing could create one, so the ACL could only ever be
 * empty. That is the half-built shape this closes.
 *
 * The semantics are the surprising part, and the UI says so out loud: a grant
 * NARROWS access, it does not widen it. A credential with no grants is open to
 * anyone holding the global vault permission; the moment one grant exists, only
 * the people named by a grant can reach it.
 *
 * Which is why the guard below exists. There is no administrator exemption in
 * the resolver — established by experiment, not assumption: a credential
 * visible to a SUPER_ADMIN became invisible to them the instant a grant naming
 * somebody else was added. Without a guard, one careless grant locks the
 * organisation out of a credential permanently, recoverable only from the
 * database.
 */

type GrantRow = {
  id: string;
  credentialId: string | null;
  categoryId: string | null;
  userId: string | null;
  roleId: string | null;
  level: "READ" | "REVEAL" | "MANAGE";
  expiresAt: Date | null;
};

/**
 * The users who would still hold MANAGE on a credential, given a set of grants.
 *
 * The decision itself lives in `lib/vault-grants.ts` as a pure function, tested
 * exhaustively there. This function's only job is to gather the two inputs it
 * needs: the grants, and which users effectively hold `vault.update`.
 */
async function manageHoldersFor(
  credential: { id: string; categoryId: string },
  grants: readonly GrantRow[],
  now: Date,
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      roleId: true,
      role: {
        select: {
          key: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
      overrides: {
        select: { effect: true, expiresAt: true, permission: { select: { key: true } } },
      },
    },
  });

  const candidates: CandidateUser[] = users.map((user) => {
    const permissions = resolvePermissions({
      rolePermissions: user.role.permissions.map((rp) => rp.permission.key),
      overrides: user.overrides.map((o) => ({
        key: o.permission.key,
        effect: o.effect,
        expiresAt: o.expiresAt,
      })),
      isSuperAdmin: user.role.key === SUPER_ADMIN_ROLE_KEY,
    });

    return {
      id: user.id,
      roleId: user.roleId,
      holdsVaultUpdate: permissions.has("vault.update"),
    };
  });

  return manageHolders(grants, credential, candidates, now);
}

async function assertSomeoneKeepsManage(
  credential: { id: string; categoryId: string },
  grants: readonly GrantRow[],
  now: Date,
): Promise<void> {
  const holders = await manageHoldersFor(credential, grants, now);
  if (holders.length === 0) {
    throw new ConflictError(
      "That would leave nobody able to manage this credential. Give someone MANAGE first — " +
        "there is no administrator override, so a credential with no manager can only be " +
        "recovered from the database.",
    );
  }
}

const GRANT_SELECT = {
  id: true,
  credentialId: true,
  categoryId: true,
  userId: true,
  roleId: true,
  level: true,
  expiresAt: true,
} as const;

/** Everything currently granted on one credential, including via its category. */
export async function listCredentialGrants(ctx: ActorContext, credentialId: string) {
  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, deletedAt: null, ...optionalCompanyScopeWhere(ctx) },
    select: { id: true, name: true, categoryId: true },
  });
  if (!credential) throw new NotFoundError("Credential not found.");

  const grants = await prisma.credentialGrant.findMany({
    where: {
      OR: [{ credentialId: credential.id }, { categoryId: credential.categoryId }],
    },
    orderBy: { createdAt: "asc" },
    select: {
      ...GRANT_SELECT,
      createdAt: true,
      role: { select: { key: true, name: true } },
      category: { select: { name: true } },
    },
  });

  // `userId` carries no relation on this model, so names resolve separately.
  const userIds = grants.map((g) => g.userId).filter((id): id is string => id !== null);
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return {
    credential,
    isRestricted: grants.length > 0,
    grants: grants.map((g) => ({
      id: g.id,
      level: g.level,
      expiresAt: g.expiresAt,
      createdAt: g.createdAt,
      // A grant on the category restricts every credential in it, which is a
      // materially different thing from one on this credential alone.
      scope: g.categoryId ? ("CATEGORY" as const) : ("CREDENTIAL" as const),
      categoryName: g.category?.name ?? null,
      subject: g.userId
        ? {
            kind: "USER" as const,
            id: g.userId,
            label: byId.get(g.userId)?.name ?? "Unknown user",
            detail: byId.get(g.userId)?.email ?? null,
          }
        : {
            kind: "ROLE" as const,
            id: g.roleId ?? "",
            label: g.role?.name ?? "Unknown role",
            detail: g.role?.key ?? null,
          },
    })),
  };
}

export async function createCredentialGrant(
  ctx: ActorContext,
  input: {
    credentialId: string;
    subjectKind: "USER" | "ROLE";
    subjectId: string;
    level: "READ" | "REVEAL" | "MANAGE";
    expiresAt?: Date | undefined;
  },
) {
  const credential = await prisma.credential.findFirst({
    where: { id: input.credentialId, deletedAt: null, ...optionalCompanyScopeWhere(ctx) },
    select: { id: true, name: true, categoryId: true, companyId: true },
  });
  if (!credential) throw new NotFoundError("Credential not found.");

  let subjectLabel: string;
  if (input.subjectKind === "USER") {
    const user = await prisma.user.findFirst({
      where: { id: input.subjectId, status: "ACTIVE", deletedAt: null },
      select: { name: true },
    });
    if (!user) throw new NotFoundError("That user was not found, or is not active.");
    subjectLabel = user.name;
  } else {
    const role = await prisma.role.findUnique({
      where: { id: input.subjectId },
      select: { name: true },
    });
    if (!role) throw new NotFoundError("That role was not found.");
    subjectLabel = role.name;
  }

  const duplicate = await prisma.credentialGrant.findFirst({
    where: {
      credentialId: credential.id,
      ...(input.subjectKind === "USER"
        ? { userId: input.subjectId }
        : { roleId: input.subjectId }),
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("That person or role already has a grant on this credential.");
  }

  const now = new Date();
  const current = await prisma.credentialGrant.findMany({
    where: { OR: [{ credentialId: credential.id }, { categoryId: credential.categoryId }] },
    select: GRANT_SELECT,
  });

  const prospective: GrantRow[] = [
    ...current,
    {
      id: "prospective",
      credentialId: credential.id,
      categoryId: null,
      userId: input.subjectKind === "USER" ? input.subjectId : null,
      roleId: input.subjectKind === "ROLE" ? input.subjectId : null,
      level: input.level,
      expiresAt: input.expiresAt ?? null,
    },
  ];

  await assertSomeoneKeepsManage(credential, prospective, now);

  const grant = await prisma.credentialGrant.create({
    data: {
      credentialId: credential.id,
      ...(input.subjectKind === "USER"
        ? { userId: input.subjectId }
        : { roleId: input.subjectId }),
      level: input.level,
      grantedById: ctx.userId,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true },
  });

  return {
    grant,
    credential,
    subjectLabel,
    // True when this is the grant that switched the credential from open to
    // restricted — the surprising transition, so the caller can say so.
    nowRestricted: current.length === 0,
  };
}

export async function revokeCredentialGrant(
  ctx: ActorContext,
  input: { id: string; credentialId: string },
) {
  const credential = await prisma.credential.findFirst({
    where: { id: input.credentialId, deletedAt: null, ...optionalCompanyScopeWhere(ctx) },
    select: { id: true, name: true, categoryId: true, companyId: true },
  });
  if (!credential) throw new NotFoundError("Credential not found.");

  const grant = await prisma.credentialGrant.findFirst({
    where: { id: input.id, credentialId: credential.id },
    select: { id: true, level: true },
  });
  // A category-wide grant is managed where the category is. Removing it from
  // inside one credential would silently change every other credential in it.
  if (!grant) {
    throw new NotFoundError(
      "That grant is not on this credential. Category-wide grants are managed on the category.",
    );
  }

  const now = new Date();
  const current = await prisma.credentialGrant.findMany({
    where: { OR: [{ credentialId: credential.id }, { categoryId: credential.categoryId }] },
    select: GRANT_SELECT,
  });
  const remaining = current.filter((g) => g.id !== grant.id);

  // Removing the LAST grant returns the credential to open, which is safe.
  // Removing one of several could strand it with nobody able to manage it.
  if (remaining.length > 0) {
    await assertSomeoneKeepsManage(credential, remaining, now);
  }

  await prisma.credentialGrant.delete({ where: { id: grant.id } });

  return { credential, nowOpen: remaining.length === 0 };
}
