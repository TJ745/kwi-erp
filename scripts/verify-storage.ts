/**
 * Measures what the configured UploadThing app actually does, and checks the
 * application's configuration matches it — docs/SECURITY.md §6.0.
 *
 * The product owner has accepted the free tier: objects are world-readable to
 * anyone holding the URL, and the application's job is to never disclose one.
 * So this asserts different things per tier rather than a single ideal:
 *
 *   free — an explicit ACL must be REJECTED by the API (proving the omission in
 *          the route config is necessary, not cargo-culted), a default-ACL
 *          upload must succeed, and the resulting object is expected to be
 *          publicly readable. That last fact is reported, not failed: it is the
 *          accepted risk, and a check that fails on it would cry wolf forever.
 *
 *   pro  — a private upload must succeed AND its unsigned URL must be refused.
 *          A private file readable without a signature is a real failure.
 *
 * Uploads and then deletes its own probe objects.
 * Run: pnpm tsx scripts/verify-storage.ts
 */
import { existsSync } from "node:fs";
import { UTApi, UTFile } from "uploadthing/server";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

const TIER = (process.env.UPLOADTHING_TIER ?? "free") as "free" | "pro";
const utapi = new UTApi({ token: requireEnv("UPLOADTHING_TOKEN") });

/** A minimal but structurally valid PDF, so magic-byte checks see the truth. */
const PDF_BYTES = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const uploaded: string[] = [];

async function main() {
  console.log(`Configured tier: ${TIER}\n`);

  // --- 1. Does the app accept an explicit private ACL? ----------------------
  console.log('1. Upload declaring acl: "private"');
  let privateKey: string | null = null;
  let privateRejected = false;
  let privateError = "";

  const privateResult = await utapi.uploadFiles(
    new UTFile([PDF_BYTES], "verify-private.pdf", { type: "application/pdf" }),
    { acl: "private" },
  );

  if (privateResult.data) {
    privateKey = privateResult.data.key;
    uploaded.push(privateKey);
    console.log(`   accepted — key ${privateKey}`);
  } else {
    privateRejected = true;
    privateError = privateResult.error?.message ?? "unknown error";
    console.log(`   rejected — ${privateError}`);
  }

  if (TIER === "free") {
    // The route config omits the ACL precisely because of this. If the app
    // started accepting private files, the omission became unnecessary and the
    // tier should be switched — so this is worth knowing either way.
    check(
      "the free plan rejects an explicit ACL, as the route config assumes",
      privateRejected,
      privateRejected ? privateError : "it was ACCEPTED — consider UPLOADTHING_TIER=pro",
    );
  } else {
    check("a private upload succeeds on the pro tier", privateKey !== null, privateError);
  }

  // --- 2. Default-ACL upload -----------------------------------------------
  console.log("\n2. Upload with the default ACL (what the free tier uses)");
  const defaultResult = await utapi.uploadFiles(
    new UTFile([PDF_BYTES], "verify-default.pdf", { type: "application/pdf" }),
  );

  const defaultKey = defaultResult.data?.key ?? null;
  if (defaultKey) uploaded.push(defaultKey);
  check(
    "a default-ACL upload succeeds",
    defaultKey !== null,
    defaultResult.error?.message ?? "",
  );

  // --- 3. Is the stored object readable without a signature? ---------------
  console.log("\n3. Unsigned readability of the stored object");
  const probeKey = privateKey ?? defaultKey;

  if (!probeKey) {
    console.log("   skipped: nothing uploaded");
  } else {
    const { data } = await utapi.getFileUrls(probeKey);
    const publicUrl = data[0]?.url;

    if (!publicUrl) {
      console.log("   skipped: no public URL returned");
    } else {
      const response = await fetch(publicUrl, { method: "GET" });
      const readable = response.ok;
      console.log(`   unsigned GET -> HTTP ${String(response.status)}`);

      if (TIER === "pro") {
        check("a private object is NOT readable unsigned", !readable);
      } else {
        // Reported, not failed. This IS the accepted risk (SECURITY §6.0);
        // failing here every run would train the reader to ignore the script.
        console.log(
          readable
            ? "   NOTE  object is world-readable — the accepted free-tier risk.\n" +
                "         The application never discloses this URL: downloads stream\n" +
                "         through /api/files/[id] and CSP forbids the storage host."
            : "   NOTE  object is not readable unsigned — better than the tier promises.",
        );
      }
    }
  }

  // --- 4. Signed reads still work ------------------------------------------
  console.log("\n4. Signed URL generation (what readUrlFor uses)");
  if (probeKey) {
    try {
      const signed = await utapi.generateSignedURL(probeKey, { expiresIn: 60 });
      const response = await fetch(signed.ufsUrl);
      check("a signed URL resolves", response.ok, `HTTP ${String(response.status)}`);
    } catch (error) {
      // On the free tier readUrlFor falls back to the public URL, so this is
      // a degradation rather than an outage.
      const message = error instanceof Error ? error.message : String(error);
      if (TIER === "pro") check("a signed URL resolves", false, message);
      else console.log(`   NOTE  signing unavailable (${message}); readUrlFor falls back`);
    }
  }

  if (failures > 0) {
    console.log(`\n${String(failures)} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("\nall checks passed");
  }
}

async function cleanup() {
  if (uploaded.length === 0) return;
  await utapi.deleteFiles(uploaded);
  console.log(`\nprobe objects removed: ${String(uploaded.length)}`);
}

main()
  .catch((e: unknown) => {
    console.error("error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() =>
    cleanup().catch((e: unknown) => {
      console.error("cleanup failed:", e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }),
  );
