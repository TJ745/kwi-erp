/**
 * Warning escalation — brief §19. The next level is suggested from the
 * employee's earlier warnings; the person issuing it still decides.
 */

/** Warning levels in escalation order, so "what came before" is answerable. */
export const WARNING_LEVELS = ["VERBAL", "FIRST_WRITTEN", "SECOND_WRITTEN", "FINAL"] as const;

export type WarningLevel = (typeof WARNING_LEVELS)[number];

/**
 * The level that would normally come next after the ones already issued.
 *
 * Advisory only — HR may skip straight to FINAL for gross misconduct, and the
 * form allows it. This just stops the common case being a guess.
 */
export function suggestedNextLevel(previousLevels: readonly WarningLevel[]): WarningLevel {
  if (previousLevels.length === 0) return "VERBAL";

  const highest = previousLevels.reduce((max, level) => {
    const a = WARNING_LEVELS.indexOf(level);
    const b = WARNING_LEVELS.indexOf(max);
    return a > b ? level : max;
  }, WARNING_LEVELS[0]);

  const next = WARNING_LEVELS.indexOf(highest) + 1;
  return WARNING_LEVELS[Math.min(next, WARNING_LEVELS.length - 1)] ?? "FINAL";
}
