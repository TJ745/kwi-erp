/**
 * Whether a credential would still have someone able to manage it.
 *
 * Pulled out of the grant service as a pure function, because it is the guard
 * that stops an organisation locking itself out of a credential permanently.
 * There is no administrator exemption in the grant resolver — established by
 * experiment: a credential visible to a SUPER_ADMIN became invisible to them
 * the instant a grant naming somebody else was added. If this predicate is
 * wrong, the only recovery is editing the database.
 *
 * Kept free of Prisma so every combination can be tested directly rather than
 * by arranging rows and reading them back.
 */

export const GRANT_RANK = { READ: 0, REVEAL: 1, MANAGE: 2 } as const;

export type GrantLevel = keyof typeof GRANT_RANK;

export type GrantLike = {
  credentialId: string | null;
  categoryId: string | null;
  userId: string | null;
  roleId: string | null;
  level: GrantLevel;
  expiresAt: Date | null;
};

export type CandidateUser = {
  id: string;
  roleId: string;
  /** Whether they hold the global permission. A grant alone is not access. */
  holdsVaultUpdate: boolean;
};

/**
 * The grants that actually bear on this credential right now.
 *
 * A grant applies through the credential itself or through its category, and
 * an expired one does not apply at all.
 */
export function applicableGrants(
  grants: readonly GrantLike[],
  credential: { id: string; categoryId: string },
  atLeast: GrantLevel,
  now: Date,
): GrantLike[] {
  return grants.filter(
    (g) =>
      (g.credentialId === credential.id || g.categoryId === credential.categoryId) &&
      (g.expiresAt === null || g.expiresAt > now) &&
      GRANT_RANK[g.level] >= GRANT_RANK[atLeast],
  );
}

/**
 * The users who would hold MANAGE on a credential, given a set of grants.
 *
 * Effective, not nominal: a user needs the global `vault.update` permission AND
 * a matching grant. Granting MANAGE to somebody who cannot use the vault at all
 * does not keep the credential manageable, which is the case that makes the
 * naive version of this check wrong.
 */
export function manageHolders(
  grants: readonly GrantLike[],
  credential: { id: string; categoryId: string },
  users: readonly CandidateUser[],
  now: Date,
): string[] {
  const relevant = applicableGrants(grants, credential, "MANAGE", now);
  if (relevant.length === 0) return [];

  return users
    .filter(
      (user) =>
        user.holdsVaultUpdate &&
        relevant.some(
          (g) => g.userId === user.id || (g.roleId !== null && g.roleId === user.roleId),
        ),
    )
    .map((user) => user.id);
}

/**
 * Whether a prospective set of grants would strand the credential.
 *
 * Note the asymmetry with "no grants at all": a credential with zero grants is
 * open to everyone holding the vault permission, which is safe. It is only once
 * grants exist that someone must be named.
 */
export function wouldStrandCredential(
  grants: readonly GrantLike[],
  credential: { id: string; categoryId: string },
  users: readonly CandidateUser[],
  now: Date,
): boolean {
  if (grants.length === 0) return false;
  return manageHolders(grants, credential, users, now).length === 0;
}
