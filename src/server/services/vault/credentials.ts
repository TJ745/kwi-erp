import "server-only";
import type { Prisma, VaultAction } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { companyScopeWhere } from "@/server/auth/guards";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitedError } from "@/lib/result";
import { logger } from "@/server/logger";
import { openSecret, sealSecret } from "@/server/crypto/envelope";
import { activeKey, activeKeyVersion, keyForVersion } from "@/server/crypto/vault-key";
import { requireVaultUnlocked } from "./session";

/**
 * Credential vault — docs/SECURITY.md §5.
 *
 * Invariants, all enforced here rather than by convention:
 *   1. No function returns a plaintext secret except revealCredential.
 *   2. revealCredential requires vault.reveal AND an unlocked vault AND a
 *      per-credential grant, and is rate limited and audited.
 *   3. Nothing in this file logs a secret, at any level.
 */

export type CredentialListRow = {
  id: string;
  name: string;
  categoryName: string;
  companyCode: string | null;
  username: string | null;
  url: string | null;
  status: string;
  lastRotatedAt: Date | null;
  updatedAt: Date;
  isFavorite: boolean;
};

/**
 * Per-credential ACL on top of the global vault.* permissions.
 * Effective access = global permission AND grant.
 *
 * A credential with no grants at all is open to anyone holding the global
 * permission; grants exist to NARROW access to sensitive categories such as
 * government portals.
 */
async function grantedCredentialIds(
  ctx: ActorContext,
  level: "READ" | "REVEAL" | "MANAGE",
): Promise<{ restricted: Set<string>; allowed: Set<string> }> {
  const grants = await prisma.credentialGrant.findMany({
    where: {
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { credentialId: true, categoryId: true, userId: true, roleId: true, level: true },
  });

  const restricted = new Set<string>();
  const allowed = new Set<string>();

  // Any grant on a credential means it is access-controlled.
  const byCategory = new Map<string, typeof grants>();
  for (const grant of grants) {
    if (grant.credentialId) restricted.add(grant.credentialId);
    if (grant.categoryId) {
      byCategory.set(grant.categoryId, [...(byCategory.get(grant.categoryId) ?? []), grant]);
    }
  }

  const ranks = { READ: 0, REVEAL: 1, MANAGE: 2 };
  const isForActor = (g: (typeof grants)[number]) =>
    g.userId === ctx.userId || (g.roleId !== null && g.roleId === ctx.roleId);

  for (const grant of grants) {
    if (!isForActor(grant)) continue;
    if (ranks[grant.level] < ranks[level]) continue;
    if (grant.credentialId) allowed.add(grant.credentialId);
  }

  // Category grants restrict every credential in that category.
  if (byCategory.size > 0) {
    const inCategories = await prisma.credential.findMany({
      where: { categoryId: { in: [...byCategory.keys()] }, deletedAt: null },
      select: { id: true, categoryId: true },
    });
    for (const credential of inCategories) {
      restricted.add(credential.id);
      const categoryGrants = byCategory.get(credential.categoryId) ?? [];
      if (
        categoryGrants.some((g) => isForActor(g) && ranks[g.level] >= ranks[level])
      ) {
        allowed.add(credential.id);
      }
    }
  }

  return { restricted, allowed };
}

function visibleWhere(
  restricted: Set<string>,
  allowed: Set<string>,
): Prisma.CredentialWhereInput {
  const blocked = [...restricted].filter((id) => !allowed.has(id));
  return blocked.length > 0 ? { id: { notIn: blocked } } : {};
}

export async function listCredentials(
  ctx: ActorContext,
  filters: { categoryId?: string | undefined; q?: string | undefined } = {},
): Promise<CredentialListRow[]> {
  const { restricted, allowed } = await grantedCredentialIds(ctx, "READ");

  const rows = await prisma.credential.findMany({
    where: {
      status: "ACTIVE",
      ...companyScopeWhere(ctx),
      ...visibleWhere(restricted, allowed),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { username: { contains: filters.q, mode: "insensitive" } },
              { url: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    // NOTE: ciphertext, iv, authTag, and wrappedDek are deliberately absent.
    // A list endpoint must never carry encrypted material, let alone plaintext.
    select: {
      id: true,
      name: true,
      username: true,
      url: true,
      status: true,
      lastRotatedAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      company: { select: { code: true } },
      favorites: { where: { userId: ctx.userId }, select: { userId: true } },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    categoryName: c.category.name,
    companyCode: c.company?.code ?? null,
    username: c.username,
    url: c.url,
    status: c.status,
    lastRotatedAt: c.lastRotatedAt,
    updatedAt: c.updatedAt,
    isFavorite: c.favorites.length > 0,
  }));
}

/** Metadata only. Never includes the secret or any encrypted material. */
export async function getCredentialMeta(ctx: ActorContext, id: string) {
  const { restricted, allowed } = await grantedCredentialIds(ctx, "READ");
  if (restricted.has(id) && !allowed.has(id)) throw new NotFoundError("Credential not found.");

  const credential = await prisma.credential.findFirst({
    where: { id, deletedAt: null, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      url: true,
      status: true,
      lastRotatedAt: true,
      rotationDueAt: true,
      createdAt: true,
      updatedAt: true,
      categoryId: true,
      companyId: true,
      category: { select: { name: true } },
      company: { select: { code: true } },
      _count: { select: { versions: true } },
    },
  });
  if (!credential) throw new NotFoundError("Credential not found.");

  await recordAccess(ctx, id, "VIEW");
  return credential;
}

export type CredentialInput = {
  name: string;
  categoryId: string;
  companyId?: string | undefined;
  url?: string | undefined;
  username?: string | undefined;
  email?: string | undefined;
  secret: string;
  notes?: string | undefined;
};

export async function createCredential(ctx: ActorContext, input: CredentialInput) {
  if (input.companyId) {
    if (ctx.companyScope !== "ALL" && !ctx.companyScope.includes(input.companyId)) {
      throw new ForbiddenError("Record not found.");
    }
  }

  const category = await prisma.credentialCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true, name: true },
  });
  if (!category) throw new NotFoundError("Category not found.");

  // The row is created first so its id can serve as the AAD, binding the
  // ciphertext to this specific credential.
  const created = await prisma.$transaction(async (tx) => {
    const placeholder = await tx.credential.create({
      data: {
        name: input.name,
        categoryId: input.categoryId,
        companyId: input.companyId ?? null,
        url: input.url ?? null,
        username: input.username ?? null,
        email: input.email ?? null,
        // Temporary non-empty payload; replaced below in the same transaction.
        ciphertext: Buffer.from([0]),
        iv: Buffer.alloc(12),
        authTag: Buffer.alloc(16),
        wrappedDek: Buffer.from([0]),
        keyVersion: activeKeyVersion(),
        createdById: ctx.userId,
        updatedById: ctx.userId,
      },
      select: { id: true },
    });

    const sealed = sealSecret(activeKey(), placeholder.id, input.secret);
    const sealedNotes = input.notes
      ? sealSecret(activeKey(), `${placeholder.id}:notes`, input.notes)
      : null;

    return tx.credential.update({
      where: { id: placeholder.id },
      data: {
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        wrappedDek: sealed.wrappedDek,
        keyVersion: activeKeyVersion(),
        lastRotatedAt: new Date(),
        ...(sealedNotes
          ? {
              notesCipher: sealedNotes.ciphertext,
              notesIv: sealedNotes.iv,
              notesAuthTag: sealedNotes.authTag,
            }
          : {}),
      },
      select: { id: true, name: true, companyId: true },
    });
  });

  await recordAccess(ctx, created.id, "CREATE");
  return { ...created, categoryName: category.name };
}

/** Updates metadata, and optionally rotates the secret. */
export async function updateCredential(
  ctx: ActorContext,
  input: Omit<CredentialInput, "secret"> & { id: string; secret?: string | undefined },
) {
  const before = await prisma.credential.findFirst({
    where: { id: input.id, deletedAt: null, ...companyScopeWhere(ctx) },
    select: {
      id: true,
      name: true,
      username: true,
      url: true,
      companyId: true,
      ciphertext: true,
      iv: true,
      authTag: true,
      wrappedDek: true,
      keyVersion: true,
    },
  });
  if (!before) throw new NotFoundError("Credential not found.");

  const { restricted, allowed } = await grantedCredentialIds(ctx, "MANAGE");
  if (restricted.has(input.id) && !allowed.has(input.id)) {
    throw new ForbiddenError("You do not have manage access to this credential.");
  }

  const rotating = Boolean(input.secret);

  const after = await prisma.$transaction(async (tx) => {
    // A rotation keeps the previous ciphertext as history — still encrypted,
    // so the history is not a plaintext backdoor.
    if (rotating && input.secret) {
      await tx.credentialVersion.create({
        data: {
          credentialId: before.id,
          ciphertext: before.ciphertext,
          iv: before.iv,
          authTag: before.authTag,
          wrappedDek: before.wrappedDek,
          keyVersion: before.keyVersion,
          changedById: ctx.userId,
          reason: "Rotated",
        },
      });
    }

    const sealed = input.secret ? sealSecret(activeKey(), before.id, input.secret) : null;
    const sealedNotes = input.notes
      ? sealSecret(activeKey(), `${before.id}:notes`, input.notes)
      : null;

    return tx.credential.update({
      where: { id: input.id },
      data: {
        name: input.name,
        categoryId: input.categoryId,
        companyId: input.companyId ?? null,
        url: input.url ?? null,
        username: input.username ?? null,
        email: input.email ?? null,
        updatedById: ctx.userId,
        ...(sealed
          ? {
              ciphertext: sealed.ciphertext,
              iv: sealed.iv,
              authTag: sealed.authTag,
              wrappedDek: sealed.wrappedDek,
              keyVersion: activeKeyVersion(),
              lastRotatedAt: new Date(),
            }
          : {}),
        ...(sealedNotes
          ? {
              notesCipher: sealedNotes.ciphertext,
              notesIv: sealedNotes.iv,
              notesAuthTag: sealedNotes.authTag,
            }
          : {}),
      },
      select: { id: true, name: true, companyId: true },
    });
  });

  await recordAccess(ctx, input.id, rotating ? "ROTATE" : "UPDATE");

  return {
    before: { name: before.name, username: before.username, url: before.url },
    after: { name: after.name, username: input.username ?? null, url: input.url ?? null },
    rotated: rotating,
    companyId: after.companyId,
  };
}

/**
 * The reveal path — the single function in the system that returns a plaintext
 * secret. Every gate in docs/SECURITY.md §5.5 is applied here.
 */
export async function revealCredential(ctx: ActorContext, id: string): Promise<string> {
  // 1. Global permission (checked again by the action, belt and braces).
  if (!ctx.permissions.has("vault.reveal")) {
    throw new ForbiddenError("You do not have permission to reveal credentials.");
  }

  // 2. The vault must be explicitly unlocked.
  await requireVaultUnlocked(ctx);

  // 3. Per-credential grant.
  const { restricted, allowed } = await grantedCredentialIds(ctx, "REVEAL");
  if (restricted.has(id) && !allowed.has(id)) {
    // Same message as "not found" so restricted credentials cannot be probed.
    throw new NotFoundError("Credential not found.");
  }

  // 4. Rate limit. Bulk harvesting is the insider threat this addresses.
  try {
    await consumeRateLimit("vaultReveal", ctx.userId);
  } catch {
    logger.warn("Vault reveal rate limit exceeded", { userId: ctx.userId, credentialId: id });
    throw new RateLimitedError("Too many reveals. Please wait a few minutes.");
  }

  const credential = await prisma.credential.findFirst({
    where: { id, deletedAt: null, status: "ACTIVE", ...companyScopeWhere(ctx) },
    select: {
      id: true,
      ciphertext: true,
      iv: true,
      authTag: true,
      wrappedDek: true,
      keyVersion: true,
    },
  });
  if (!credential) throw new NotFoundError("Credential not found.");

  // 5. Decrypt, with the credential id as AAD.
  const secret = openSecret(keyForVersion(credential.keyVersion), credential.id, {
    ciphertext: credential.ciphertext,
    iv: credential.iv,
    authTag: credential.authTag,
    wrappedDek: credential.wrappedDek,
  });

  // 6. Audit that it happened — never what was revealed.
  await recordAccess(ctx, id, "REVEAL");

  return secret;
}

export async function deleteCredential(ctx: ActorContext, id: string) {
  const credential = await prisma.credential.findFirst({
    where: { id, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true, name: true, companyId: true },
  });
  if (!credential) throw new NotFoundError("Credential not found.");

  const { restricted, allowed } = await grantedCredentialIds(ctx, "MANAGE");
  if (restricted.has(id) && !allowed.has(id)) {
    throw new ForbiddenError("You do not have manage access to this credential.");
  }

  await prisma.credential.update({
    where: { id },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });

  await recordAccess(ctx, id, "DELETE");
  return credential;
}

export async function toggleFavorite(ctx: ActorContext, credentialId: string) {
  const existing = await prisma.credentialFavorite.findUnique({
    where: { userId_credentialId: { userId: ctx.userId, credentialId } },
    select: { userId: true },
  });

  if (existing) {
    await prisma.credentialFavorite.delete({
      where: { userId_credentialId: { userId: ctx.userId, credentialId } },
    });
    return { favorite: false };
  }

  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, deletedAt: null, ...companyScopeWhere(ctx) },
    select: { id: true },
  });
  if (!credential) throw new NotFoundError("Credential not found.");

  await prisma.credentialFavorite.create({ data: { userId: ctx.userId, credentialId } });
  return { favorite: true };
}

export async function credentialCategories() {
  return prisma.credentialCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, key: true, name: true, _count: { select: { credentials: true } } },
  });
}

/**
 * Append-only access log. Records that access happened, never the value.
 * Written outside any transaction so a later failure cannot erase the trail.
 */
async function recordAccess(
  ctx: ActorContext,
  credentialId: string,
  action: VaultAction,
): Promise<void> {
  try {
    await prisma.credentialAccess.create({
      data: {
        credentialId,
        userId: ctx.userId,
        action,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });
  } catch (error) {
    // Never fail the operation because auditing failed, but make the gap loud.
    logger.error("Failed to write vault access log", {
      credentialId,
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Recent access, for the "who looked at what" panel. */
export async function recentAccess(ctx: ActorContext, credentialId: string) {
  if (!ctx.permissions.has("vault.view")) throw new ForbiddenError();

  const rows = await prisma.credentialAccess.findMany({
    where: { credentialId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, action: true, userId: true, ipAddress: true, createdAt: true },
  });

  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, name: true },
  });
  const names = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    userName: names.get(r.userId) ?? "Unknown",
    ipAddress: r.ipAddress,
    createdAt: r.createdAt,
  }));
}

export async function assertNoDuplicateName(
  ctx: ActorContext,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.credential.findFirst({
    where: {
      name,
      deletedAt: null,
      ...companyScopeWhere(ctx),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError(`A credential named "${name}" already exists.`);
}
