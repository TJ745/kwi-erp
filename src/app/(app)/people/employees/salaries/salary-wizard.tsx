"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalaryImportResponse, SalaryPreview } from "@/lib/salary-import";

const Step = ({ n }: { n: number }) => (
  <span className="bg-brand-teal text-brand-teal-foreground flex size-6 items-center justify-center rounded-full text-xs font-bold">
    {n}
  </span>
);

/** Download the pre-filled sheet, edit amounts, upload, check, save. */
export function SalaryWizard() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<SalaryPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"preview" | "commit" | null>(null);
  const [filter, setFilter] = React.useState<"changed" | "errors" | "all">("changed");

  async function send(mode: "preview" | "commit"): Promise<SalaryImportResponse> {
    if (!file) return { ok: false, error: "Choose a file first." };
    const body = new FormData();
    body.set("mode", mode);
    body.set("file", file);
    const response = await fetch("/api/employees/salaries", { method: "POST", body });
    return (await response.json().catch(() => ({
      ok: false,
      error: `The server returned ${String(response.status)} without details.`,
    }))) as SalaryImportResponse;
  }

  function onPreview() {
    setBusy("preview");
    setError(null);
    void send("preview")
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          setPreview(result.preview ?? null);
          return;
        }
        if (result.mode === "preview") {
          setPreview(result.preview);
          setFilter(result.preview.errorCount > 0 ? "errors" : "changed");
        }
      })
      .finally(() => {
        setBusy(null);
      });
  }

  function onCommit() {
    setBusy("commit");
    setError(null);
    void send("commit")
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          if (result.preview) {
            setPreview(result.preview);
            setFilter("errors");
          }
          return;
        }
        if (result.mode === "commit") {
          toast.success(`Updated the salary of ${String(result.updated)} employee(s).`);
          router.push("/people/employees");
          router.refresh();
        }
      })
      .finally(() => {
        setBusy(null);
      });
  }

  const rows = preview
    ? preview.rows.filter((r) =>
        filter === "all" ? true : filter === "errors" ? r.issues.length > 0 : r.changed,
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Step n={1} />
              Download the salary sheet
            </CardTitle>
            <CardDescription>
              Every employee you can see, with their current salary. Change the amounts in Excel — a
              blank cell means no amount. Rows are matched by Employee ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="/api/employees/salaries/template"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download />
              Salary sheet (.xlsx)
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Step n={2} />
              Upload the edited sheet
            </CardTitle>
            <CardDescription>Nothing is saved until you confirm the check.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setError(null);
              }}
              className="hidden"
              aria-label="Excel file"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <FileSpreadsheet />
                {file ? "Choose a different file" : "Choose file"}
              </Button>
              {file ? (
                <span className="text-muted-foreground truncate text-sm">{file.name}</span>
              ) : null}
            </div>
            <Button type="button" size="sm" disabled={!file || busy !== null} onClick={onPreview}>
              <Upload />
              {busy === "preview" ? "Checking…" : "Check file"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {preview ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Step n={3} />
                Check
              </CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{preview.changedCount} changed</Badge>
                <Badge variant="outline">{preview.unchangedCount} unchanged</Badge>
                <Badge variant="outline">{preview.errorCount} with errors</Badge>
                {(["changed", "errors", "all"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`text-xs underline-offset-2 hover:underline ${filter === f ? "font-semibold" : ""}`}
                    onClick={() => {
                      setFilter(f);
                    }}
                  >
                    {f === "changed" ? "Show changed" : f === "errors" ? "Show errors" : "Show all"}
                  </button>
                ))}
              </CardDescription>
            </div>
            <Button
              type="button"
              disabled={preview.errorCount > 0 || preview.changedCount === 0 || busy !== null}
              onClick={onCommit}
            >
              {busy === "commit"
                ? "Saving…"
                : `Save ${String(preview.changedCount)} salary change${preview.changedCount === 1 ? "" : "s"}`}
            </Button>
          </CardHeader>
          <CardContent>
            {preview.errorCount > 0 ? (
              <p className="text-muted-foreground mb-3 text-sm">
                Fix these rows in Excel (row numbers are the spreadsheet&apos;s), choose the file
                again and re-check. Nothing is saved while any row has an error.
              </p>
            ) : null}
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">No rows to show.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="w-16 px-2 py-1 text-left font-medium">Row</th>
                      <th className="px-2 py-1 text-left font-medium">Employee ID</th>
                      <th className="px-2 py-1 text-left font-medium">Name</th>
                      <th className="px-2 py-1 text-left font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.rowNumber} className="border-t">
                        <td className="text-muted-foreground px-2 py-1 tabular-nums">
                          {r.rowNumber}
                        </td>
                        <td className="px-2 py-1 font-mono text-xs">{r.employeeNo}</td>
                        <td className="px-2 py-1">{r.name}</td>
                        <td className="px-2 py-1">
                          {r.issues.length > 0 ? (
                            <ul className="text-status-expired space-y-0.5 text-sm">
                              {r.issues.map((issue, i) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          ) : r.changed ? (
                            <span className="text-status-valid inline-flex items-center gap-1">
                              <CheckCircle2 className="size-3.5" />
                              Will be updated
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No change</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
