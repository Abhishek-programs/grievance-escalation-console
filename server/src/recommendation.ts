import type { PoolClient } from "pg";
import { calculateDeadline, isOverdue, type PolicySnapshot } from "./policy.ts";

export interface CaseFacts {
  caseId: string;
  title: string;
  description: string | null;
  receivedDate: string | null;
  normalizedStatus: string;
  asOfDate: string;
}
export interface DirectoryCandidate {
  departmentId: string;
  departmentCode: string;
  employeeId: string | null;
}
export interface Recommendation {
  ruleId: string;
  outcome: "ESCALATE" | "MONITOR" | "NEEDS_CLARIFICATION";
  nextStep: string;
  reason: string;
  departmentId: string | null;
  suggestedEmployeeId: string | null;
  calculatedDeadline: string | null;
  deadlineCalculation: ReturnType<typeof calculateDeadline>;
  nextFollowUpDeadline: string | null;
  inputFacts: CaseFacts & { policy: PolicySnapshot };
}

export function departmentCodeFor(facts: {
  title: string;
  description: string | null;
}): string | null {
  // Recommend a team from explicit, reviewable keyword rules.
  const text = `${facts.title} ${facts.description ?? ""}`.toLowerCase();
  if (text.includes("water")) return "WATER";
  if (text.includes("road") || text.includes("transport")) return "ROADS";
  if (text.includes("clinic") || text.includes("health")) return "HEALTH";
  if (text.includes("certificate") || text.includes("administration"))
    return "ADMIN";
  return null;
}

export async function findDirectory(
  client: PoolClient,
  title: string,
  description: string | null,
): Promise<DirectoryCandidate | null> {
  const code = departmentCodeFor({ title, description });
  if (!code) return null;
  const directory = await client.query(
    `SELECT d.id AS department_id,e.id AS employee_id FROM departments d LEFT JOIN LATERAL (SELECT id FROM employees WHERE department_id=d.id AND active ORDER BY escalation_level,id LIMIT 1) e ON TRUE WHERE d.code=$1`,
    [code],
  );
  if (!directory.rows[0]) return null;
  return {
    departmentId: String(directory.rows[0].department_id),
    departmentCode: code,
    employeeId: directory.rows[0].employee_id
      ? String(directory.rows[0].employee_id)
      : null,
  };
}

function clarification(
  facts: CaseFacts,
  policy: PolicySnapshot,
  reason: string,
  candidate: DirectoryCandidate | null,
): Recommendation {
  return {
    ruleId: "RULE-CLARIFICATION-REQUIRED",
    outcome: "NEEDS_CLARIFICATION",
    nextStep:
      "Confirm the missing or ambiguous case facts before escalation review.",
    reason,
    departmentId: candidate?.departmentId ?? null,
    suggestedEmployeeId: candidate?.employeeId ?? null,
    calculatedDeadline: null,
    deadlineCalculation: calculateDeadline(facts.receivedDate, policy),
    nextFollowUpDeadline: null,
    inputFacts: { ...facts, policy },
  };
}

export function recommend(
  facts: CaseFacts,
  policy: PolicySnapshot,
  candidate: DirectoryCandidate | null,
): Recommendation {
  const deadline = calculateDeadline(facts.receivedDate, policy);
  if (deadline.outcome === "NEEDS_CLARIFICATION")
    return clarification(
      facts,
      policy,
      "The received date is missing or unsupported.",
      candidate,
    );
  if (facts.normalizedStatus === "NEEDS_CLARIFICATION")
    return clarification(facts, policy, "The source status is ambiguous.", candidate);
  if (!candidate)
    return clarification(
      facts,
      policy,
      "The responsible department is uncertain.",
      null,
    );
  const overdue =
    facts.normalizedStatus !== "RESOLVED" &&
    isOverdue(facts.asOfDate, deadline.deadline!, policy);
  return {
    ruleId: overdue ? "RULE-DEADLINE-OVERDUE" : "RULE-DEADLINE-MONITOR",
    outcome: overdue ? "ESCALATE" : "MONITOR",
    nextStep: overdue
      ? "Open a supervisor review and contact the responsible department."
      : "Keep the case open and review it on the follow-up date.",
    reason: overdue
      ? `The case remains open after its ${deadline.deadline} deadline.`
      : `The case remains within its ${deadline.deadline} deadline.`,
    departmentId: candidate.departmentId,
    suggestedEmployeeId: candidate.employeeId,
    calculatedDeadline: deadline.deadline,
    deadlineCalculation: deadline,
    nextFollowUpDeadline: deadline.deadline,
    inputFacts: { ...facts, policy },
  };
}

