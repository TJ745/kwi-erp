import "server-only";
import { prisma } from "@/server/db/client";
import { formatPrrNo } from "@/lib/recruitment-forms";
import { formatMaintenanceRequestNo } from "@/lib/vehicle-maintenance";

/**
 * Structural type so both the extended client and a transaction client are
 * accepted without unioning their (different) shapes.
 */
type RawClient = Pick<typeof prisma, "$queryRaw">;

/**
 * Sequential, human-facing business codes — IT-00045, VEH-007, LTR-2026-0012.
 *
 * Deliberately separate from the cuid primary keys: a PK is unguessable and
 * meaningless to staff, while these are what people read out over the phone.
 * Codes are never recycled, so a soft-deleted asset keeps its code.
 *
 * Employee numbers are NOT generated here: the company assigns them itself
 * (people were numbered before this system existed), so the person creating
 * the record types the number in.
 */

/** Offer references count per company and year, e.g. `offer:KWI:2026`. */
export type CounterKey =
  | "asset"
  | "vehicle"
  | "letter"
  | `offer:${string}:${number}`
  | `prr:${string}:${number}`
  | `vm:${string}`;

/**
 * Atomically increments a counter and returns the new value.
 *
 * One statement decides both insert-vs-increment and the returned value, so
 * two concurrent creates cannot receive the same number. A read-then-write
 * (even inside a transaction) would need an explicit row lock to be safe;
 * this needs none.
 */
export async function nextSequence(key: CounterKey, tx: RawClient = prisma): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value", "updatedAt")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = "Counter"."value" + 1, "updatedAt" = now()
    RETURNING "value"
  `;

  const value = rows[0]?.value;
  if (value === undefined) {
    throw new Error(`Counter "${key}" did not return a value`);
  }
  return value;
}

const pad = (value: number, width: number) => String(value).padStart(width, "0");

export async function nextAssetCode(tx?: RawClient): Promise<string> {
  return `IT-${pad(await nextSequence("asset", tx), 5)}`;
}

export async function nextVehicleCode(tx?: RawClient): Promise<string> {
  return `VEH-${pad(await nextSequence("vehicle", tx), 3)}`;
}

export async function nextLetterNo(tx?: RawClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  return `LTR-${String(year)}-${pad(await nextSequence("letter", tx), 4)}`;
}

/**
 * The "Our Ref." of an employment offer: company / number / two-digit year,
 * e.g. KWI/17/26. Numbered per company and per year.
 */
export async function nextOfferRef(
  companyCode: string,
  date: Date,
  tx?: RawClient,
): Promise<string> {
  const year = date.getUTCFullYear();
  const n = await nextSequence(`offer:${companyCode}:${year}`, tx);
  return `${companyCode}/${String(n)}/${String(year % 100).padStart(2, "0")}`;
}

/** Personnel Requirement Request numbers, per company and year: PRR-KWI-26-001. */
export async function nextPrrNo(companyCode: string, date: Date, tx?: RawClient): Promise<string> {
  const year = date.getUTCFullYear();
  const n = await nextSequence(`prr:${companyCode}:${year}`, tx);
  return formatPrrNo(companyCode, year, n);
}

/** Vehicle maintenance request numbers, per company: KWI/VM/039. */
export async function nextMaintenanceRequestNo(
  companyCode: string,
  tx?: RawClient,
): Promise<string> {
  return formatMaintenanceRequestNo(companyCode, await nextSequence(`vm:${companyCode}`, tx));
}
