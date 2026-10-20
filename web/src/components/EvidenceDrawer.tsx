import type { IEvidence } from "../types/evidence.ts";

export function EvidenceDrawer({
  evidence,
  onClose,
}: {
  evidence: IEvidence | null;
  onClose: () => void;
}): React.ReactElement | null {
  if (!evidence) return null;
  const latest = evidence.evaluations[0];
  return (
    <aside className="drawer" aria-label="Case evidence">
      <button onClick={onClose}>Close</button>
      <h2>{evidence.case.title}</h2>
      <h3>Original imported values</h3>
      <pre>{JSON.stringify(evidence.case.original_values, null, 2)}</pre>
      <h3>Normalized case</h3>
      <pre>{JSON.stringify(evidence.case, null, 2)}</pre>
      <h3>Policy evaluation and date trace</h3>
      <pre>{JSON.stringify(latest, null, 2)}</pre>
      <h3>Recommendation</h3>
      <p>{latest?.recommended_next_step}</p>
      <p>{latest?.recommendation_reason}</p>
      <h3>Supervisor decisions</h3>
      <pre>{JSON.stringify(evidence.decisions, null, 2)}</pre>
      <h3>Follow-up actions</h3>
      <pre>{JSON.stringify(evidence.followUps, null, 2)}</pre>
      <h3>Source provenance</h3>
      <p>
        {evidence.case.source_platform}: {evidence.case.source_name}
      </p>
      <h3>Audit chronology</h3>
      <ol>
        {evidence.audit.map((event) => (
          <li key={event.id}>
            {event.event_time}: {event.event_type} by {event.actor_id}
          </li>
        ))}
      </ol>
    </aside>
  );
}
