/**
 * Storage ACL policy — docs/SECURITY.md §6.0.
 *
 * Pure, and deliberately in `lib` rather than beside the storage adapter, so
 * the assertion that governs whether identity documents are public can be
 * tested directly instead of only at boot.
 */

export type StorageTier = "free" | "pro";

/**
 * Refuses to serve files from public storage in production unless that was
 * explicitly accepted.
 *
 * Checked per request rather than during environment parsing, and this is not
 * a stylistic choice: `next build` runs with `NODE_ENV=production`, and
 * Turbopack sets no `NEXT_PHASE`, so the same check in the env schema fails
 * every build — including a local one against a development app. Verified, not
 * assumed. A per-request check fires when the deployment actually serves a
 * file, which is the moment that matters.
 */
export function assertStorageTierAllowed(config: {
  nodeEnv: string;
  tier: StorageTier;
  accepted: boolean;
}): void {
  if (config.nodeEnv !== "production") return;
  if (config.tier === "pro") return;
  if (config.accepted) return;

  throw new Error(
    "Refusing to serve files: UPLOADTHING_TIER=free in production stores " +
      "identity documents readable by anyone holding the object URL. Set " +
      "UPLOADTHING_TIER=pro, or ACCEPT_PUBLIC_FILE_STORAGE=true to accept " +
      "this explicitly. See docs/SECURITY.md §6.0.",
  );
}

/**
 * Checks the upload-route declarations against the configured tier.
 *
 * Enforced in BOTH directions, because each mistake is bad in a different way:
 *
 *   - a `private` ACL on the free tier makes every upload fail with HTTP 400,
 *     which looks like a broken application;
 *   - a missing ACL on the pro tier silently publishes every passport and
 *     Iqama scan, which looks like nothing at all.
 *
 * The second is why this throws rather than warns.
 */
export function assertStorageAclPolicy(
  tier: StorageTier,
  routeAcls: readonly (string | undefined)[],
): void {
  if (tier === "pro") {
    const offenders = routeAcls.filter((acl) => acl !== "private");
    if (offenders.length > 0) {
      throw new Error(
        "Refusing to start: UPLOADTHING_TIER=pro but " +
          `${String(offenders.length)} upload route(s) are not declared with ` +
          'acl: "private". Employee identity documents would be publicly ' +
          "readable. See docs/SECURITY.md §6.0.",
      );
    }
    return;
  }

  const declared = routeAcls.filter((acl) => acl !== undefined);
  if (declared.length > 0) {
    throw new Error(
      "Refusing to start: UPLOADTHING_TIER=free but " +
        `${String(declared.length)} upload route(s) declare an ACL. The free ` +
        "plan rejects ACL declarations with HTTP 400, so every upload would " +
        "fail. Remove the acl, or set UPLOADTHING_TIER=pro.",
    );
  }
}

/**
 * What to say at boot about the configured storage tier, and how loudly.
 *
 * Pure and separate from the logger so the *decision* can be tested, in the
 * same spirit as the two assertions above.
 *
 * The level distinction matters. A warning exists to force a decision; once
 * that decision is recorded in configuration, repeating it as a warning every
 * boot trains people to ignore warnings — and the next one may be the ACL
 * mismatch that publishes every passport scan. So an accepted risk drops to
 * `info`: still printed, still greppable, no longer nagging. What never
 * happens is silence — the exposure is stated at every boot either way.
 */
export function storageDisclosure(config: {
  tier: StorageTier;
  accepted: boolean;
}): { level: "info" | "warn"; message: string } | null {
  if (config.tier === "pro") return null;

  const exposure =
    "Storage tier is FREE: uploaded documents, including identity scans, are " +
    "readable by anyone holding the object URL. The application never " +
    "discloses that URL — both file routes stream bytes rather than redirect " +
    "— but a leaked URL needs no session.";

  if (config.accepted) {
    return {
      level: "info",
      message:
        exposure +
        " Accepted for this deployment via ACCEPT_PUBLIC_FILE_STORAGE=true " +
        "(docs/SECURITY.md §6.5).",
    };
  }

  return {
    level: "warn",
    message:
      exposure +
      " This is NOT accepted for this deployment, so file routes will refuse " +
      "to serve in production. Set ACCEPT_PUBLIC_FILE_STORAGE=true to accept " +
      "it, or UPLOADTHING_TIER=pro to make objects private.",
  };
}
