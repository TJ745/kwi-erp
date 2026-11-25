/**
 * Who appears in "pick an employee" lists: the people currently on staff,
 * including new hires being taken on. Leavers are not offered — except where
 * a record already names one, so that record can still be edited.
 */
export const CURRENT_STAFF = ["NEW_HIRE", "ACTIVE", "ON_LEAVE"] as const;

export function isCurrentStaff(status: string): boolean {
  return (CURRENT_STAFF as readonly string[]).includes(status);
}

/** Current staff, plus anyone named by the given ids. */
export function forPicker<T extends { id: string; status: string }>(
  employees: readonly T[],
  keep: Iterable<string | null | undefined> = [],
): T[] {
  const kept = new Set([...keep].filter((v): v is string => Boolean(v)));
  return employees.filter((e) => isCurrentStaff(e.status) || kept.has(e.id));
}
