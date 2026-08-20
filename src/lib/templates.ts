/**
 * Letter template engine — brief §37, docs/SECURITY.md §8.
 *
 * Two separate security problems, solved separately:
 *
 *   1. TEMPLATE INJECTION — a template must not be able to execute anything.
 *      Substitution resolves names from a declared allowlist and does nothing
 *      else: no expressions, no function calls, no property traversal.
 *
 *   2. XSS — a template body is authored HTML (it has to be, for formatting),
 *      so it is sanitised against a tag/attribute allowlist before storage and
 *      again before render. Substituted VALUES are always HTML-escaped, so an
 *      employee named `<script>` cannot inject anything.
 *
 * Free of any server import so both can be tested directly.
 */

/** Placeholders a template may reference. Anything else is left visible as an
 *  unresolved token rather than silently blanked — a letter that quietly loses
 *  the salary line is worse than one that visibly says it is broken. */
export const TEMPLATE_VARIABLES = {
  employee_name: "Employee full name",
  employee_name_ar: "Employee name (Arabic)",
  // The four parts separately, because Saudi government forms address a person
  // by each one in its own box — printing the full name into a four-cell row
  // is not the same document.
  employee_first_name: "First name",
  employee_middle_name: "Middle name (father's name)",
  employee_last_name: "Last name (grandfather's name)",
  employee_family_name: "Family name",
  employee_id: "Employee number",
  employee_nationality: "Nationality",
  iqama_number: "Iqama number",
  passport_number: "Passport number",
  company_name: "Company registered name",
  company_short_name: "Company short name",
  company_cr: "Commercial registration number",
  company_city: "Company city",
  position: "Job title",
  department: "Department",
  department_manager: "Head of the employee's department",
  joining_date: "Joining date",
  last_working_date: "Last working date",
  salary: "Basic salary",
  salary_words: "Basic salary in words",
  currency: "Currency",
  contract_start: "Contract start date",
  contract_end: "Contract end date",
  today: "Today's date",
  today_hijri: "Today's date (Hijri)",
  letter_no: "Generated letter number",
} as const;

export type TemplateVariable = keyof typeof TEMPLATE_VARIABLES;

export const TEMPLATE_VARIABLE_KEYS = Object.keys(TEMPLATE_VARIABLES) as TemplateVariable[];

/** `{{ variable_name }}` — whitespace tolerated, nothing else permitted. */
const PLACEHOLDER = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type RenderResult = {
  html: string;
  /** Placeholders present in the template but absent from the data. */
  missing: string[];
  /** Placeholders referencing names that are not in the allowlist at all. */
  unknown: string[];
};

/**
 * Substitutes placeholders with escaped values.
 *
 * Values are escaped, never trusted: they come from employee records that
 * anyone with employees.update can edit.
 */
export function renderTemplate(
  body: string,
  data: Partial<Record<TemplateVariable, string | null>>,
): RenderResult {
  const missing = new Set<string>();
  const unknown = new Set<string>();
  const allowed = new Set<string>(TEMPLATE_VARIABLE_KEYS);

  const html = body.replace(PLACEHOLDER, (match, rawName: string) => {
    const name = rawName.toLowerCase();

    if (!allowed.has(name)) {
      unknown.add(name);
      // Left visible rather than blanked, so a typo in a template is obvious
      // on the preview instead of producing a silently wrong letter.
      return match;
    }

    const value = data[name as TemplateVariable];
    if (value === undefined || value === null || value === "") {
      missing.add(name);
      return match;
    }

    return escapeHtml(value);
  });

  return { html, missing: [...missing], unknown: [...unknown] };
}

/** Placeholders a template actually uses, for the editor's variable hints. */
export function extractVariables(body: string): { known: string[]; unknown: string[] } {
  const allowed = new Set<string>(TEMPLATE_VARIABLE_KEYS);
  const known = new Set<string>();
  const unknown = new Set<string>();

  for (const match of body.matchAll(PLACEHOLDER)) {
    const name = (match[1] ?? "").toLowerCase();
    if (allowed.has(name)) known.add(name);
    else unknown.add(name);
  }

  return { known: [...known], unknown: [...unknown] };
}

// --- Sanitisation ------------------------------------------------------------

/** Formatting only. Nothing that can load, execute, or navigate. */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td",
  "blockquote", "pre", "code", "small", "sub", "sup",
]);

/** `dir` and `lang` are kept because bilingual letters need them (Decision D). */
const ALLOWED_ATTRIBUTES = new Set(["style", "class", "dir", "lang", "colspan", "rowspan"]);

/** Inline styles are restricted to layout and typography — no url(), no
 *  position, nothing that can exfiltrate or overlay. */
const ALLOWED_STYLE_PROPERTIES = new Set([
  "text-align", "font-weight", "font-style", "font-size", "font-family",
  "text-decoration", "color", "background-color",
  "margin", "margin-top", "margin-bottom", "margin-left", "margin-right",
  "padding", "padding-top", "padding-bottom", "padding-left", "padding-right",
  "width", "border", "border-bottom", "border-top", "line-height", "direction",
  "vertical-align",
]);

/**
 * Strips anything not on the allowlist.
 *
 * Deliberately allowlist-based: a denylist of "dangerous" tags is always one
 * novel vector behind. Applied on save AND before render, because a template
 * stored before a rule tightened must not become exploitable.
 */
export function sanitiseTemplateHtml(html: string): string {
  let output = html;

  // Remove whole elements that can execute or load, including their content.
  output = output.replace(
    /<(script|style|iframe|object|embed|link|meta|base|form|input|button|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
    "",
  );
  // …and their self-closing or unterminated forms.
  output = output.replace(
    /<(script|style|iframe|object|embed|link|meta|base|form|input|button|svg|math)\b[^>]*\/?>/gi,
    "",
  );
  // HTML comments can hide conditional-comment payloads.
  output = output.replace(/<!--[\s\S]*?-->/g, "");

  // Rewrite every remaining tag through the allowlist.
  output = output.replace(
    /<(\/)?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*)?)\/?>/g,
    (_match, closing: string | undefined, tagName: string, attrs: string | undefined) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (closing) return `</${tag}>`;

      const safeAttrs = sanitiseAttributes(attrs ?? "");
      return `<${tag}${safeAttrs}>`;
    },
  );

  return output;
}

function sanitiseAttributes(raw: string): string {
  const kept: string[] = [];
  const attrPattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

  for (const match of raw.matchAll(attrPattern)) {
    const name = (match[1] ?? "").toLowerCase();
    const value = match[3] ?? match[4] ?? "";

    // on* handlers are the main event-injection vector.
    if (name.startsWith("on")) continue;
    if (!ALLOWED_ATTRIBUTES.has(name)) continue;

    // Any scheme in an attribute value is refused outright.
    if (/(javascript|data|vbscript)\s*:/i.test(value)) continue;

    if (name === "style") {
      const safeStyle = sanitiseStyle(value);
      if (safeStyle) kept.push(`style="${escapeHtml(safeStyle)}"`);
      continue;
    }

    kept.push(`${name}="${escapeHtml(value)}"`);
  }

  return kept.length > 0 ? ` ${kept.join(" ")}` : "";
}

function sanitiseStyle(value: string): string {
  const declarations: string[] = [];

  for (const part of value.split(";")) {
    const [rawProp, ...rest] = part.split(":");
    if (rest.length === 0) continue;

    const property = (rawProp ?? "").trim().toLowerCase();
    const propertyValue = rest.join(":").trim();

    if (!ALLOWED_STYLE_PROPERTIES.has(property)) continue;
    // url() can fetch a remote resource, which leaks that the letter was opened.
    if (/url\s*\(|expression\s*\(|@import/i.test(propertyValue)) continue;

    declarations.push(`${property}: ${propertyValue}`);
  }

  return declarations.join("; ");
}

/**
 * Gregorian date as Hijri (Umm al-Qura), formatted DD / MM / YYYY.
 *
 * Assembled from `formatToParts` rather than by formatting a string directly:
 * the `en` locale orders Islamic dates month-first, so the obvious
 * `format()` call yields 03/06/1448 where a Saudi form expects 06/03/1448.
 * Umm al-Qura specifically — it is the civil calendar Saudi government
 * paperwork is dated by, and it differs from the tabular reckoning other
 * calendars use.
 */
export function toHijri(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);

  const pick = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${pick("day")} / ${pick("month")} / ${pick("year")}`;
}
