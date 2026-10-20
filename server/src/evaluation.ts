import type { PoolClient } from "pg";
import type { PolicySnapshot } from "./policy.ts";
import { findDirectory, recommend } from "./recommendation.ts";

function kathmanduToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
  }).format(new Date());
}

async function loadPolicy(client: PoolClient): Promise<PolicySnapshot> {
  const result = await client.query(
    `SELECT p.*,COALESCE(json_agg(json_build_object('date',h.holiday_date::text,'name',h.name,'sourceUrl',h.source_url)) FILTER (WHERE h.id IS NOT NULL),'[]') AS holidays FROM policy_configs p LEFT JOIN calendar_holidays h ON h.policy_id=p.id GROUP BY p.id ORDER BY p.effective_from DESC LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) throw new Error("No policy configuration found");
  return {
    policyVersion: row.policy_version,
    timezone: row.timezone,
    workingIsoDays: row.working_iso_days,
    holidays: row.holidays,
    allowedWorkingDays: row.allowed_working_days,
    deadlineInclusivity: row.deadline_inclusivity,
    missingDateBehavior: row.missing_date_behavior,
  };
}

async function insertEvaluation(client: PoolClient, result: ReturnType<typeof recommend>): Promise<string> {
  const evaluatedAt = new Date().toISOString();
  const policyRow = await client.query(
    "SELECT id FROM policy_configs WHERE policy_version=$1",
    [result.inputFacts.policy.policyVersion],
  );
  const inserted = await client.query(
    `INSERT INTO evaluations(case_id,policy_id,policy_version,evaluated_at,rule_id,input_facts,deadline_calculation,calculated_deadline,recommendation_outcome,recommended_next_step,recommendation_reason,recommended_department_id,suggested_employee_id,next_follow_up_deadline) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [
      result.inputFacts.caseId,
      policyRow.rows[0].id,
      result.inputFacts.policy.policyVersion,
      evaluatedAt,
      result.ruleId,
      result.inputFacts,
      result.deadlineCalculation,
      result.calculatedDeadline,
      result.outcome,
      result.nextStep,
      result.reason,
      result.departmentId,
      result.suggestedEmployeeId,
      result.nextFollowUpDeadline,
    ],
  );
  const evaluationId = String(inserted.rows[0].id);
  await client.query(
    `INSERT INTO audit_events(entity_type,entity_id,event_type,actor_id,event_time,before_values,after_values,metadata) VALUES('case',$1,'POLICY_EVALUATED','policy-engine',$2,NULL,$3,$4)`,
    [
      result.inputFacts.caseId,
      evaluatedAt,
      { evaluationId, recommendation: result.outcome },
      {
        ruleId: result.ruleId,
        policyVersion: result.inputFacts.policy.policyVersion,
      },
    ],
  );
  return evaluationId;
}

export async function applyPolicyCheck(client: PoolClient, caseId: string): Promise<string> {
  const caseResult = await client.query(
    "SELECT id,title,description,category,received_date::text,normalized_status FROM cases WHERE id=$1",
    [caseId],
  );
  const row = caseResult.rows[0];
  if (!row) throw new Error("Case not found");
  const policy = await loadPolicy(client);
  const candidate = await findDirectory(client, row.title, row.description, row.category);
  const result = recommend(
    {
      caseId: String(row.id),
      title: row.title,
      description: row.description,
      receivedDate: row.received_date,
      normalizedStatus: row.normalized_status,
      asOfDate: kathmanduToday(),
    },
    policy,
    candidate,
  );
  const evaluationId = await insertEvaluation(client, result);
  await client.query(
    "UPDATE cases SET department_id=COALESCE(department_id,$1), employee_id=COALESCE(employee_id,$2) WHERE id=$3",
    [result.departmentId, result.suggestedEmployeeId, caseId],
  );
  return evaluationId;
}
