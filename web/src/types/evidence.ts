export interface IEvidence {
  evaluations: IEvidenceEvaluation[];
  decisions: IEvidenceDecision[];
  followUps: IEvidenceFollowUp[];
  audit: IEvidenceAudit[];
  case: IEvidenceCase;
}

export interface IEvidenceEvaluation {
  policy_version?: string;
  recommendation_outcome?: string;
  recommended_next_step: string;
  recommendation_reason: string;
  calculated_deadline?: string | null;
}

export interface IEvidenceDecision {
  decision: string;
  reason?: string | null;
  decided_by?: string;
  decided_at?: string;
}

export interface IEvidenceFollowUp {
  action_text?: string;
  due_date: string;
  status?: string;
}

export interface IEvidenceAudit {
  id: string;
  event_time: string;
  event_type: string;
  actor_id: string;
}

export interface IEvidenceCase {
  title: string;
  description?: string | null;
  received_date?: string | null;
  normalized_status?: string;
  original_values: Record<string, unknown>;
  source_platform: string;
  source_name: string;
  source_url?: string | null;
  imported_at: string;
  imported_by: string;
}
