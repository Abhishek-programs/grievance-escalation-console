import { departmentCodeFor, recommend } from "../../server/src/recommendation.ts";
import type { PolicySnapshot } from "../../server/src/policy.ts";
import type { ICaseTable, ICaseTableItem } from "./types/case-table.ts";
import type { IEvidence } from "./types/evidence.ts";
import type { CommitResult, ImportPreview, ImportRow } from "./types/import.ts";

const storageKey = "desk-guest-v1";

const policy: PolicySnapshot = {
  policyVersion: "NP-GRIEVANCE-2026-V1",
  timezone: "Asia/Kathmandu",
  workingIsoDays: [1, 2, 3, 4, 5],
  holidays: [
    { date: "2026-10-20", name: "Dashain holiday", sourceUrl: "https://moha.gov.np/en/page/government-and-public-holidays-in-2083" },
    { date: "2026-10-21", name: "Dashain holiday", sourceUrl: "https://moha.gov.np/en/page/government-and-public-holidays-in-2083" },
    { date: "2026-11-11", name: "Tihar holiday", sourceUrl: "https://moha.gov.np/en/page/government-and-public-holidays-in-2083" },
  ],
  allowedWorkingDays: 5,
  deadlineInclusivity: "DUE_THROUGH_END_OF_DAY",
  missingDateBehavior: "NEEDS_CLARIFICATION",
};

const teams: Record<string, { name: string; officer: string; role: string }> = {
  WATER: { name: "Water Services", officer: "Asha Rai", role: "Case Officer" },
  ROADS: { name: "Roads and Transport", officer: "Mina Gurung", role: "Case Officer" },
  HEALTH: { name: "Public Health", officer: "Rojina Karki", role: "Case Officer" },
  ADMIN: { name: "Citizen Administration", officer: "Bikash Lama", role: "Review Officer" },
};

const markers = {
  whatsapp: "message_id",
  website: "submission_id",
  facebook: "post_ref",
  spreadsheet: "complaint_no",
} as const;

type Platform = keyof typeof markers;

const columns: Record<Platform, Record<string, string>> = {
  whatsapp: {
    id: "message_id",
    title: "message",
    description: "detail",
    date: "sent_at",
    status: "state",
    complainant: "sender_name",
    phone: "sender_phone",
    district: "district",
    localLevel: "municipality",
    ward: "ward",
    place: "place",
    category: "category",
    relief: "requested_action",
  },
  website: {
    id: "submission_id",
    title: "subject",
    description: "description",
    date: "received_on",
    status: "status",
    complainant: "full_name",
    phone: "mobile",
    district: "district",
    localLevel: "local_level",
    ward: "ward",
    place: "place",
    category: "category",
    relief: "relief_sought",
    url: "source_url",
  },
  facebook: {
    id: "post_ref",
    title: "post_text",
    description: "detail",
    date: "created",
    status: "moderation_state",
    complainant: "author_name",
    phone: "contact",
    district: "district",
    localLevel: "municipality",
    ward: "ward",
    place: "place",
    category: "category",
    relief: "ask",
    url: "permalink",
  },
  spreadsheet: {
    id: "complaint_no",
    title: "complaint",
    description: "account",
    date: "date_received",
    status: "case_status",
    complainant: "complainant",
    phone: "phone",
    district: "district",
    localLevel: "local_level",
    ward: "ward",
    place: "tole",
    category: "category",
    relief: "relief",
  },
};

const statuses: Record<string, string> = {
  open: "OPEN",
  resolved: "RESOLVED",
  "in progress": "IN_PROGRESS",
};

const sampleCsv = `message_id,sender_name,sender_phone,district,municipality,ward,place,category,message,detail,requested_action,sent_at,state
"WH-1000","Sita Tamang","9801001001","Morang","Biratnagar Metropolitan City","8","Devkota Chowk","Drinking water","No water in the lane for nine days","The municipal tap in our lane has been dry since the pipe burst near the chowk. About forty households are buying jars. The ward office said a team would come on Sunday. Nobody came, and the broken section is still open.","Repair the pipe and restore the morning supply. Tell the ward which day the water will return.","2026-10-02","in progress"
"WH-1001","Ram Bahadur Gurung","9801001002","Kaski","Pokhara Metropolitan City","12","Malepatan","Road and drainage","The school road is broken and floods","The blacktop in front of the school has a hole about a meter wide. Children walk around it into the drain when it rains. Two tempos have already scraped the edge.","Fill the hole before the school week and put a temporary barrier until the patch is finished.","02/10/2026","open"
`;

type Proposed = {
  sourceRecordId: string | null;
  sourceUrl: string | null;
  title: string;
  description: string | null;
  complainantName: string | null;
  phone: string | null;
  district: string | null;
  localLevel: string | null;
  ward: string | null;
  place: string | null;
  category: string | null;
  reliefSought: string | null;
  receivedDate: string | null;
  normalizedStatus: string | null;
};

type GuestEvaluation = {
  id: string;
  policy_version: string;
  recommendation_outcome: string;
  recommended_next_step: string;
  recommendation_reason: string;
  calculated_deadline: string | null;
  deadline_calculation: { trace?: Array<{ date: string; reason: string; counted: boolean }> } | null;
  departmentCode: string | null;
  evaluated_at: string;
};

type GuestCase = {
  id: string;
  sourcePlatform: string;
  sourceRecordId: string | null;
  sourceName: string;
  sourceUrl: string | null;
  originalValues: Record<string, string>;
  title: string;
  description: string | null;
  complainantName: string | null;
  phone: string | null;
  district: string | null;
  localLevel: string | null;
  ward: string | null;
  place: string | null;
  category: string | null;
  reliefSought: string | null;
  receivedDate: string | null;
  normalizedStatus: string;
  importedAt: string;
  departmentName: string | null;
  employeeName: string | null;
  employeeRole: string | null;
  evaluations: GuestEvaluation[];
  decisions: IEvidence["decisions"];
  followUps: IEvidence["followUps"];
  audit: IEvidence["audit"];
};

type GuestRow = {
  id: string;
  row_number: number;
  source_record_id: string | null;
  outcome: string;
  warnings: string[];
  errors: string[];
  proposed_values: Proposed;
  duplicate_case_id: string | null;
  original: Record<string, string>;
  caseId?: string;
};

type GuestBatch = {
  id: string;
  platform: Platform;
  name: string;
  fingerprint: string;
  rows: GuestRow[];
};

type Store = { next: number; cases: GuestCase[]; batches: GuestBatch[] };

function empty(): Store {
  return { next: 1, cases: [], batches: [] };
}

function read(): Store {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Store;
    if (!parsed.cases || !parsed.batches) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function write(store: Store) {
  localStorage.setItem(storageKey, JSON.stringify(store));
}

function load(): Store {
  const store = read();
  if (store.cases.length > 0 || store.batches.length > 0) return store;
  const preview = stage(store, "whatsapp-sample.csv", sampleCsv);
  const valid = store.batches
    .find((batch) => batch.id === preview.batchId)
    ?.rows.filter((row) => row.outcome === "VALID")
    .map((row) => row.id) ?? [];
  accept(store, String(preview.batchId), valid, new Set());
  write(store);
  return store;
}

function id(store: Store) {
  const next = `local-${store.next}`;
  store.next += 1;
  return next;
}

function kathmanduToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((values) =>
    Object.fromEntries(header.map((name, index) => [name.trim().toLowerCase(), values[index]?.trim() ?? ""])),
  );
}

function detect(csv: string): Platform {
  const header = csv.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const names = new Set(header.split(",").map((column) => column.trim().replaceAll('"', "").toLowerCase()));
  const match = (Object.entries(markers) as Array<[Platform, string]>).find(([, marker]) => names.has(marker));
  if (!match) throw new Error("This file is not a WhatsApp, website, Facebook, or spreadsheet export.");
  return match[0];
}

function parseDate(value: string): string | null {
  if (!value) return null;
  if (/^2026-\d{2}-\d{2}$/.test(value)) return value;
  const dayFirst = value.match(/^(\d{2})\/10\/2026$/);
  if (dayFirst) return `2026-10-${dayFirst[1]}`;
  const written = value.match(/^(\d{1,2}) Oct 2026$/);
  return written ? `2026-10-${written[1].padStart(2, "0")}` : null;
}

function propose(raw: Record<string, string>, platform: Platform): Proposed {
  const map = columns[platform];
  const text = (key: string) => raw[map[key]]?.trim() || null;
  const originalStatus = (raw[map.status] ?? "").trim().toLowerCase();
  return {
    sourceRecordId: raw[map.id]?.trim() || null,
    sourceUrl: map.url ? text("url") : null,
    title: (raw[map.title] ?? "").trim(),
    description: text("description"),
    complainantName: text("complainant"),
    phone: text("phone"),
    district: text("district"),
    localLevel: text("localLevel"),
    ward: text("ward"),
    place: text("place"),
    category: text("category"),
    reliefSought: text("relief"),
    receivedDate: parseDate((raw[map.date] ?? "").trim()),
    normalizedStatus: statuses[originalStatus] ?? null,
  };
}

function fingerprint(text: string) {
  let hash = 0;
  for (const char of text) hash = Math.imul(31, hash) + char.charCodeAt(0);
  return String(hash);
}

function summary(batch: GuestBatch): ImportPreview {
  const groups: Record<string, ImportRow[]> = {
    valid: [],
    rejected: [],
    warnings: [],
    possibleDuplicates: [],
    uncertainMappings: [],
    alreadyImported: [],
    changedSourceRecords: [],
  };
  for (const row of batch.rows) {
    const view = row as ImportRow;
    if (row.outcome === "VALID") groups.valid.push(view);
    if (row.outcome === "REJECTED") groups.rejected.push(view);
    if (row.warnings.length) groups.warnings.push(view);
    if (row.outcome === "POSSIBLE_DUPLICATE") groups.possibleDuplicates.push(view);
    if (row.outcome === "NEEDS_REVIEW") groups.uncertainMappings.push(view);
    if (row.outcome === "ALREADY_IMPORTED") groups.alreadyImported.push(view);
    if (row.outcome === "SOURCE_CHANGE_REVIEW") groups.changedSourceRecords.push(view);
  }
  return {
    batchId: batch.id,
    sourcePlatform: batch.platform,
    counts: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])),
    groups,
    committedRowIds: batch.rows.filter((row) => row.caseId).map((row) => row.id),
  };
}

function stage(store: Store, name: string, csv: string): ImportPreview {
  const platform = detect(csv);
  const hash = fingerprint(csv);
  const prior = store.batches.find((batch) => batch.fingerprint === hash);
  if (prior) return { ...summary(prior), repeatedBatchId: prior.id };
  const records = parseCsv(csv);
  if (records.length > 200) throw new Error("A file can contain at most 200 rows.");
  const batch: GuestBatch = { id: id(store), platform, name, fingerprint: hash, rows: [] };
  records.forEach((raw, index) => {
    const proposed = propose(raw, platform);
    const warnings: string[] = [];
    const errors: string[] = [];
    if (!proposed.title) errors.push("A complaint title is required");
    if (!proposed.receivedDate) warnings.push("Received date needs clarification");
    if (!proposed.normalizedStatus) warnings.push("Status mapping needs clarification");
    const same = proposed.sourceRecordId
      ? store.cases.find(
          (item) => item.sourcePlatform === platform && item.sourceRecordId === proposed.sourceRecordId,
        )
      : undefined;
    const similar = proposed.title
      ? store.cases.find((item) => item.title.toLowerCase() === proposed.title.toLowerCase())
      : undefined;
    let outcome = errors.length ? "REJECTED" : warnings.length ? "NEEDS_REVIEW" : "VALID";
    let duplicate: string | null = null;
    if (same) {
      duplicate = same.id;
      outcome = JSON.stringify(same.originalValues) === JSON.stringify(raw) ? "ALREADY_IMPORTED" : "SOURCE_CHANGE_REVIEW";
    } else if (similar) {
      duplicate = similar.id;
      outcome = "POSSIBLE_DUPLICATE";
    }
    batch.rows.push({
      id: id(store),
      row_number: index + 2,
      source_record_id: proposed.sourceRecordId,
      outcome,
      warnings,
      errors,
      proposed_values: proposed,
      duplicate_case_id: duplicate,
      original: raw,
    });
  });
  store.batches.push(batch);
  return summary(batch);
}

function check(item: GuestCase) {
  const code = departmentCodeFor({
    title: item.title,
    description: item.description,
    category: item.category,
  });
  const team = code ? teams[code] : null;
  const result = recommend(
    {
      caseId: item.id,
      title: item.title,
      description: item.description,
      receivedDate: item.receivedDate,
      normalizedStatus: item.normalizedStatus,
      asOfDate: kathmanduToday(),
    },
    policy,
    team ? { departmentId: code!, departmentCode: code!, employeeId: team.officer } : null,
  );
  return { result, code, team };
}

function evaluate(store: Store, item: GuestCase) {
  const { result, code, team } = check(item);
  const evaluatedAt = new Date().toISOString();
  item.evaluations.unshift({
    id: id(store),
    policy_version: policy.policyVersion,
    recommendation_outcome: result.outcome,
    recommended_next_step: result.nextStep,
    recommendation_reason: result.reason,
    calculated_deadline: result.calculatedDeadline,
    deadline_calculation: result.deadlineCalculation,
    departmentCode: code,
    evaluated_at: evaluatedAt,
  });
  if (!item.departmentName && team) {
    item.departmentName = team.name;
    item.employeeName = team.officer;
    item.employeeRole = team.role;
  }
  item.audit.push({
    id: id(store),
    event_time: evaluatedAt,
    event_type: "POLICY_EVALUATED",
    actor_id: "policy-engine",
  });
}

function accept(store: Store, batchId: string, rowIds: string[], confirmed: Set<string>): CommitResult {
  const batch = store.batches.find((item) => item.id === batchId);
  if (!batch) throw new Error("That preview is not in this browser.");
  const committedCaseIds: string[] = [];
  const committedRowIds: string[] = [];
  const skipped: CommitResult["skipped"] = [];
  for (const rowId of rowIds) {
    const row = batch.rows.find((item) => item.id === rowId);
    if (!row) continue;
    const allowed = row.outcome === "VALID" || confirmed.has(rowId);
    if (!allowed || ["REJECTED", "ALREADY_IMPORTED", "SOURCE_CHANGE_REVIEW"].includes(row.outcome) || row.caseId) {
      skipped.push({ rowId, rowNumber: row.row_number, reason: "This row cannot be committed." });
      continue;
    }
    const proposed = row.proposed_values;
    const createdAt = new Date().toISOString();
    const item: GuestCase = {
      id: id(store),
      sourcePlatform: batch.platform,
      sourceRecordId: proposed.sourceRecordId,
      sourceName: batch.name,
      sourceUrl: proposed.sourceUrl,
      originalValues: row.original,
      title: proposed.title,
      description: proposed.description,
      complainantName: proposed.complainantName,
      phone: proposed.phone,
      district: proposed.district,
      localLevel: proposed.localLevel,
      ward: proposed.ward,
      place: proposed.place,
      category: proposed.category,
      reliefSought: proposed.reliefSought,
      receivedDate: proposed.receivedDate,
      normalizedStatus: proposed.normalizedStatus ?? "NEEDS_CLARIFICATION",
      importedAt: createdAt,
      departmentName: null,
      employeeName: null,
      employeeRole: null,
      evaluations: [],
      decisions: [],
      followUps: [],
      audit: [{ id: id(store), event_time: createdAt, event_type: "CASE_IMPORTED", actor_id: "This browser" }],
    };
    evaluate(store, item);
    store.cases.unshift(item);
    row.caseId = item.id;
    committedCaseIds.push(item.id);
    committedRowIds.push(rowId);
  }
  return { committedCaseIds, committedRowIds, skipped, requested: rowIds.length };
}

function latest(item: GuestCase) {
  return item.evaluations[0];
}

function matches(item: GuestCase, bucket: string) {
  const evaluation = latest(item);
  const decision = item.decisions.find((entry) => String(entry.evaluation_id) === evaluation?.id);
  const followUp = item.followUps[0];
  if (bucket === "open") return item.normalizedStatus !== "RESOLVED";
  if (bucket === "overdue") return evaluation?.recommendation_outcome === "ESCALATE";
  if (bucket === "missingDepartment") return !item.departmentName;
  if (bucket === "unassignedEmployee") return Boolean(item.departmentName) && !item.employeeName;
  if (bucket === "waitingOnTeam") return followUp?.status === "OPEN";
  if (bucket === "rejected") return decision?.decision === "REJECTED";
  return true;
}

function rowOf(item: GuestCase): ICaseTableItem {
  const evaluation = latest(item);
  const decision = item.decisions.find((entry) => String(entry.evaluation_id) === evaluation?.id);
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    complainant_name: item.complainantName,
    district: item.district,
    local_level: item.localLevel,
    ward: item.ward,
    place: item.place,
    category: item.category,
    normalized_status: item.normalizedStatus,
    department_name: item.departmentName,
    decision: decision?.decision ?? null,
    decision_reason: decision?.reason ?? null,
    employee_name: item.employeeName,
    employee_role: item.employeeRole,
    recommendation_outcome: evaluation?.recommendation_outcome ?? null,
    recommended_next_step: evaluation?.recommended_next_step ?? null,
    calculated_deadline: evaluation?.calculated_deadline ?? null,
  };
}

export function guestDashboard(bucket: string, page: number, pageSize: number): { metrics: Record<string, number>; cases: ICaseTable } {
  const store = load();
  const buckets = ["open", "overdue", "missingDepartment", "unassignedEmployee", "waitingOnTeam", "rejected"];
  const metrics = Object.fromEntries(buckets.map((name) => [name, store.cases.filter((item) => matches(item, name)).length]));
  const matched = store.cases.filter((item) => matches(item, bucket));
  const start = (page - 1) * pageSize;
  return {
    metrics,
    cases: {
      page,
      pageSize,
      total: matched.length,
      items: matched.slice(start, start + pageSize).map(rowOf),
    },
  };
}

export function guestEvidence(caseId: string): IEvidence | null {
  const item = load().cases.find((entry) => entry.id === caseId);
  if (!item) return null;
  return {
    writable: true,
    case: {
      id: item.id,
      title: item.title,
      description: item.description,
      complainant_name: item.complainantName,
      phone: item.phone,
      district: item.district,
      local_level: item.localLevel,
      ward: item.ward,
      place: item.place,
      category: item.category,
      relief_sought: item.reliefSought,
      received_date: item.receivedDate,
      normalized_status: item.normalizedStatus,
      original_values: item.originalValues,
      source_platform: item.sourcePlatform,
      source_name: item.sourceName,
      source_url: item.sourceUrl,
      imported_at: item.importedAt,
      imported_by: "This browser",
    },
    evaluations: item.evaluations,
    decisions: item.decisions,
    followUps: item.followUps,
    audit: item.audit,
  };
}

export function guestPreview(name: string, csv: string): ImportPreview {
  const store = load();
  const preview = stage(store, name, csv);
  write(store);
  return preview;
}

export function guestCommit(batchId: string, rowIds: string[], confirmedRowIds: string[]): CommitResult {
  const store = load();
  const result = accept(store, batchId, rowIds, new Set(confirmedRowIds));
  write(store);
  return result;
}

export function guestEvaluate(caseId: string) {
  const store = load();
  const item = store.cases.find((entry) => entry.id === caseId);
  if (!item) throw new Error("That complaint is not in this browser.");
  evaluate(store, item);
  write(store);
}

export function guestDecide(caseId: string, decision: string, reason: string) {
  const store = load();
  const item = store.cases.find((entry) => entry.id === caseId);
  const evaluation = item ? latest(item) : undefined;
  if (!item || !evaluation) throw new Error("Check the deadline before recording a decision.");
  const text = reason.trim();
  if (decision !== "APPROVED" && !text) throw new Error(`${decision} requires a reason`);
  if (item.decisions.some((entry) => String(entry.evaluation_id) === evaluation.id)) {
    throw new Error("That recommendation already has a decision.");
  }
  const decidedAt = new Date().toISOString();
  item.decisions.unshift({
    evaluation_id: evaluation.id,
    decision,
    reason: text || null,
    decided_by: "This browser",
    decided_at: decidedAt,
  });
  item.audit.push({
    id: id(store),
    event_time: decidedAt,
    event_type: "SUPERVISOR_DECISION_RECORDED",
    actor_id: "This browser",
  });
  if (decision !== "REJECTED") {
    if (!evaluation.departmentCode || !teams[evaluation.departmentCode]) {
      throw new Error("A responsible department is required");
    }
    if (!evaluation.calculated_deadline) throw new Error("A follow-up due date is required");
    const team = teams[evaluation.departmentCode];
    item.followUps.unshift({
      action_text: decision === "CLARIFICATION_REQUESTED" ? `Clarify case facts: ${text}` : evaluation.recommended_next_step,
      due_date: evaluation.calculated_deadline,
      status: "OPEN",
    });
    item.departmentName ??= team.name;
    item.employeeName ??= team.officer;
    item.employeeRole ??= team.role;
  }
  write(store);
}
