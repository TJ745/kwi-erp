/**
 * IBAN handling.
 *
 * A wrong IBAN is a salary paid to a stranger, and the bank will not catch a
 * digit swap that still checksums — but it will catch one that does not. The
 * mod-97 check (ISO 13616) costs nothing and rejects the overwhelming majority
 * of typos, so it runs before the value is ever stored.
 */

/** Saudi IBANs are always SA + 2 check digits + 18 more characters. */
const IBAN_LENGTH_BY_COUNTRY: Record<string, number> = {
  SA: 24,
  AE: 23,
  BH: 22,
  KW: 30,
  QA: 29,
  OM: 23,
  EG: 29,
  JO: 30,
  PK: 24,
  IN: 0, // India has no IBAN; a value here is a mistake worth rejecting.
  GB: 22,
  US: 0, // Nor does the United States.
};

/** Strips the spaces people paste from a bank statement, and upper-cases. */
export function normaliseIban(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export type IbanProblem =
  | "EMPTY"
  | "FORMAT"
  | "LENGTH"
  | "CHECKSUM"
  | "COUNTRY_HAS_NO_IBAN";

/**
 * Validates an IBAN, returning the specific problem rather than a boolean —
 * "that is not a valid IBAN" is not an actionable error message.
 */
export function validateIban(raw: string): { ok: true; iban: string } | {
  ok: false;
  problem: IbanProblem;
} {
  const iban = normaliseIban(raw);

  if (iban.length === 0) return { ok: false, problem: "EMPTY" };

  // Two letters, two digits, then alphanumerics. Anything else is not an IBAN.
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) {
    return { ok: false, problem: "FORMAT" };
  }

  if (iban.length < 15 || iban.length > 34) {
    return { ok: false, problem: "LENGTH" };
  }

  const country = iban.slice(0, 2);
  const expected = IBAN_LENGTH_BY_COUNTRY[country];

  if (expected === 0) return { ok: false, problem: "COUNTRY_HAS_NO_IBAN" };
  if (expected !== undefined && iban.length !== expected) {
    return { ok: false, problem: "LENGTH" };
  }

  return mod97(iban) === 1 ? { ok: true, iban } : { ok: false, problem: "CHECKSUM" };
}

export function describeIbanProblem(problem: IbanProblem): string {
  switch (problem) {
    case "EMPTY":
      return "An IBAN is required";
    case "FORMAT":
      return "An IBAN starts with two letters and two digits, for example SA03…";
    case "LENGTH":
      return "That IBAN is the wrong length for its country";
    case "COUNTRY_HAS_NO_IBAN":
      return "That country does not use IBANs — record the account number instead";
    case "CHECKSUM":
      return "That IBAN fails its checksum — check for a mistyped character";
  }
}

/**
 * ISO 13616 mod-97: move the first four characters to the end, replace letters
 * with digits (A=10 … Z=35), and take the whole thing mod 97. Valid IBANs give
 * 1.
 *
 * The remainder is carried through the string in chunks because the number is
 * far larger than a JS integer can hold.
 */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    // A–Z become two digits; 0–9 stay one.
    const value =
      code >= 65 && code <= 90 ? String(code - 55) : char;

    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder;
}

/** Shows only the last four characters. Used wherever a full IBAN is not needed. */
export function maskIban(iban: string): string {
  const clean = normaliseIban(iban);
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 2)}${"•".repeat(Math.max(0, clean.length - 6))}${clean.slice(-4)}`;
}
