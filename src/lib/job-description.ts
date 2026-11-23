/**
 * The company's job description template: its sections, in print order, and
 * the fixed wording. Each list is stored as text, one item per line.
 */

export const JD_LISTS = [
  { key: "organizational", label: "Organizational", group: "duties" },
  { key: "departmental", label: "Departmental", group: "duties" },
  { key: "education", label: "Education", group: "profile" },
  { key: "experience", label: "Experience", group: "profile" },
  { key: "skills", label: "Personal Attributes / Skills", group: "profile" },
  { key: "others", label: "Others", group: "profile" },
] as const;

export type JdListKey = (typeof JD_LISTS)[number]["key"];

export const JD_NOTE =
  "The duties & responsibilities listed above are an illustrative list and not an exhaustive list. Additional responsibilities may be added from time to time depending on organisational requirements.";

export const JD_ACKNOWLEDGEMENT =
  "I, hereby acknowledge that I have read, understood, and undertake to faithfully adhere to do my duties and responsibilities.";

/** A stored list as its items: one per line, blank lines and bullets dropped. */
export function listItems(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•◆*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}
