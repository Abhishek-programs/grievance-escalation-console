import { useEffect, useRef } from "react";
import type { IEvidence } from "../types/evidence.ts";
import { formatDate, formatTimestamp, humanize, tone } from "../format.ts";

export function EvidenceDrawer({
  evidence,
  onClose,
}: {
  evidence: IEvidence | null;
  onClose: () => void;
}): React.ReactElement | null {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!evidence) return;
    const previous = document.activeElement;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [evidence, onClose]);
  if (!evidence) return null;
  const latest = evidence.evaluations[0];
  const record = evidence.case;
  return (
    <>
      <button className="backdrop" type="button" aria-label="Close evidence" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Case evidence">
        <div className="drawer-head">
          <h2>{record.title}</h2>
          <button ref={closeRef} type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="source">
          {humanize(record.source_platform)} · {record.source_name}
        </p>
        <dl className="facts">
          <div>
            <dt>Status</dt>
            <dd>{humanize(record.normalized_status)}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{formatDate(record.received_date)}</dd>
          </div>
          <div>
            <dt>Imported</dt>
            <dd>
              {formatTimestamp(record.imported_at)} by {record.imported_by}
            </dd>
          </div>
        </dl>
        {record.description && <p>{record.description}</p>}

        <h3>Recommendation</h3>
        {latest ? (
          <>
            <p>
              <span className={tone(latest.recommendation_outcome)}>
                {humanize(latest.recommendation_outcome)}
              </span>
            </p>
            <p>{latest.recommended_next_step}</p>
            <p className="muted">{latest.recommendation_reason}</p>
            <p>Deadline {formatDate(latest.calculated_deadline)}</p>
          </>
        ) : (
          <p className="empty">No policy evaluation yet.</p>
        )}

        <h3>Supervisor decisions</h3>
        {evidence.decisions.length === 0 ? (
          <p className="empty">No decision recorded.</p>
        ) : (
          <ul className="stack">
            {evidence.decisions.map((item, index) => (
              <li key={`${item.decided_at ?? "decision"}-${index}`}>
                <span className={tone(item.decision)}>{humanize(item.decision)}</span>
                {item.reason && <p>{item.reason}</p>}
                <p className="muted">
                  {item.decided_by ?? "Unknown"} · {formatTimestamp(item.decided_at)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <h3>Follow-up</h3>
        {evidence.followUps.length === 0 ? (
          <p className="empty">No follow-up action.</p>
        ) : (
          <ul className="stack">
            {evidence.followUps.map((item, index) => (
              <li key={`${item.due_date}-${index}`}>
                <span className={tone(item.status)}>{humanize(item.status, "Open")}</span>
                <p>{item.action_text ?? "Follow-up"}</p>
                <p className="muted">Due {formatDate(item.due_date)}</p>
              </li>
            ))}
          </ul>
        )}

        <h3>Audit</h3>
        {evidence.audit.length === 0 ? (
          <p className="empty">No audit events.</p>
        ) : (
          <ol className="audit">
            {evidence.audit.map((event) => (
              <li key={event.id}>
                <strong>{humanize(event.event_type)}</strong>
                <span>
                  {formatTimestamp(event.event_time)} · {event.actor_id}
                </span>
              </li>
            ))}
          </ol>
        )}

        <details>
          <summary>Original imported values</summary>
          <dl className="facts">
            {Object.entries(record.original_values).map(([key, value]) => (
              <div key={key}>
                <dt>{humanize(key)}</dt>
                <dd>{value == null || value === "" ? "Empty" : String(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      </aside>
    </>
  );
}
