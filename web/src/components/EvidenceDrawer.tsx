import { useState } from "react";
import type { DecisionKind } from "./decisions.ts";
import { request } from "../api.ts";
import { badgeVariant, formatDate, formatTimestamp, humanize } from "../format.ts";
import type { IEvidence } from "../types/evidence.ts";
import { Badge } from "./ui/badge.tsx";
import { Button } from "./ui/button.tsx";
import { Label } from "./ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet.tsx";
import { Textarea } from "./ui/textarea.tsx";

const decisions: Array<{ value: DecisionKind; label: string }> = [
  { value: "APPROVED", label: "Approve" },
  { value: "REJECTED", label: "Reject" },
  { value: "REASSIGNED", label: "Reassign" },
  { value: "CLARIFICATION_REQUESTED", label: "Request clarification" },
];

export function EvidenceDrawer({
  evidence,
  actorId,
  onClose,
  onChanged,
}: {
  evidence: IEvidence | null;
  actorId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}): React.ReactElement {
  const [decision, setDecision] = useState<DecisionKind>("APPROVED");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const latest = evidence?.evaluations[0];
  const decided = latest?.id
    ? (evidence?.decisions ?? []).some((item) => String(item.evaluation_id ?? "") === String(latest.id))
    : (evidence?.decisions.length ?? 0) > 0;
  const reasonRequired = decision !== "APPROVED";

  async function evaluate() {
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

  async function submitDecision() {
    if (!latest?.id) return;
    setBusy("decide");
    setError("");
    try {
      await request(`/api/evaluations/${latest.id}/decisions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason, actorId }),
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
              <SheetTitle>{record.title}</SheetTitle>
              <SheetDescription>
                {humanize(record.source_platform)} · {record.source_name}
              </SheetDescription>
            </SheetHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <dl className="grid gap-3 text-sm">
              <Fact label="Status" value={humanize(record.normalized_status)} />
              <Fact label="Received" value={formatDate(record.received_date)} />
              <Fact label="Imported" value={`${formatTimestamp(record.imported_at)} by ${record.imported_by}`} />
            </dl>
            {record.description && <p className="text-sm">{record.description}</p>}

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Recommendation</h3>
                <Button type="button" size="sm" disabled={!actorId || busy !== ""} onClick={evaluate}>
                  {busy === "evaluate" ? "Evaluating…" : "Run policy evaluation"}
                </Button>
              </div>
              {latest ? (
                <div className="space-y-2 text-sm">
                  <Badge variant={badgeVariant(latest.recommendation_outcome)}>
                    {humanize(latest.recommendation_outcome)}
                  </Badge>
                  <p>{latest.recommended_next_step}</p>
                  <p className="text-muted-foreground">{latest.recommendation_reason}</p>
                  <p>Deadline {formatDate(latest.calculated_deadline)}</p>
                  {trace.length > 0 && (
                    <ul className="space-y-1 text-muted-foreground">
                      {trace.map((entry) => (
                        <li key={entry.date}>
                          {formatDate(entry.date)} · {humanize(entry.reason)} · {entry.counted ? "Counted" : "Skipped"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No policy evaluation yet.</p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="font-medium">Supervisor decision</h3>
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
                    disabled={!actorId || busy !== "" || (reasonRequired && reason.trim() === "")}
                    onClick={submitDecision}
                  >
                    {busy === "decide" ? "Saving…" : "Record decision"}
                  </Button>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-medium">Follow-up</h3>
              {evidence.followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No follow-up action.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {evidence.followUps.map((item, index) => (
                    <li key={`${item.due_date}-${index}`} className="space-y-1 border-t pt-3">
                      <Badge variant={badgeVariant(item.status)}>{humanize(item.status, "Open")}</Badge>
                      <p>{item.action_text ?? "Follow-up"}</p>
                      <p className="text-muted-foreground">Due {formatDate(item.due_date)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-medium">Audit</h3>
              {evidence.audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events.</p>
              ) : (
                <ol className="space-y-3 text-sm">
                  {evidence.audit.map((event) => (
                    <li key={event.id} className="border-t pt-3">
                      <p className="font-medium">{humanize(event.event_type)}</p>
                      <p className="text-muted-foreground">
                        {formatTimestamp(event.event_time)} · {event.actor_id}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Original imported values</summary>
              <dl className="mt-3 grid gap-2">
                {Object.entries(record.original_values).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[8rem_1fr] gap-2">
                    <dt className="text-muted-foreground">{humanize(key)}</dt>
                    <dd>{value == null || value === "" ? "Empty" : String(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
