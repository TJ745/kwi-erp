/**
 * Derived figures for increments and evaluations — brief §21, §22.
 *
 * Both tables store values that can be computed from their inputs:
 * `Increment.amount`/`percentage` from the two salaries, and
 * `Evaluation.overallScore` from the weighted criteria. Storing a figure
 * alongside the inputs that produce it means the two can disagree, and a
 * salary increase that says "5%" next to numbers showing 8% is worse than
 * either number alone.
 *
 * So they are computed here, on the server, from the inputs — never accepted
 * from the client. The stored copy exists for reporting and history; this is
 * the only thing that writes it.
 */

/** Money in integer minor units, for the same reason as petty cash. */
function toMinor(amount: string | number): number {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export type IncrementFigures = {
  /** newSalary − currentSalary, two decimal places. */
  amount: string;
  /** Percentage of the current salary, three decimal places. */
  percentage: string;
};

/**
 * Derives the increase from the two salaries.
 *
 * A decrease is representable — pay cuts and corrections exist — so the amount
 * is signed rather than clamped.
 */
export function incrementFigures(
  currentSalary: string,
  newSalary: string,
): IncrementFigures {
  const currentMinor = toMinor(currentSalary);
  const newMinor = toMinor(newSalary);
  const diffMinor = newMinor - currentMinor;

  // A rise from zero has no meaningful percentage; reporting 0 is less
  // misleading than Infinity or NaN reaching a spreadsheet.
  const percentage = currentMinor === 0 ? 0 : (diffMinor / currentMinor) * 100;

  return {
    amount: (diffMinor / 100).toFixed(2),
    percentage: percentage.toFixed(3),
  };
}

export type CriterionScore = {
  criterion: string;
  /** Relative importance. Weights need not sum to 100. */
  weight: string;
  /** Score awarded, on whatever scale the form uses. */
  score: string;
};

/**
 * Weighted average of the criteria.
 *
 * Weights are normalised by their own total rather than assumed to sum to 100,
 * so a half-filled form still produces a meaningful score instead of one
 * silently halved.
 */
export function overallScore(scores: readonly CriterionScore[]): string | null {
  if (scores.length === 0) return null;

  let weightedTotal = 0;
  let weightTotal = 0;

  for (const entry of scores) {
    const weight = Number(entry.weight);
    const score = Number(entry.score);
    if (!Number.isFinite(weight) || !Number.isFinite(score)) continue;
    if (weight <= 0) continue;

    weightedTotal += weight * score;
    weightTotal += weight;
  }

  if (weightTotal === 0) return null;
  return (weightedTotal / weightTotal).toFixed(2);
}

/** Warning levels in escalation order, so "what came before" is answerable. */
export const WARNING_LEVELS = [
  "VERBAL",
  "FIRST_WRITTEN",
  "SECOND_WRITTEN",
  "FINAL",
] as const;

export type WarningLevel = (typeof WARNING_LEVELS)[number];

/**
 * The level that would normally come next after the ones already issued.
 *
 * Advisory only — HR may skip straight to FINAL for gross misconduct, and the
 * form allows it. This just stops the common case being a guess.
 */
export function suggestedNextLevel(
  previousLevels: readonly WarningLevel[],
): WarningLevel {
  if (previousLevels.length === 0) return "VERBAL";

  const highest = previousLevels.reduce((max, level) => {
    const a = WARNING_LEVELS.indexOf(level);
    const b = WARNING_LEVELS.indexOf(max);
    return a > b ? level : max;
  }, WARNING_LEVELS[0]);

  const next = WARNING_LEVELS.indexOf(highest) + 1;
  return WARNING_LEVELS[Math.min(next, WARNING_LEVELS.length - 1)] ?? "FINAL";
}
