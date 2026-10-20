import type { PoolClient } from "pg";

export type DecisionKind =
  | "APPROVED"
  | "REJECTED"
  | "REASSIGNED"
  | "CLARIFICATION_REQUESTED";

export interface DecisionInput {
  evaluationId: string;
  decision: DecisionKind;
  reason?: string;
  actorId: string;
  ownerDepartmentId?: string;
  ownerEmployeeId?: string | null;
}

function requireReason(input: DecisionInput): string | null {
  const reason = input.reason?.trim() || null;
  if (input.decision !== "APPROVED" && !reason) {
    throw new Error(`${input.decision} requires a reason`);
  }
  return reason;
}

async function applyOperationalOutcome(
  client: PoolClient,
  evaluation: any,
  input: DecisionInput,
  decidedAt: string,
) {
  // Rejection closes the review without authorizing a follow-up action.
  if (input.decision === "REJECTED") return null;
  const departmentId =
    input.ownerDepartmentId ?? evaluation.recommended_department_id;
  if (!departmentId) throw new Error("A responsible department is required");
  const employeeId =
    input.ownerEmployeeId ?? evaluation.suggested_employee_id ?? null;
  const actionText =
    input.decision === "CLARIFICATION_REQUESTED"
      ? `Clarify case facts: ${input.reason}`
      : evaluation.recommended_next_step;
  const dueDate =
    evaluation.next_follow_up_deadline ?? evaluation.calculated_deadline;
  if (!dueDate) throw new Error("A follow-up due date is required");
  const inserted = await client.query(
    `INSERT INTO follow_up_actions(case_id,evaluation_id,action_text,owner_department_id,owner_employee_id,due_date,status,created_at) VALUES($1,$2,$3,$4,$5,$6,'OPEN',$7) RETURNING id`,
    [
      evaluation.case_id,
      evaluation.id,
      actionText,
      departmentId,
      employeeId,
      dueDate,
      decidedAt,
    ],
  );
  await client.query(
    "UPDATE cases SET department_id=$1,employee_id=$2 WHERE id=$3",
    [departmentId, employeeId, evaluation.case_id],
  );
  return String(inserted.rows[0].id);
}

export async function recordDecision(client: PoolClient, input: DecisionInput) {
  const reason = requireReason(input);
  const decidedAt = new Date().toISOString();
  const result = await client.query(
    `SELECT e.*,pc.id AS policy_id FROM evaluations e JOIN policy_configs pc ON pc.id=e.policy_id WHERE e.id=$1 FOR UPDATE`,
    [input.evaluationId],
  );
  const evaluation = result.rows[0];

  if (!evaluation) throw new Error("Evaluation not found");

  const inserted = await client.query(
    `INSERT INTO review_decisions(evaluation_id,decision,reason,decided_by,decided_at,owner_department_id,owner_employee_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      input.evaluationId,
      input.decision,
      reason,
      input.actorId,
      decidedAt,
      input.ownerDepartmentId ?? evaluation.recommended_department_id,
      input.ownerEmployeeId ?? evaluation.suggested_employee_id,
    ],
  );

  const followUpActionId = await applyOperationalOutcome(
    client,
    evaluation,
    input,
    decidedAt,
  );

  await client.query(
    `INSERT INTO audit_events(entity_type,entity_id,event_type,actor_id,event_time,before_values,after_values,metadata) VALUES('case',$1,'SUPERVISOR_DECISION_RECORDED',$2,$3,$4,$5,$6)`,
    [
      String(evaluation.case_id),
      input.actorId,
      decidedAt,
      {
        evaluationId: input.evaluationId,
        recommendation: evaluation.recommendation_outcome,
      },
      {
        decisionId: String(inserted.rows[0].id),
        decision: input.decision,
        reason,
        followUpActionId,
      },
      { policyVersion: evaluation.policy_version, ruleId: evaluation.rule_id },
    ],
  );

  return {
    decisionId: String(inserted.rows[0].id),
    followUpActionId,
    decidedAt,
  };
}
