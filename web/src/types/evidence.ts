export interface IEvidence {
  evaluations: IEvidenceEvaluation[];
  decisions: IEvidenceDecision[];
  followUps: IEvidenceFollowUp[];
  audit: IEvidenceAudit[];
  case: IEvidenceCase;
}

export interface IEvidenceEvaluation {
  recommended_next_step: string;
  recommendation_reason: string;
}

export interface IEvidenceDecision {
  decision: string;
}

export interface IEvidenceFollowUp {
  action: string;
  due_date: string;
}

export interface IEvidenceAudit {
  id: string;
  event_time: string;
  event_type: string;
  actor_id: string;
}

export interface IEvidenceCase {
  title: string;
  original_values: Record<string, unknown>;
  normalized_values: Record<string, unknown>;
  source_platform: string;
  source_name: string;
  imported_at: string;
  imported_by: string;
}
