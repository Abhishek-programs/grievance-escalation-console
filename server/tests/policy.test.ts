import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDeadline,
  isOverdue,
  type PolicySnapshot,
} from "../src/policy.ts";

// Mirror the stored Nepal demonstration policy.
const policy: PolicySnapshot = {
  policyVersion: "NP-GRIEVANCE-2026-V1",
  timezone: "Asia/Kathmandu",
  workingIsoDays: [7, 1, 2, 3, 4, 5],
  holidays: [
    {
      date: "2026-10-20",
      name: "Dashain holiday",
      sourceUrl:
        "https://moha.gov.np/en/page/government-and-public-holidays-in-2083",
    },
    {
      date: "2026-10-21",
      name: "Dashain holiday",
      sourceUrl:
        "https://moha.gov.np/en/page/government-and-public-holidays-in-2083",
    },
  ],
  allowedWorkingDays: 1,
  deadlineInclusivity: "DUE_THROUGH_END_OF_DAY",
  missingDateBehavior: "NEEDS_CLARIFICATION",
};

test("Friday plus one working day lands on Sunday", () => {
  const result = calculateDeadline("2026-10-16", policy);
  assert.equal(result.deadline, "2026-10-18");
  assert.deepEqual(
    result.trace.map((entry) => entry.reason),
    ["WEEKLY_HOLIDAY", "WORKING_DAY"],
  );
});
test("selected Dashain holidays move the deadline", () => {
  const result = calculateDeadline("2026-10-19", policy);
  assert.equal(result.deadline, "2026-10-22");
  assert.deepEqual(
    result.trace.map((entry) => entry.reason),
    ["PUBLIC_HOLIDAY", "PUBLIC_HOLIDAY", "WORKING_DAY"],
  );
});
test("inclusive due date becomes overdue the next day", () => {
  assert.equal(isOverdue("2026-10-18", "2026-10-18", policy), false);
  assert.equal(isOverdue("2026-10-19", "2026-10-18", policy), true);
});
test("missing date requests clarification", () => {
  assert.equal(calculateDeadline(null, policy).outcome, "NEEDS_CLARIFICATION");
});
