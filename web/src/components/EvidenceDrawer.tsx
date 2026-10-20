import { useState } from "react";
import type { DecisionKind } from "./decisions.ts";
import { request } from "../api.ts";
import { badgeVariant, formatDate, formatTimestamp, humanize, policyTiming } from "../format.ts";
import type { IEvidence } from "../types/evidence.ts";
import { Badge } from "./ui/badge.tsx";
import { Button } from "./ui/button.tsx";
import { Label } from "./ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet.tsx";
import { Textarea } from "./ui/textarea.tsx";
import { VerifyEmail } from "./VerifyEmail.tsx";

const decisions: Array<{ value: DecisionKind; label: string }> = [
  { value: "APPROVED", label: "Approve" },
  { value: "REJECTED", label: "Reject" },
  { value: "REASSIGNED", label: "Reassign" },
  { value: "CLARIFICATION_REQUESTED", label: "Request clarification" },
];

export function EvidenceDrawer({
  evidence,
  email,
  onSignedIn,
  onClose,
  onChanged,
}: {
  evidence: IEvidence | null;
  email: string | null;
  onSignedIn: (email: string) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}): React.ReactElement {
  const [decision, setDecision] = useState<DecisionKind>("APPROVED");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"" | "evaluate" | "decide">("");
  const latest = evidence?.evaluations[0];
  const decided = latest?.id
    ? (evidence?.decisions ?? []).some((item) => String(item.evaluation_id ?? "") === String(latest.id))
    : (evidence?.decisions.length ?? 0) > 0;
  const reasonRequired = decision !== "APPROVED";

  async function evaluate() {
    if (!evidence) return;
    if (!email) {
      setPending("evaluate");
      setError("");
      return;
    }
    setBusy("evaluate");
    setError("");
    try {
      await request(`/api/cases/${evidence.case.id}/evaluations`, { method: "POST" });
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation failed");
    } finally {
      setBusy("");
    }
  }

  async function submitDecision() {
    if (!latest?.id) return;
    if (!email) {
      setPending("decide");
      setError("");
      return;
    }
    setBusy("decide");
    setError("");
    try {
      await request(`/api/evaluations/${latest.id}/decisions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      setReason("");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision failed");
    } finally {
      setBusy("");
    }
  }

  function signedIn(next: string) {
    const action = pending;
    setPending("");
    onSignedIn(next);
    if (action === "evaluate") void evaluateAfterSignIn();
    if (action === "decide") void submitAfterSignIn();
  }

  async function evaluateAfterSignIn() {
    if (!evidence) return;
    setBusy("evaluate");
    setError("");
    try {
      await request(`/api/cases/${evidence.case.id}/evaluations`, { method: "POST" });
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation failed");
    } finally {
      setBusy("");
    }
  }

  async function submitAfterSignIn() {
    if (!latest?.id) return;
    setBusy("decide");
    setError("");
    try {
      await request(`/api/evaluations/${latest.id}/decisions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      setReason("");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision failed");
    } finally {
      setBusy("");
    }
  }

  const record = evidence?.case;
  const trace = latest?.deadline_calculation?.trace ?? [];
  return (
    <Sheet open={evidence !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent>
        {record && (
          <>
            <SheetHeader>
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {[record.category, humanize(record.source_platform)].filter(Boolean).join(" · ")}
              </p>
              <SheetTitle>{record.title}</SheetTitle>
              <SheetDescription>
                {[
                  record.complainant_name,
                  record.phone,
                  [record.place, record.ward ? `Ward ${record.ward}` : "", record.local_level, record.district]
                    .filter(Boolean)
                    .join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ") || humanize(record.source_platform)}
              </SheetDescription>
            </SheetHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <section className="space-y-3">
              <h3 className="text-base">What happened</h3>
              <p className="max-w-[65ch] text-sm leading-[1.8]">
                {record.description || "The complaint has no account of what happened."}
              </p>
            </section>
            <section className="space-y-3 border-t border-border pt-6">
              <h3 className="text-base">What they asked for</h3>
              <p className="max-w-[65ch] text-sm leading-[1.8]">
                {record.relief_sought || "No requested action was recorded."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Received {formatDate(record.received_date, "date not recorded")} · {humanize(record.normalized_status)}
              </p>
            </section>

            <section className="space-y-3 border-t border-border pt-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base">Deadline</h3>
                <Button type="button" variant="outline" size="sm" disabled={busy !== ""} onClick={evaluate}>
                  {busy === "evaluate" ? "Checking…" : "Check again"}
                </Button>
              </div>
              {pending === "evaluate" && !email && <VerifyEmail onVerified={signedIn} />}
              {latest ? (
                <div className="space-y-2 text-sm">
                  <p>
                    <Badge variant={badgeVariant(latest.recommendation_outcome)}>
                      {humanize(latest.recommendation_outcome)}
                    </Badge>
                  </p>
                  <p>{policyTiming(latest.calculated_deadline, latest.recommendation_outcome)}</p>
                  <p className="text-muted-foreground">{latest.recommended_next_step}</p>
                  {trace.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">How the days were counted</summary>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        {trace.map((entry) => (
                          <li key={entry.date}>
                            {formatDate(entry.date)} · {humanize(entry.reason)} · {entry.counted ? "Counted" : "Skipped"}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No deadline check yet.</p>
              )}
            </section>

            <section className="space-y-3 border-t border-border pt-6">
              <h3 className="text-base">Supervisor decision</h3>
              {evidence.decisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No decision recorded.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {evidence.decisions.map((item, index) => (
                    <li key={`${item.decided_at ?? "decision"}-${index}`} className="space-y-1 border-t pt-3">
                      <Badge variant={badgeVariant(item.decision)}>{humanize(item.decision)}</Badge>
                      {item.reason && <p>{item.reason}</p>}
                      <p className="text-muted-foreground">
                        {item.decided_by ?? "Unknown"} · {formatTimestamp(item.decided_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {pending === "decide" && !email && <VerifyEmail onVerified={signedIn} />}
              {latest?.id && !decided && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-2">
                    <Label>Decision</Label>
                    <Select value={decision} onValueChange={(value) => setDecision(value as DecisionKind)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {decisions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="decision-reason">Reason {reasonRequired ? "" : "(optional for approval)"}</Label>
                    <Textarea id="decision-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
                  </div>
                  <Button
                    type="button"
                    disabled={busy !== "" || (reasonRequired && reason.trim() === "")}
                    onClick={submitDecision}
                  >
                    {busy === "decide" ? "Saving…" : "Record decision"}
                  </Button>
                </div>
              )}
            </section>

            {evidence.followUps.length > 0 && (
              <section className="space-y-3 border-t border-border pt-6">
                <h3 className="text-base">Follow-up</h3>
                <ul className="space-y-3 text-sm">
                  {evidence.followUps.map((item, index) => (
                    <li key={`${item.due_date}-${index}`} className="space-y-1">
                      <Badge variant={badgeVariant(item.status)}>{humanize(item.status, "Open")}</Badge>
                      <p>{item.action_text ?? "Follow-up"}</p>
                      <p className="text-muted-foreground">Due {formatDate(item.due_date)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <details className="border-t border-border pt-6 text-sm">
              <summary className="cursor-pointer text-muted-foreground">File and audit</summary>
              <ol className="mt-4 space-y-3">
                {evidence.audit.map((event) => (
                  <li key={event.id}>
                    <p>{humanize(event.event_type)}</p>
                    <p className="text-muted-foreground">
                      {formatTimestamp(event.event_time)} · {event.actor_id}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[11px] text-muted-foreground">
                Imported {formatTimestamp(record.imported_at)} by {record.imported_by}
                {record.source_name ? ` · ${record.source_name}` : ""}
              </p>
            </details>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
