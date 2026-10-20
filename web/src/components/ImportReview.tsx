import { useEffect, useMemo, useRef, useState } from "react";
import { request } from "../api.ts";
import { guestCommit, guestPreview } from "../guest-desk.ts";
import { badgeVariant, formatDate, humanize } from "../format.ts";
import {
  blockedOutcomes,
  importRows,
  messages,
  type CommitResult,
  type ImportPreview,
} from "../types/import.ts";
import { Alert } from "./ui/alert.tsx";
import { Badge } from "./ui/badge.tsx";
import { Button, buttonVariants } from "./ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.tsx";
import { Checkbox } from "./ui/checkbox.tsx";
import { Label } from "./ui/label.tsx";
import { VerifyEmail } from "./VerifyEmail.tsx";

const sources = [
  {
    name: "WhatsApp",
    columns: "Who sent it, where they are, what happened, and what they asked for",
  },
  {
    name: "Website",
    columns: "Name, mobile, ward, the account, and the relief they want",
  },
  {
    name: "Facebook",
    columns: "Author, contact, place, the post, and the ask",
  },
  {
    name: "Spreadsheet",
    columns: "Complainant, phone, tole, the account, and the relief",
  },
];

export function ImportReview({
  email,
  browser,
  onSignedIn,
  onCommitted,
}: {
  email: string | null;
  browser: boolean;
  onSignedIn: (email: string) => void;
  onCommitted: () => void;
}): React.ReactElement {
  const [open, setOpen] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<CommitResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => (preview ? importRows(preview) : []), [preview]);
  const canWrite = Boolean(email) || browser;

  useEffect(() => {
    if (!email) return;
    setPreview(null);
    setNotice(null);
    setSelected(new Set());
  }, [email]);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function stage() {
    if (!file) return;
    setBusy("preview");
    setError("");
    setNotice(null);
    try {
      if (browser) {
        const result = guestPreview(file.name, await file.text());
        setPreview(result);
        const alreadyDone = new Set(result.committedRowIds ?? []);
        setDoneIds(alreadyDone);
        setSelected(
          new Set(
            importRows(result)
              .filter((row) => row.outcome === "VALID" && !alreadyDone.has(String(row.id)))
              .map((row) => String(row.id)),
          ),
        );
        return;
      }
      const result = await request<ImportPreview>("/api/imports/preview", {
        method: "POST",
        headers: {
          "content-type": "text/csv",
          "x-source-name": file.name,
        },
        body: await file.text(),
      });
      setPreview(result);
      const alreadyDone = new Set(result.committedRowIds ?? []);
      setDoneIds(alreadyDone);
      setSelected(
        new Set(
          importRows(result)
            .filter((row) => row.outcome === "VALID" && !alreadyDone.has(String(row.id)))
            .map((row) => String(row.id)),
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preview failed");
    } finally {
      setBusy("");
    }
  }

  async function commit() {
    if (!preview?.batchId) return;
    const chosen = rows.filter((row) => selected.has(String(row.id)));
    setBusy("commit");
    setError("");
    try {
      const chosenIds = chosen.map((row) => String(row.id));
      const confirmed = chosen.filter((row) => row.outcome !== "VALID").map((row) => String(row.id));
      if (browser) {
        const result = guestCommit(preview.batchId, chosenIds, confirmed);
        setNotice(result);
        setDoneIds((current) => new Set([...current, ...result.committedRowIds]));
        setSelected((current) => {
          const next = new Set(current);
          for (const rowId of result.committedRowIds) next.delete(rowId);
          return next;
        });
        if (result.committedCaseIds.length > 0) onCommitted();
        resultRef.current?.scrollIntoView({ block: "nearest" });
        return;
      }
      const result = await request<CommitResult>(`/api/imports/${preview.batchId}/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rowIds: chosenIds,
          confirmedRowIds: confirmed,
        }),
      });
      setNotice(result);
      setDoneIds((current) => new Set([...current, ...result.committedRowIds]));
      setSelected((current) => {
        const next = new Set(current);
        for (const rowId of result.committedRowIds) next.delete(rowId);
        return next;
      });
      if (result.committedCaseIds.length > 0) onCommitted();
      resultRef.current?.scrollIntoView({ block: "nearest" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Commit failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>
            <CardTitle className="font-display">Import complaints</CardTitle>
            <CardDescription>
              {browser
                ? "Preview a file and commit it in this browser. The columns tell the desk which source it came from."
                : "Preview a file and commit it. The columns tell the desk which source it came from."}
            </CardDescription>
          </span>
          <span className="text-sm text-primary">{open ? "Hide" : "Show"}</span>
        </button>
      </CardHeader>
      {open && <CardContent className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-medium">You can import from these sources</h3>
            <a
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href="/api/samples/complaint-samples.zip"
              download
            >
              Download samples
            </a>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {sources.map((source) => (
              <li key={source.name} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{source.name}</p>
                <p className="text-muted-foreground">{source.columns}</p>
              </li>
            ))}
          </ul>
        </section>
        {!email && <VerifyEmail onVerified={onSignedIn} />}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <input
              id="csv-file"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="button" disabled={!file || !canWrite || busy !== ""} onClick={stage}>
            {busy === "preview" ? "Staging…" : "Preview"}
          </Button>
        </div>

        {preview?.repeatedBatchId && (
          <Alert className="border-border bg-muted text-foreground">
            This file is already staged. Committed rows stay marked, and the remaining rows can still be committed.
          </Alert>
        )}

        {preview?.batchId && (
          <>
            <div className="flex flex-wrap gap-2">
              {preview.sourcePlatform && <Badge>Read as {humanize(preview.sourcePlatform)}</Badge>}
              {Object.entries(preview.counts).map(([key, count]) => (
                <Badge key={key} variant="secondary">
                  {humanize(key)} {count}
                </Badge>
              ))}
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="p-3" />
                    <th className="p-3">Row</th>
                    <th className="p-3">Complaint</th>
                    <th className="p-3">Outcome</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const id = String(row.id);
                    const done = doneIds.has(id);
                    const skipped = notice?.skipped.find((item) => item.rowId === id);
                    const blocked = blockedOutcomes.has(row.outcome);
                    const notes = done
                      ? ["Committed."]
                      : skipped
                        ? [skipped.reason]
                        : [...messages(row.errors), ...messages(row.warnings)];
                    return (
                      <tr key={id} className={done ? "border-t bg-muted/40" : "border-t"}>
                        <td className="p-3">
                          <Checkbox
                            checked={selected.has(id)}
                            disabled={blocked || done}
                            aria-label={`Select row ${row.row_number}`}
                            onCheckedChange={(checked) => toggle(id, checked === true)}
                          />
                        </td>
                        <td className="p-3">{row.row_number}</td>
                        <td className="p-3">
                          <p className="font-medium">{row.proposed_values.title || "Untitled"}</p>
                          <p className="text-muted-foreground">
                            {[
                              row.proposed_values.complainantName,
                              row.proposed_values.place,
                              row.proposed_values.district,
                              formatDate(row.proposed_values.receivedDate, ""),
                            ]
                              .filter(Boolean)
                              .join(" · ") || "No complainant recorded"}
                          </p>
                        </td>
                        <td className="p-3">
                          <Badge variant={done ? "default" : badgeVariant(row.outcome)}>
                            {done ? "Committed" : humanize(row.outcome)}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {notes.join(" ") || (blocked ? "This row cannot be committed." : "Ready to commit.")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div ref={resultRef} className="sticky bottom-4 z-10 space-y-3 rounded-lg border bg-card p-4 shadow-md">
              {notice && (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">
                    {notice.committedCaseIds.length === 0
                      ? "No rows were committed."
                      : `Committed ${notice.committedCaseIds.length} ${notice.committedCaseIds.length === 1 ? "case" : "cases"}.`}
                    {notice.skipped.length > 0 &&
                      ` ${notice.skipped.length} ${notice.skipped.length === 1 ? "row was" : "rows were"} not committed.`}
                  </p>
                  {notice.skipped.length > 0 && (
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {notice.skipped.map((item) => (
                        <li key={item.rowId}>
                          Row {item.rowNumber}: {item.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <Button type="button" disabled={selected.size === 0 || !canWrite || busy !== ""} onClick={commit}>
                {busy === "commit" ? "Committing…" : `Commit ${selected.size} selected`}
              </Button>
            </div>
          </>
        )}
      </CardContent>}
    </Card>
  );
}
