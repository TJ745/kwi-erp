/**
 * Checks the ADR-008 storage guarantees against the real UploadThing app.
 *
 * The critical assertion is that employee identity documents are NOT publicly
 * readable. If the app cannot store private files, that is a blocking finding
 * and this script says so rather than quietly passing.
 *
 * Uploads tiny synthetic files and deletes them again.
 * Run: pnpm tsx scripts/verify-storage.ts
 */
import { existsSync } from "node:fs";
import { UTApi, UTFile } from "uploadthing/server";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

const token = process.env.UPLOADTHING_TOKEN;
if (!token || token.startsWith("dev-placeholder")) {
  console.error("UPLOADTHING_TOKEN is not configured.");
  process.exit(1);
}

const utapi = new UTApi({ token });

// Minimal valid PDF header — nothing sensitive.
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
]);

let blocking = 0;

async function main() {
  console.log("1. Upload with acl: \"private\" (what every OMS route declares)");

  let privateSupported = false;
  try {
    const result = await utapi.uploadFiles(
      new UTFile([PDF_BYTES], "verify-private.pdf", { type: "application/pdf" }),
      { acl: "private" },
    );
    if (result.error) {
      console.log(`   REJECTED — ${result.error.message}`);
    } else {
      privateSupported = true;
      console.log(`   accepted (key ${result.data.key})`);

      const unsigned = await fetch(result.data.ufsUrl);
      const refused = unsigned.status === 401 || unsigned.status === 403;
      console.log(
        `   unsigned URL -> HTTP ${String(unsigned.status)} ${refused ? "(refused, correct)" : "<-- PUBLICLY READABLE"}`,
      );
      if (!refused) blocking += 1;

      const signed = await utapi.generateSignedURL(result.data.key, { expiresIn: 60 });
      const viaSigned = await fetch(signed.ufsUrl);
      console.log(`   signed URL   -> HTTP ${String(viaSigned.status)}`);

      await utapi.deleteFiles(result.data.key);
      console.log("   cleaned up");
    }
  } catch (error) {
    console.log(`   THREW — ${error instanceof Error ? error.message : String(error)}`);
  }

  if (privateSupported) {
    console.log("\nPrivate storage is available. ADR-008 holds.");
    return;
  }

  // Private uploads are refused. Establish whether the failure is fail-safe:
  // uploads must break, NOT silently become public.
  console.log("\n2. Private files unavailable — checking the failure is fail-safe");
  console.log("   (an upload must FAIL, never fall back to public-read)");

  try {
    const fallback = await utapi.uploadFiles(
      new UTFile([PDF_BYTES], "verify-default.pdf", { type: "application/pdf" }),
    );
    if (fallback.error) {
      console.log(`   default-ACL upload also rejected — ${fallback.error.message}`);
    } else {
      const unsigned = await fetch(fallback.data.ufsUrl);
      console.log(
        `   default-ACL upload accepted; unsigned URL -> HTTP ${String(unsigned.status)}` +
          (unsigned.ok ? " <-- would be PUBLICLY READABLE" : ""),
      );
      await utapi.deleteFiles(fallback.data.key);
      console.log("   cleaned up");
    }
  } catch (error) {
    console.log(`   THREW — ${error instanceof Error ? error.message : String(error)}`);
  }

  blocking += 1;
  console.log(
    [
      "",
      "BLOCKING: this UploadThing app cannot store private files.",
      "",
      "Every OMS upload route declares acl: \"private\", so uploads will be",
      "rejected outright rather than stored publicly. That is the intended",
      "fail-safe behaviour, but it means document upload does not work until",
      "one of the following is chosen:",
      "",
      "  a) upgrade the UploadThing app to a paid tier (private files), or",
      "  b) switch the storage adapter to S3/R2 (also addresses the PDPL",
      "     data-residency question already flagged), or",
      "  c) explicitly accept public-read storage — NOT advisable: passport",
      "     and Iqama scans would be readable by anyone with the URL.",
      "",
      "The code has not been changed to work around this.",
    ].join("\n"),
  );
}

main()
  .catch((e: unknown) => {
    console.error("error:", e instanceof Error ? e.message : e);
    blocking += 1;
  })
  .finally(() => {
    process.exitCode = blocking > 0 ? 1 : 0;
  });
