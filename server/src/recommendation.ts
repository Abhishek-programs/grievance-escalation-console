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

export function departmentCodeFor(facts: CaseFacts): string | null {
  // Recommend a team from explicit, reviewable keyword rules.
  const text = `${facts.title} ${facts.description ?? ""}`.toLowerCase();
  if (text.includes("water")) return "WATER";
  if (text.includes("road") || text.includes("transport")) return "ROADS";
  if (text.includes("clinic") || text.includes("health")) return "HEALTH";
  if (text.includes("certificate") || text.includes("administration"))
    return "ADMIN";
  return null;
}

function clarification(
  facts: CaseFacts,
  policy: PolicySnapshot,
  reason: string,
): Recommendation {
  return {
    ruleId: "RULE-CLARIFICATION-REQUIRED",
    outcome: "NEEDS_CLARIFICATION",
    nextStep:
      "Confirm the missing or ambiguous case facts before escalation review.",
    reason,
    departmentId: null,
    suggestedEmployeeId: null,
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
    );
  if (facts.normalizedStatus === "NEEDS_CLARIFICATION")
    return clarification(facts, policy, "The source status is ambiguous.");
  if (!candidate)
    return clarification(
      facts,
      policy,
      "The responsible department is uncertain.",
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

