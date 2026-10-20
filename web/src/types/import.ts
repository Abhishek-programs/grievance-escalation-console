export interface ImportRow {
  id: string | number;
  row_number: number;
  source_record_id: string | null;
  outcome: string;
  warnings: unknown;
  errors: unknown;
  proposed_values: {
    title?: string;
    complainantName?: string | null;
    place?: string | null;
    district?: string | null;
    receivedDate?: string | null;
    normalizedStatus?: string | null;
  };
  duplicate_case_id?: string | number | null;
}

export interface ImportPreview {
  batchId?: string;
  sourcePlatform?: string | null;
  repeatedBatchId?: string;
  counts: Record<string, number>;
  groups?: Record<string, ImportRow[]>;
  committedRowIds?: string[];
}

export interface CommitResult {
  committedCaseIds: string[];
  committedRowIds: string[];
  skipped: { rowId: string; rowNumber: number; reason: string }[];
  requested: number;
}

export function importRows(preview: ImportPreview): ImportRow[] {
  const rows = new Map<string, ImportRow>();
  for (const group of Object.values(preview.groups ?? {})) {
    for (const row of group) rows.set(String(row.id), row);
  }
  return [...rows.values()].sort((left, right) => left.row_number - right.row_number);
}

export function messages(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [value];
    }
  }
  return [];
}

export const blockedOutcomes = new Set(["REJECTED", "ALREADY_IMPORTED", "SOURCE_CHANGE_REVIEW"]);
