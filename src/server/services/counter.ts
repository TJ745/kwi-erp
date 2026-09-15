import "server-only";
import { prisma } from "@/server/db/client";

/**
 * Structural type so both the extended client and a transaction client are
 * accepted without unioning their (different) shapes.
 */
type RawClient = Pick<typeof prisma, "$queryRaw">;

/**
 * Sequential, human-facing business codes — TSK-00042, TKT-2026-0117, IT-00045.
 *
 * Deliberately separate from the cuid primary keys: a PK is unguessable and
 * meaningless to staff, while these are what people read out over the phone.
 * Codes are never recycled, so a soft-deleted asset keeps its code.
 *
 * Employee numbers are NOT generated here: the company assigns them itself
 * (people were numbered before this system existed), so the person creating
 * the record types the number in.
 */

export type CounterKey =
  | "task"
  | "asset"
  | "vehicle"
  | "letter"
  | `ticket:${string}`;

/**
 * Atomically increments a counter and returns the new value.
 *
 * One statement decides both insert-vs-increment and the returned value, so
 * two concurrent creates cannot receive the same number. A read-then-write
 * (even inside a transaction) would need an explicit row lock to be safe;
 * this needs none.
 */
export async function nextSequence(
  key: CounterKey,
  tx: RawClient = prisma,
): Promise<number> {
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

export async function nextTaskNo(tx?: RawClient): Promise<string> {
  return `TSK-${pad(await nextSequence("task", tx), 5)}`;
}

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

/** Tickets reset each year, so the counter key is year-scoped. */
export async function nextTicketNo(tx?: RawClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const value = await nextSequence(`ticket:${String(year)}`, tx);
  return `TKT-${String(year)}-${pad(value, 4)}`;
}
