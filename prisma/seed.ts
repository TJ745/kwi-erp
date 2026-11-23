import { existsSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_DESCRIPTIONS,
  ROLE_KEYS,
  ROLE_PERMISSIONS,
  ROLE_RANKS,
} from "../src/lib/permissions.js";
import { extractVariables, sanitiseTemplateHtml } from "../src/lib/templates.js";
import { SEED_TEMPLATES } from "./seed-letter-templates.js";

for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// ---------------------------------------------------------------------------
// Guard: never seed production by accident.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  console.error(
    "Refusing to seed with NODE_ENV=production.\n" +
      "Set ALLOW_PRODUCTION_SEED=true only if you genuinely intend this.",
  );
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL (or DIRECT_URL) must be set to seed.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };

/** All seed writes are upserts keyed on a natural key, so re-running is safe. */
async function main() {
  console.log("Seeding OMS development data...\n");

  // --- Permissions ---------------------------------------------------------
  for (const key of PERMISSION_KEYS) {
    const meta = PERMISSIONS[key];
    const sensitive = "sensitive" in meta && meta.sensitive === true;
    await prisma.permission.upsert({
      where: { key },
      update: { module: meta.module, label: meta.label, isSensitive: sensitive },
      create: { key, module: meta.module, label: meta.label, isSensitive: sensitive },
    });
  }
  console.log(`  permissions      ${PERMISSION_KEYS.length}`);

  // --- Roles + mappings ----------------------------------------------------
  for (const roleKey of ROLE_KEYS) {
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: {
        name: roleKey.replace(/_/g, " "),
        description: ROLE_DESCRIPTIONS[roleKey],
        rank: ROLE_RANKS[roleKey],
        isSystem: true,
      },
      create: {
        key: roleKey,
        name: roleKey.replace(/_/g, " "),
        description: ROLE_DESCRIPTIONS[roleKey],
        rank: ROLE_RANKS[roleKey],
        isSystem: true,
      },
    });

    const permissionKeys = ROLE_PERMISSIONS[roleKey];
    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...permissionKeys] } },
      select: { id: true },
    });

    // Replace the mapping wholesale so edits to the matrix take effect.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log(`  roles            ${ROLE_KEYS.length}`);

  // --- Companies -----------------------------------------------------------
  const companySeeds = [
    {
      code: "KWI",
      name: "KWI Company Limited",
      shortName: "KWI",
      city: "Riyadh",
      country: "SA",
    },
    {
      code: "ICC",
      name: "ICC Contracting Company",
      shortName: "ICC",
      city: "Jeddah",
      country: "SA",
    },
  ];

  // Created only when absent. The seed is re-runnable, and a re-run must not
  // overwrite the registered name, CR, VAT, or address an administrator has
  // since entered — those are the real company's details, and the values
  // below are only enough to make a fresh database usable.
  const companies = new Map<string, string>();
  for (const c of companySeeds) {
    const company = await prisma.company.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    companies.set(c.code, company.id);
  }
  console.log(`  companies        ${companySeeds.length}`);

  // --- Departments ---------------------------------------------------------
  const departmentNames = [
    ["ADMIN", "Administration"],
    ["HR", "Human Resources"],
    ["IT", "Information Technology"],
    ["FIN", "Finance"],
    ["OPS", "Operations"],
    ["PROJ", "Projects"],
    ["SAFE", "Safety & Quality"],
    ["LOG", "Logistics"],
  ] as const;

  let departmentCount = 0;
  for (const [code, companyId] of companies) {
    void code;
    for (const [deptCode, name] of departmentNames) {
      await prisma.department.upsert({
        where: { companyId_code: { companyId, code: deptCode } },
        update: {},
        create: { companyId, code: deptCode, name },
      });
      departmentCount += 1;
    }
  }
  console.log(`  departments      ${departmentCount}`);

  // --- Positions -----------------------------------------------------------
  const positionTitles = [
    "General Manager",
    "Administration Manager",
    "HR Manager",
    "HR Officer",
    "IT Manager",
    "IT Technician",
    "Accountant",
    "Site Engineer",
    "Project Manager",
    "Safety Officer",
    "Driver",
    "Storekeeper",
    "Technician",
    "Foreman",
    "Labourer",
  ];

  for (const title of positionTitles) {
    const existing = await prisma.position.findFirst({
      where: { title, companyId: null },
      select: { id: true },
    });
    if (!existing) {
      await prisma.position.create({ data: { title } });
    }
  }
  console.log(`  positions        ${positionTitles.length}`);

  // --- Lookup tables -------------------------------------------------------
  const documentTypes = [
    { key: "CV", name: "Curriculum Vitae", requiresExpiry: false, appliesTo: ["EMPLOYEE"] },
    { key: "IQAMA", name: "Iqama / Residency", requiresExpiry: true, appliesTo: ["EMPLOYEE"] },
    { key: "PASSPORT", name: "Passport", requiresExpiry: true, appliesTo: ["EMPLOYEE"] },
    { key: "IBAN", name: "IBAN Certificate", requiresExpiry: false, appliesTo: ["EMPLOYEE"] },
    {
      key: "CERTIFICATE",
      name: "Educational Certificate",
      requiresExpiry: false,
      appliesTo: ["EMPLOYEE"],
    },
    {
      key: "TRAINING",
      name: "Training Certificate",
      requiresExpiry: true,
      appliesTo: ["EMPLOYEE"],
    },
    { key: "CONTRACT", name: "Contract", requiresExpiry: true, appliesTo: ["EMPLOYEE"] },
    {
      key: "VEHICLE_REG",
      name: "Vehicle Registration",
      requiresExpiry: true,
      appliesTo: ["VEHICLE"],
    },
    {
      key: "VEHICLE_INS",
      name: "Vehicle Insurance",
      requiresExpiry: true,
      appliesTo: ["VEHICLE"],
    },
    { key: "CR", name: "Commercial Registration", requiresExpiry: true, appliesTo: ["COMPANY"] },

    // --- Types specific to each module's nature ---------------------------
    // requiresExpiry is set only where the document genuinely lapses, because
    // it is what feeds the expiry index and the dashboard alerts. Marking a
    // paid invoice as expiring would put it in the renewals queue forever.

    { key: "VEHICLE_ISTIMARA", name: "Istimara (Vehicle Licence)", requiresExpiry: true, appliesTo: ["VEHICLE"] },
    { key: "VEHICLE_INSPECTION", name: "Periodic Inspection (Fahes)", requiresExpiry: true, appliesTo: ["VEHICLE"] },
    { key: "VEHICLE_PURCHASE", name: "Purchase Invoice", requiresExpiry: false, appliesTo: ["VEHICLE"] },
    { key: "MAINT_INVOICE", name: "Workshop Invoice", requiresExpiry: false, appliesTo: ["VEHICLE_MAINTENANCE"] },
    { key: "MAINT_QUOTE", name: "Workshop Quotation", requiresExpiry: false, appliesTo: ["VEHICLE_MAINTENANCE"] },

    { key: "EMP_CONTRACT", name: "Signed Contract", requiresExpiry: true, appliesTo: ["CONTRACT"] },
    { key: "CONTRACT_AMENDMENT", name: "Contract Amendment", requiresExpiry: false, appliesTo: ["CONTRACT"] },

    { key: "OFFER_LETTER", name: "Signed Offer Letter", requiresExpiry: false, appliesTo: ["JOB_OFFER"] },
    { key: "CANDIDATE_CV", name: "Candidate CV", requiresExpiry: false, appliesTo: ["JOB_OFFER"] },

    { key: "LEASE", name: "Lease Contract", requiresExpiry: true, appliesTo: ["ACCOMMODATION"] },
    { key: "MUNICIPALITY_LICENCE", name: "Municipality Licence", requiresExpiry: true, appliesTo: ["ACCOMMODATION"] },
    { key: "RENT_RECEIPT", name: "Rent Receipt", requiresExpiry: false, appliesTo: ["ACCOMMODATION"] },

    { key: "VENDOR_CR", name: "Commercial Registration", requiresExpiry: true, appliesTo: ["SUBCONTRACTOR"] },
    { key: "VENDOR_VAT", name: "VAT Certificate", requiresExpiry: false, appliesTo: ["SUBCONTRACTOR"] },
    { key: "VENDOR_BANK", name: "Bank Letter", requiresExpiry: false, appliesTo: ["SUBCONTRACTOR"] },
    { key: "SUBCONTRACT", name: "Subcontract Agreement", requiresExpiry: true, appliesTo: ["SUBCONTRACTOR"] },

    { key: "CERT_SCAN", name: "Certificate Scan", requiresExpiry: true, appliesTo: ["COMPANY_CERTIFICATE"] },

    { key: "POLICY_SCHEDULE", name: "Policy Schedule", requiresExpiry: true, appliesTo: ["MEDICAL_INSURANCE_POLICY"] },
    { key: "POLICY_MEMBERS", name: "Member List", requiresExpiry: false, appliesTo: ["MEDICAL_INSURANCE_POLICY"] },

    { key: "ASSET_INVOICE", name: "Purchase Invoice", requiresExpiry: false, appliesTo: ["IT_ASSET"] },
    { key: "ASSET_WARRANTY", name: "Warranty Document", requiresExpiry: true, appliesTo: ["IT_ASSET"] },

    // Last, and applicable everywhere: there is always a document nobody
    // anticipated, and without this the upload is simply refused.
    {
      key: "OTHER",
      name: "Other Document",
      requiresExpiry: false,
      appliesTo: [
        "EMPLOYEE", "COMPANY", "VEHICLE", "VEHICLE_MAINTENANCE", "IT_ASSET",
        "CONTRACT", "JOB_OFFER", "ACCOMMODATION", "SUBCONTRACTOR",
        "COMPANY_CERTIFICATE", "MEDICAL_INSURANCE_POLICY",
      ],
    },
  ] as const;

  for (const dt of documentTypes) {
    await prisma.documentType.upsert({
      where: { key: dt.key },
      update: {
        name: dt.name,
        requiresExpiry: dt.requiresExpiry,
        // Updated, not just set on create: OTHER started as employee-only, and
        // an existing database would otherwise keep the narrow list forever.
        appliesTo: [...dt.appliesTo],
      },
      create: {
        key: dt.key,
        name: dt.name,
        requiresExpiry: dt.requiresExpiry,
        appliesTo: [...dt.appliesTo],
        isSystem: true,
      },
    });
  }

  const leaveTypes = [
    { key: "ANNUAL", name: "Annual Leave", isPaid: true, maxDaysPerYear: 30 },
    { key: "SICK", name: "Sick Leave", isPaid: true, maxDaysPerYear: 30 },
    { key: "UNPAID", name: "Unpaid Leave", isPaid: false },
    { key: "EMERGENCY", name: "Emergency Leave", isPaid: true, maxDaysPerYear: 5 },
    { key: "HAJJ", name: "Hajj Leave", isPaid: true, maxDaysPerYear: 10 },
    { key: "MATERNITY", name: "Maternity Leave", isPaid: true, maxDaysPerYear: 70 },
  ];

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { key: lt.key },
      update: { name: lt.name },
      create: { ...lt, isSystem: true },
    });
  }

  const credentialCategories = [
    { key: "GOVERNMENT", name: "Government Portals" },
    { key: "COMPANY_PORTAL", name: "Company Portals" },
    { key: "EMAIL", name: "Email Accounts" },
    { key: "SERVER", name: "Servers" },
    { key: "NETWORK", name: "Network Devices" },
    { key: "CCTV", name: "CCTV" },
    { key: "SOFTWARE", name: "Software Administration" },
    { key: "OTHER", name: "Other" },
  ];

  for (const cc of credentialCategories) {
    await prisma.credentialCategory.upsert({
      where: { key: cc.key },
      update: { name: cc.name },
      create: cc,
    });
  }

  const certificateTypes = [
    { key: "CR", name: "Commercial Registration" },
    { key: "VAT", name: "VAT Certificate" },
    { key: "GOSI", name: "GOSI Certificate" },
    { key: "ZAKAT", name: "Zakat Certificate" },
    { key: "CHAMBER", name: "Chamber of Commerce" },
    { key: "MUNICIPAL", name: "Municipal Licence" },
    { key: "SAUDIZATION", name: "Saudization Certificate" },
  ];

  for (const ct of certificateTypes) {
    await prisma.certificateType.upsert({
      where: { key: ct.key },
      update: { name: ct.name },
      create: { ...ct, isSystem: true },
    });
  }

  console.log("  lookup tables    document/leave/credential/certificate");

  // --- Notification rules --------------------------------------------------
  const adminRole = await prisma.role.findUnique({ where: { key: "ADMIN" } });
  const hrRole = await prisma.role.findUnique({ where: { key: "HR" } });
  const itRole = await prisma.role.findUnique({ where: { key: "IT_ADMIN" } });

  const notificationRules = [
    { name: "Iqama expiry", kind: "EXPIRY", source: "IQAMA", roles: [hrRole?.id, adminRole?.id] },
    { name: "Passport expiry", kind: "EXPIRY", source: "PASSPORT", roles: [hrRole?.id] },
    {
      name: "Contract expiry",
      kind: "EXPIRY",
      source: "EMPLOYEE_CONTRACT",
      roles: [hrRole?.id, adminRole?.id],
    },
    {
      name: "Company certificate expiry",
      kind: "EXPIRY",
      source: "COMPANY_CERTIFICATE",
      roles: [adminRole?.id],
    },
    {
      name: "Vehicle registration expiry",
      kind: "EXPIRY",
      source: "VEHICLE_REGISTRATION",
      roles: [adminRole?.id],
    },
    {
      name: "Vehicle insurance expiry",
      kind: "EXPIRY",
      source: "VEHICLE_INSURANCE",
      roles: [adminRole?.id],
    },
    {
      name: "Medical insurance expiry",
      kind: "EXPIRY",
      source: "MEDICAL_INSURANCE_POLICY",
      roles: [hrRole?.id, adminRole?.id],
    },
    {
      name: "IT warranty expiry",
      kind: "EXPIRY",
      source: "IT_ASSET_WARRANTY",
      roles: [itRole?.id],
    },
  ] as const;

  /**
   * Which kinds are worth an email as well as an in-app entry.
   *
   * Expiry is the whole reason the reminder engine exists — an Iqama lapsing is
   * not something to discover by opening the app.
   *
   * A rule's channels are authoritative, so a kind listed here that is NOT in
   * this set will never be emailed however the provider is configured. That is
   * deliberate — it is the setting, and it is visible in the data.
   */
  const EMAIL_KINDS = new Set(["EXPIRY"]);

  for (const rule of notificationRules) {
    const existing = await prisma.notificationRule.findFirst({ where: { name: rule.name } });

    // Roles are looked up above and may be absent; narrow to the ones that exist.
    const roleIds: string[] = (rule.roles as readonly (string | undefined)[]).filter(
      (id): id is string => typeof id === "string",
    );

    const data = {
      name: rule.name,
      kind: rule.kind,
      source: rule.source,
      roleIds,
      // Set on update as well as create, so re-seeding an existing install
      // repairs rules that predate the email channel.
      channels: EMAIL_KINDS.has(rule.kind)
        ? ["IN_APP" as const, "EMAIL" as const]
        : ["IN_APP" as const],
    };
    if (existing) {
      await prisma.notificationRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.notificationRule.create({ data });
    }
  }
  console.log(`  notification rules ${notificationRules.length}`);

  // --- Letter templates ----------------------------------------------------
  // Company-neutral (companyId null) so both entities can use them; a company
  // wanting its own wording clones one rather than editing the shared original.
  for (const seed of SEED_TEMPLATES) {
    // Run through the same sanitiser the service uses, so a seed can never
    // introduce markup the editor would have rejected.
    const bodyHtml = sanitiseTemplateHtml(seed.bodyHtml);
    const bodyHtmlAr = seed.bodyHtmlAr ? sanitiseTemplateHtml(seed.bodyHtmlAr) : null;

    const used = extractVariables(`${bodyHtml} ${bodyHtmlAr ?? ""}`);
    if (used.unknown.length > 0) {
      throw new Error(
        `Template "${seed.key}" references unknown placeholders: ${used.unknown.join(", ")}`,
      );
    }

    const data = {
      name: seed.name,
      type: seed.type,
      companyId: null,
      bodyHtml,
      bodyHtmlAr,
      variables: { known: used.known, unknown: [] },
      isActive: true,
    };

    await prisma.letterTemplate.upsert({
      where: { key: seed.key },
      update: data,
      create: { key: seed.key, ...data },
    });
  }
  console.log(`  letter templates ${SEED_TEMPLATES.length}`);

  // --- Counters ------------------------------------------------------------
  for (const key of ["employee", "asset", "vehicle", "letter"]) {
    await prisma.counter.upsert({ where: { key }, update: {}, create: { key, value: 0 } });
  }

  // --- Super administrator ---------------------------------------------------
  // The one account a fresh deployment starts with. Both values come from the
  // environment so the credentials never sit in a committed file; the password
  // is hashed with the same Argon2id profile as every other credential.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrator";

  if (!adminPassword) {
    console.log(
      "\n  admin user       SKIPPED (set SEED_ADMIN_PASSWORD to create the super admin)",
    );
  } else {
    const superAdmin = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
    const passwordHash = await hash(adminPassword, ARGON2_OPTIONS);

    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { roleId: superAdmin.id, status: "ACTIVE", name: adminName },
      create: {
        email: adminEmail,
        name: adminName,
        emailVerified: true,
        status: "ACTIVE",
        roleId: superAdmin.id,
      },
    });

    await prisma.account.upsert({
      where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
      update: { password: passwordHash },
      create: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      },
    });

    for (const companyId of companies.values()) {
      await prisma.userCompanyAccess.upsert({
        where: { userId_companyId: { userId: user.id, companyId } },
        update: {},
        create: { userId: user.id, companyId },
      });
    }
    console.log(`\n  admin user       ${adminEmail} (SUPER_ADMIN, all companies)`);
  }

  console.log("\nSeed complete.");
  console.log(
    "NOTE: no vault credentials are seeded. Real company secrets must never be " +
      "committed or seeded.",
  );
}

main()
  .catch((error: unknown) => {
    console.error("\nSeed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
