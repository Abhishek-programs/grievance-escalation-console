export function humanize(value: string | null | undefined, empty = "None"): string {
  if (!value) return empty;
  const text = value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kathmandu",
});

export function formatDate(value: string | null | undefined, empty = "None"): string {
  if (!value) return empty;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return dateFormat.format(new Date(Date.UTC(year, month - 1, day, 6)));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function policyTiming(
  deadline: string | null | undefined,
  outcome: string | null | undefined,
): string {
  if (!outcome) return "Not checked";
  if (!deadline) return outcome === "NEEDS_CLARIFICATION" ? "Deadline not set" : "Received date still needed";
  const day = deadline.slice(0, 10);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
  }).format(new Date());
  if (day < today) return "Past the deadline";
  if (day === today) return "Due today";
  return "Inside the deadline";
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kathmandu",
  }).format(date);
}

export function badgeVariant(
  value: string | null | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  if (!value) return "outline";
  if (["RESOLVED", "APPROVED", "COMPLETED", "VALID"].includes(value)) return "default";
  if (["ESCALATE", "REJECTED", "CANCELLED", "SOURCE_CHANGE_REVIEW"].includes(value))
    return "destructive";
  if (value === "ALREADY_IMPORTED") return "outline";
  return "secondary";
}
