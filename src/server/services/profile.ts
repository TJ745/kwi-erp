import "server-only";
import { prisma } from "@/server/db/client";
import type { ActorContext } from "@/server/auth/context";
import { NotFoundError } from "@/lib/result";

/**
 * A user's own account.
 *
 * Everything here is scoped to `ctx.userId` and nothing takes a target id, so
 * there is no way to address somebody else's account through this file. That is
 * the whole reason it is separate from `services/users.ts`, which is the
 * administrative surface and carries seniority guards for exactly that reason.
 */

export async function ownProfile(ctx: ActorContext) {
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      mustChangePassword: true,
      role: { select: { key: true, name: true, description: true } },
      companyAccess: { select: { company: { select: { code: true, name: true } } } },
      employee: {
        select: {
          id: true,
          employeeNo: true,
          fullName: true,
          department: { select: { name: true } },
          position: { select: { title: true } },
        },
      },
    },
  });
  if (!user) throw new NotFoundError("Account not found.");
  return user;
}

/**
 * The only field a user may change about themselves here.
 *
 * Email is deliberately not editable: it is the login identifier, so changing
 * it is an account transfer and belongs with an administrator who can verify
 * the request. Role and company access are likewise not self-service — a
 * self-editable permission is not a permission.
 */
export async function updateOwnName(ctx: ActorContext, name: string) {
  const before = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true },
  });
  if (!before) throw new NotFoundError("Account not found.");

  const after = await prisma.user.update({
    where: { id: ctx.userId },
    data: { name },
    select: { id: true, name: true },
  });

  return { before, after };
}

/** The actor's own sessions, newest first. Never anybody else's. */
export async function ownSessions(ctx: ActorContext, currentToken: string | null) {
  const sessions = await prisma.session.findMany({
    where: { userId: ctx.userId, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      token: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
    },
  });

  // The token never leaves the server; only whether it is the caller's own.
  return sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    expiresAt: s.expiresAt,
    isCurrent: currentToken !== null && s.token === currentToken,
  }));
}

/**
 * Signs out everywhere except here.
 *
 * The current session is kept deliberately: signing yourself out while trying
 * to secure an account is a good way to make people avoid the button.
 */
export async function revokeOtherSessions(ctx: ActorContext, currentToken: string | null) {
  const { count } = await prisma.session.deleteMany({
    where: {
      userId: ctx.userId,
      ...(currentToken ? { token: { not: currentToken } } : {}),
    },
  });

  // Vault unlocks are session-bound in spirit, so they go too — an attacker
  // holding a revoked session must not keep an unlocked vault.
  await prisma.vaultSession.deleteMany({ where: { userId: ctx.userId } });

  return count;
}
