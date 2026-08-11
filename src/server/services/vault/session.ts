import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { ActorContext } from "@/server/auth/context";
import { prisma } from "@/server/db/client";
import { verifyPassword } from "@/server/auth/password";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { ForbiddenError, RateLimitedError, VaultLockedError } from "@/lib/result";

/**
 * Vault unlock and auto-lock — docs/SECURITY.md §5.4.
 *
 * Holding vault.reveal is NOT sufficient to see a secret. The user must also
 * re-enter their password, which mints a short-lived unlock token. That token
 * is stored only as a SHA-256 hash, so a database dump yields nothing usable.
 */

const COOKIE_NAME = "oms.vault";
/** Sliding idle window. */
const IDLE_MINUTES = 15;
/** Hard ceiling regardless of activity. */
const ABSOLUTE_HOURS = 8;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verifies the user's password and issues an unlock token.
 * Rate limited: the vault password prompt is a brute-force target in its own
 * right, separate from login.
 */
export async function unlockVault(ctx: ActorContext, password: string): Promise<void> {
  try {
    await consumeRateLimit("vaultUnlock", ctx.userId);
  } catch {
    throw new RateLimitedError("Too many unlock attempts. Please wait a few minutes.");
  }

  const account = await prisma.account.findFirst({
    where: { userId: ctx.userId, providerId: "credential" },
    select: { password: true },
  });

  if (!account?.password || !(await verifyPassword(account.password, password))) {
    // Deliberately generic, and it costs the same as a success.
    throw new ForbiddenError("That password is not correct.");
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  await prisma.vaultSession.create({
    data: {
      userId: ctx.userId,
      // Only the hash is persisted.
      tokenHash: hashToken(token),
      createdAt: now,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + ABSOLUTE_HOURS * 60 * 60 * 1000),
      ipAddress: ctx.ipAddress,
    },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ABSOLUTE_HOURS * 60 * 60,
  });
}

/**
 * Confirms the vault is unlocked for this actor, and slides the idle window.
 * Throws VaultLockedError otherwise — callers must never proceed without it.
 */
export async function requireVaultUnlocked(ctx: ActorContext): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) throw new VaultLockedError();

  const session = await prisma.vaultSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  const now = new Date();

  if (
    !session ||
    session.userId !== ctx.userId ||
    session.revokedAt !== null ||
    session.expiresAt <= now
  ) {
    throw new VaultLockedError();
  }

  // Idle timeout: activity 15 minutes ago keeps it open, an hour ago does not.
  const idleMs = now.getTime() - session.lastUsedAt.getTime();
  if (idleMs > IDLE_MINUTES * 60 * 1000) {
    await prisma.vaultSession.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    throw new VaultLockedError("The vault locked after inactivity. Unlock it again.");
  }

  await prisma.vaultSession.update({
    where: { id: session.id },
    data: { lastUsedAt: now },
  });
}

/** Non-throwing check, for deciding whether to render the unlock gate. */
export async function isVaultUnlocked(ctx: ActorContext): Promise<boolean> {
  try {
    await requireVaultUnlocked(ctx);
    return true;
  } catch {
    return false;
  }
}

export async function lockVault(ctx: ActorContext): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.vaultSession.updateMany({
      where: { tokenHash: hashToken(token), userId: ctx.userId },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(COOKIE_NAME);
}

/**
 * Revokes every vault session for a user.
 * Called on sign-out, password change, and any permission change — a stale
 * unlock must not survive a revocation of access.
 */
export async function revokeAllVaultSessions(userId: string): Promise<void> {
  await prisma.vaultSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const VAULT_IDLE_MINUTES = IDLE_MINUTES;
