export interface PolicySnapshot {
  policyVersion: string;
  timezone: "Asia/Kathmandu";
  workingIsoDays: number[];
  holidays: Array<{ date: string; name: string; sourceUrl: string }>;
  allowedWorkingDays: number;
  deadlineInclusivity: "DUE_THROUGH_END_OF_DAY" | "OVERDUE_ON_DUE_DATE";
  missingDateBehavior: "NEEDS_CLARIFICATION";
}
export interface DeadlineTraceEntry {
  date: string;
  counted: boolean;
  reason: "WORKING_DAY" | "WEEKLY_HOLIDAY" | "PUBLIC_HOLIDAY";
  runningCount: number;
}
export interface DeadlineResult {
  outcome: "CALCULATED" | "NEEDS_CLARIFICATION";
  deadline: string | null;
  trace: DeadlineTraceEntry[];
}

function parseDateOnly(value: string): Date | null {
  // Parse complete Gregorian dates without local-machine timezone shifts.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}
const formatDate = (date: Date) => date.toISOString().slice(0, 10);
function nextDate(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
function isoWeekday(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}
function classification(date: Date, policy: PolicySnapshot) {
  const value = formatDate(date);
  if (policy.holidays.some((holiday) => holiday.date === value))
    return { counted: false, reason: "PUBLIC_HOLIDAY" as const };
  if (!policy.workingIsoDays.includes(isoWeekday(date)))
    return { counted: false, reason: "WEEKLY_HOLIDAY" as const };
  return { counted: true, reason: "WORKING_DAY" as const };
}

export function calculateDeadline(
  receivedDate: string | null,
  policy: PolicySnapshot,
): DeadlineResult {
  // Missing or malformed dates require clarification.
  if (!receivedDate)
    return { outcome: "NEEDS_CLARIFICATION", deadline: null, trace: [] };
  const start = parseDateOnly(receivedDate);
  if (!start)
    return { outcome: "NEEDS_CLARIFICATION", deadline: null, trace: [] };
  const trace: DeadlineTraceEntry[] = [];
  let cursor = start;
  let runningCount = 0;
  while (runningCount < policy.allowedWorkingDays) {
    cursor = nextDate(cursor);
    const current = classification(cursor, policy);
    if (current.counted) runningCount += 1;
    trace.push({
      date: formatDate(cursor),
      counted: current.counted,
      reason: current.reason,
      runningCount,
    });
  }
  return { outcome: "CALCULATED", deadline: formatDate(cursor), trace };
}
export function isOverdue(
  asOfDate: string,
  deadline: string,
  policy: PolicySnapshot,
): boolean {
  return policy.deadlineInclusivity === "DUE_THROUGH_END_OF_DAY"
    ? asOfDate > deadline
    : asOfDate >= deadline;
}
