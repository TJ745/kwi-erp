"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  columnHeader,
  IMPORT_MAX_ROWS,
  type ImportPreview,
  type ImportResponse,
} from "@/lib/employee-import";

/**
 * Three steps on one screen: get the template, upload the filled file and
 * see every row's verdict, import. The file is held in the browser between
 * preview and import and sent again — the server keeps nothing between the
 * two, so what was previewed is exactly what is imported.
 */
export function ImportWizard() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"preview" | "commit" | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = React.useState(false);

  async function send(mode: "preview" | "commit"): Promise<ImportResponse> {
    if (!file) return { ok: false, error: "Choose a file first." };
    const body = new FormData();
    body.set("mode", mode);
    body.set("file", file);
    const response = await fetch("/api/employees/import", { method: "POST", body });
    // A non-JSON body (a proxy timeout page, say) must not become a crash.
    return (await response.json().catch(() => ({
      ok: false,
      error: `The server returned ${String(response.status)} without details.`,
    }))) as ImportResponse;
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setError(null);
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
          setShowOnlyErrors(result.preview.errorCount > 0);
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
            setShowOnlyErrors(true);
          }
          return;
        }
        if (result.mode === "commit") {
          toast.success(`Imported ${String(result.created)} employees.`);
          router.push("/people/employees");
          router.refresh();
        }
      })
      .finally(() => {
        setBusy(null);
      });
  }

  const rows = preview
    ? showOnlyErrors
      ? preview.rows.filter((r) => r.issues.length > 0)
      : preview.rows
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="bg-brand-teal text-brand-teal-foreground flex size-6 items-center justify-center rounded-full text-xs font-bold">
                1
              </span>
              Download the template
            </CardTitle>
            <CardDescription>
              One row per employee. Bold headers are required. The Reference sheet lists your
              companies, departments and positions — names must match exactly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="/api/employees/import/template"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download />
              Employee import template (.xlsx)
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="bg-brand-teal text-brand-teal-foreground flex size-6 items-center justify-center rounded-full text-xs font-bold">
                2
              </span>
              Upload the filled file
            </CardTitle>
            <CardDescription>
              Up to {IMPORT_MAX_ROWS.toLocaleString("en")} rows. Nothing is saved until you confirm
              the preview.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onFileChange}
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
                <span className="text-muted-foreground truncate text-sm">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </span>
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
                <span className="bg-brand-teal text-brand-teal-foreground flex size-6 items-center justify-center rounded-full text-xs font-bold">
                  3
                </span>
                Preview
              </CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="text-status-valid size-3" />
                  {preview.readyCount} ready
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <AlertCircle
                    className={
                      preview.errorCount > 0
                        ? "text-status-expired size-3"
                        : "text-muted-foreground size-3"
                    }
                  />
                  {preview.errorCount} with errors
                </Badge>
                {preview.errorCount > 0 ? (
                  <button
                    type="button"
                    className="text-xs underline-offset-2 hover:underline"
                    onClick={() => {
                      setShowOnlyErrors((v) => !v);
                    }}
                  >
                    {showOnlyErrors ? "Show all rows" : "Show only errors"}
                  </button>
                ) : null}
              </CardDescription>
            </div>
            <Button
              type="button"
              disabled={preview.errorCount > 0 || busy !== null}
              onClick={onCommit}
            >
              {busy === "commit" ? "Importing…" : `Import ${String(preview.readyCount)} employees`}
            </Button>
          </CardHeader>
          <CardContent>
            {preview.errorCount > 0 ? (
              <p className="text-muted-foreground mb-3 text-sm">
                Fix the rows below in Excel — the row numbers are the spreadsheet&apos;s — then
                choose the file again and re-check. Nothing is imported while any row has an error.
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {row.rowNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.employeeNo}</TableCell>
                      <TableCell>{row.fullName}</TableCell>
                      <TableCell>{row.companyCode || "—"}</TableCell>
                      <TableCell>
                        {row.issues.length === 0 ? (
                          <span className="text-status-valid inline-flex items-center gap-1 text-sm">
                            <CheckCircle2 className="size-3.5" />
                            Ready
                          </span>
                        ) : (
                          <ul className="space-y-0.5 text-sm">
                            {row.issues.map((issue, index) => (
                              <li key={index} className="text-status-expired">
                                {issue.column ? (
                                  <span className="font-medium">
                                    {columnHeader(issue.column)}:{" "}
                                  </span>
                                ) : null}
                                {issue.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
