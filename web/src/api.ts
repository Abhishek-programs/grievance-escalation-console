export async function request<T>(path: string, options: RequestInit): Promise<T> {
  // Surface the API's structured error message to the operator.
  let response: Response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error("The desk could not reach the API.");
  }
  const text = await response.text();
  let body: { error?: { message?: string } } = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("The desk could not reach the API.");
    }
  }
  if (!response.ok) throw new Error(body.error?.message ?? "The desk could not reach the API.");
  return body as T;
}

export const bucketLabels = {
  open: "Open",
  overdue: "Overdue",
  missingDepartment: "Missing Department",
  unassignedEmployee: "Unassigned Employee",
  waitingOnTeam: "Waiting on Team",
  rejected: "Rejected",
};

export const bucketDescriptions: Record<keyof typeof bucketLabels, string> = {
  open: "Cases that are not resolved.",
  overdue: "Latest recommendation is to escalate.",
  missingDepartment: "No department is assigned.",
  unassignedEmployee: "A department is set, but nobody owns the case.",
  waitingOnTeam: "A follow-up action is still open.",
  rejected: "A supervisor rejected the recommendation.",
};
