/**
 * `FormData.get` returns `string | File | null`. Coercing that with `String()`
 * silently yields "[object File]" for a file input, which would then be
 * validated and stored as if it were text.
 */
export function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
