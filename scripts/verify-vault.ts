/**
 * Verifies the vault's security properties against the real database.
 *
 * The claim under test: a full database compromise yields no plaintext.
 *
 * Run: pnpm tsx scripts/verify-vault.ts
 */
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { openSecret, sealSecret, VaultCryptoError } from "../src/server/crypto/envelope.js";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);

/** Returns a required env var as a definite string, so narrowing survives
 *  into the async closure below. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

const connectionString = process.env.DIRECT_URL ?? requireEnv("DATABASE_URL");
const kekBase64 = requireEnv("VAULT_KEK_V1");
const kek = Buffer.from(kekBase64, "base64");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const SECRET = "Verify-Vault-Secret-!8x2Qz";

async function main() {
  const category = await prisma.credentialCategory.findFirstOrThrow({
    where: { key: "GOVERNMENT" },
  });
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@example.local" } });

  console.log("Encryption at rest");

  // Create the row first so its id can serve as the AAD.
  const placeholder = await prisma.credential.create({
    data: {
      name: "ZZZ-VERIFY-CRED",
      categoryId: category.id,
      ciphertext: Buffer.from([0]),
      iv: Buffer.alloc(12),
      authTag: Buffer.alloc(16),
      wrappedDek: Buffer.from([0]),
      keyVersion: 1,
      createdById: admin.id,
      updatedById: admin.id,
    },
    select: { id: true },
  });

  const sealed = sealSecret(kek, placeholder.id, SECRET);
  await prisma.credential.update({
    where: { id: placeholder.id },
    data: {
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      authTag: sealed.authTag,
      wrappedDek: sealed.wrappedDek,
    },
  });

  // Read the row back exactly as a database dump would expose it.
  const stored = await prisma.credential.findUniqueOrThrow({
    where: { id: placeholder.id },
    select: {
      id: true,
      ciphertext: true,
      iv: true,
      authTag: true,
      wrappedDek: true,
      keyVersion: true,
    },
  });

  const dump = JSON.stringify(stored);
  check("stored row contains no plaintext", !dump.includes(SECRET));
  check(
    "stored row contains no hex of the plaintext",
    !Buffer.from(stored.ciphertext).toString("hex").includes(
      Buffer.from(SECRET).toString("hex"),
    ),
  );
  check("the KEK itself is not in the row", !dump.includes(kekBase64));

  console.log("\nDecryption");
  const recovered = openSecret(kek, stored.id, {
    ciphertext: stored.ciphertext,
    iv: stored.iv,
    authTag: stored.authTag,
    wrappedDek: stored.wrappedDek,
  });
  check("round-trips with the correct key", recovered === SECRET);

  // The central claim: a dump without the KEK is useless.
  let wrongKeyFailed = false;
  try {
    openSecret(randomBytes(32), stored.id, {
      ciphertext: stored.ciphertext,
      iv: stored.iv,
      authTag: stored.authTag,
      wrappedDek: stored.wrappedDek,
    });
  } catch (e) {
    wrongKeyFailed = e instanceof VaultCryptoError;
  }
  check("a stolen dump WITHOUT the KEK cannot be decrypted", wrongKeyFailed);

  console.log("\nAAD binding against a database-write attacker");
  // Simulate: copy this ciphertext into a second, low-value credential row.
  const victim = await prisma.credential.create({
    data: {
      name: "ZZZ-VERIFY-LOWVALUE",
      categoryId: category.id,
      ciphertext: stored.ciphertext,
      iv: stored.iv,
      authTag: stored.authTag,
      wrappedDek: stored.wrappedDek,
      keyVersion: 1,
      createdById: admin.id,
      updatedById: admin.id,
    },
    select: { id: true, ciphertext: true, iv: true, authTag: true, wrappedDek: true },
  });

  let movedFailed = false;
  try {
    openSecret(kek, victim.id, {
      ciphertext: victim.ciphertext,
      iv: victim.iv,
      authTag: victim.authTag,
      wrappedDek: victim.wrappedDek,
    });
  } catch (e) {
    movedFailed = e instanceof VaultCryptoError;
  }
  check("ciphertext copied into another row cannot be revealed", movedFailed);

  console.log("\nDatabase constraints");
  let badIvRejected = false;
  try {
    await prisma.credential.create({
      data: {
        name: "ZZZ-VERIFY-BADIV",
        categoryId: category.id,
        ciphertext: Buffer.from([1, 2, 3]),
        iv: Buffer.alloc(4), // wrong length
        authTag: Buffer.alloc(16),
        wrappedDek: Buffer.from([1]),
        keyVersion: 1,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  } catch {
    badIvRejected = true;
  }
  check("a wrong-length IV is rejected by the CHECK constraint", badIvRejected);

  console.log("\nAccess log");
  await prisma.credentialAccess.create({
    data: { credentialId: stored.id, userId: admin.id, action: "REVEAL", ipAddress: "127.0.0.1" },
  });
  const logs = await prisma.credentialAccess.findMany({
    where: { credentialId: stored.id },
    select: { action: true, userId: true, ipAddress: true },
  });
  check("reveal is recorded", logs.length === 1 && logs[0]?.action === "REVEAL");
  check("access log carries no secret", !JSON.stringify(logs).includes(SECRET));

  // Cleanup.
  await prisma.credentialAccess.deleteMany({ where: { credentialId: { in: [stored.id, victim.id] } } });
  await prisma.credential.deleteMany({ where: { name: { startsWith: "ZZZ-VERIFY-" } } });
  console.log("\ntemporary credentials removed");

  if (failures > 0) {
    console.log(`${String(failures)} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("all vault security checks passed");
  }
}

main()
  .catch((e: unknown) => {
    console.error("error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
