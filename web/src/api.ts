export async function request<T>(path: string, options: RequestInit): Promise<T> {
  // Surface the API's structured error message to the operator.
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Request failed");
  return body;
}

export const bucketLabels = {
  open: "Open",
  overdue: "Overdue",
  missingDepartment: "Missing Department",
  unassignedEmployee: "Unassigned Employee",
  waitingOnTeam: "Waiting on Team",
};

export const bucketDescriptions: Record<keyof typeof bucketLabels, string> = {
  open: "Cases that are not resolved.",
  overdue: "Latest recommendation is to escalate.",
  missingDepartment: "No department is assigned.",
  unassignedEmployee: "A department is set, but nobody owns the case.",
  waitingOnTeam: "A follow-up action is still open.",
};
