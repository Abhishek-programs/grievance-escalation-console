import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { Pool, PoolClient } from "pg";
import { applyPolicyCheck } from "./evaluation.ts";
import { findDirectory } from "./recommendation.ts";

export type Platform = "whatsapp" | "website" | "facebook" | "spreadsheet";

type Mapping = {
  id: string;
  title: string;
  description: string;
  date: string;
  status: string;
  url?: string;
};

const mappings: Record<Platform, Mapping> = {
  whatsapp: {
    id: "message_id",
    title: "message",
    description: "notes",
    date: "sent_at",
    status: "state",
  },
  website: {
    id: "submission_id",
    title: "subject",
    description: "description",
    date: "received_on",
    status: "status",
    url: "source_url",
  },
  facebook: {
    id: "post_ref",
    title: "post_text",
    description: "extra",
    date: "created",
    status: "moderation_state",
    url: "permalink",
  },
  spreadsheet: {
    id: "complaint_no",
    title: "complaint",
    description: "remarks",
    date: "date_received",
    status: "case_status",
  },
};

const knownStatuses: Record<string, string> = {
  open: "OPEN",
  resolved: "RESOLVED",
  "in progress": "IN_PROGRESS",
};

const fingerprint = (text: string) =>
  createHash("sha256").update(text).digest("hex");

const sourceMarkers: Record<Platform, string> = {
  whatsapp: "message_id",
  website: "submission_id",
  facebook: "post_ref",
  spreadsheet: "complaint_no",
};

export function detectPlatform(csv: string): Platform {
  const header = csv.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const names = new Set(
    header.split(",").map((column) => column.trim().replaceAll('"', "").toLowerCase()),
  );
  const match = (Object.entries(sourceMarkers) as Array<[Platform, string]>).find(
    ([, marker]) => names.has(marker),
  );
  if (!match) {
    throw new Error(
      "This file is not a WhatsApp, website, Facebook, or spreadsheet export.",
    );
  }
  return match[0];
}

const normalizedText = (value: unknown) => String(value ?? "").trim();

function parseDate(value: string): string | null {
  // Accept the three demonstrated formats without guessing ambiguous month/day order.
  if (!value) return null;
  if (/^2026-\d{2}-\d{2}$/.test(value)) return value;
  const dayFirst = value.match(/^(\d{2})\/10\/2026$/);
  if (dayFirst) return `2026-10-${dayFirst[1]}`;
  const written = value.match(/^(\d{1,2}) Oct 2026$/);
  return written ? `2026-10-${written[1].padStart(2, "0")}` : null;
}

function normalizeRow(raw: Record<string, unknown>, mapping: Mapping) {
  const originalStatus = normalizedText(raw[mapping.status]).toLowerCase();
  const receivedDate = parseDate(normalizedText(raw[mapping.date]));
  return {
    sourceRecordId: normalizedText(raw[mapping.id]) || null,
    sourceUrl: mapping.url ? normalizedText(raw[mapping.url]) || null : null,
    title: normalizedText(raw[mapping.title]),
    description: normalizedText(raw[mapping.description]) || null,
    receivedDate,
    normalizedStatus: knownStatuses[originalStatus] ?? null,
    originalStatus,
  };
}

export async function previewImport(
  pool: Pool,
  platform: Platform,
  name: string,
  csv: string,
  actorId: string,
) {
  const rawRows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, unknown>[];
  const sourceHash = fingerprint(csv);
  const prior = await pool.query(
    "SELECT id FROM import_batches WHERE source_fingerprint=$1",
    [sourceHash],
  );
  if (prior.rows[0]) {
    // Reopen the same file so unfinished rows can still be committed.
    return {
      ...(await reviewSummary(pool, String(prior.rows[0].id))),
      repeatedBatchId: String(prior.rows[0].id),
    };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batch = await client.query(
      `INSERT INTO import_batches(source_platform,source_name,source_fingerprint,imported_at,imported_by,status) VALUES($1,$2,$3,now(),$4,'PREVIEW') RETURNING id`,
      [platform, name, sourceHash, actorId],
    );
    const batchId = String(batch.rows[0].id);
    for (const [index, raw] of rawRows.entries())
      await stageRow(client, batchId, index + 2, platform, raw);
    await client.query("COMMIT");
    return await reviewSummary(pool, batchId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function stageRow(
  client: PoolClient,
  batchId: string,
  rowNumber: number,
  platform: Platform,
  raw: Record<string, unknown>,
) {
  const proposed = normalizeRow(raw, mappings[platform]);
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!proposed.title) errors.push("A complaint title is required");
  if (!proposed.receivedDate)
    warnings.push("Received date needs clarification");
  if (!proposed.normalizedStatus)
    warnings.push("Status mapping needs clarification");
  const sameSource = proposed.sourceRecordId
    ? await client.query(
        "SELECT id,original_values FROM cases WHERE source_platform=$1 AND source_record_id=$2",
        [platform, proposed.sourceRecordId],
      )
    : { rows: [] };
  const similar = proposed.title
    ? await client.query(
        "SELECT id FROM cases WHERE lower(title)=lower($1) LIMIT 1",
        [proposed.title],
      )
    : { rows: [] };
  let outcome = errors.length
    ? "REJECTED"
    : warnings.length
      ? "NEEDS_REVIEW"
      : "VALID";
  let duplicateCaseId: string | null = null;
  if (sameSource.rows[0]) {
    duplicateCaseId = String(sameSource.rows[0].id);
    outcome =
      JSON.stringify(sameSource.rows[0].original_values) === JSON.stringify(raw)
        ? "ALREADY_IMPORTED"
        : "SOURCE_CHANGE_REVIEW";
  } else if (similar.rows[0]) {
    duplicateCaseId = String(similar.rows[0].id);
    outcome = "POSSIBLE_DUPLICATE";
  }
  await client.query(
    `INSERT INTO import_rows(batch_id,row_number,source_record_id,source_url,original_values,proposed_values,outcome,warnings,errors,duplicate_case_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      batchId,
      rowNumber,
      proposed.sourceRecordId,
      proposed.sourceUrl,
      raw,
      proposed,
      outcome,
      JSON.stringify(warnings),
      JSON.stringify(errors),
      duplicateCaseId,
    ],
  );
}

async function reviewSummary(pool: Pool, batchId: string) {
  // Return grouped evidence instead of one opaque success count.
  const rows = await pool.query(
    "SELECT id,row_number,source_record_id,original_values,proposed_values,outcome,warnings,errors,duplicate_case_id FROM import_rows WHERE batch_id=$1 ORDER BY row_number",
    [batchId],
  );
  const groups: Record<string, unknown[]> = {
    valid: [],
    rejected: [],
    warnings: [],
    possibleDuplicates: [],
    uncertainMappings: [],
    alreadyImported: [],
    changedSourceRecords: [],
  };
  for (const row of rows.rows) {
    if (row.outcome === "VALID") groups.valid.push(row);
    if (row.outcome === "REJECTED") groups.rejected.push(row);
    if (row.warnings.length) groups.warnings.push(row);
    if (row.outcome === "POSSIBLE_DUPLICATE")
      groups.possibleDuplicates.push(row);
    if (row.outcome === "NEEDS_REVIEW") groups.uncertainMappings.push(row);
    if (row.outcome === "ALREADY_IMPORTED") groups.alreadyImported.push(row);
    if (row.outcome === "SOURCE_CHANGE_REVIEW")
      groups.changedSourceRecords.push(row);
  }
  const committed = await pool.query(
    "SELECT import_row_id::text AS id FROM cases WHERE import_batch_id=$1",
    [batchId],
  );
  const batch = await pool.query(
    "SELECT source_platform FROM import_batches WHERE id=$1",
    [batchId],
  );
  return {
    batchId,
    sourcePlatform: batch.rows[0]?.source_platform ?? null,
    counts: Object.fromEntries(
      Object.entries(groups).map(([key, value]) => [key, value.length]),
    ),
    groups,
    committedRowIds: committed.rows.map((row) => String(row.id)),
  };
}

export async function commitSelectedRows(
  client: PoolClient,
  batchId: string,
  rowIds: string[],
  confirmedRowIds: Set<string>,
  actorId: string,
) {
  const rows = await client.query(
    "SELECT * FROM import_rows WHERE batch_id=$1 AND id=ANY($2::bigint[]) FOR UPDATE",
    [batchId, rowIds],
  );
  const committedCaseIds: string[] = [];
  const committedRowIds: string[] = [];
  const skipped: { rowId: string; rowNumber: number; reason: string }[] = [];
  for (const row of rows.rows) {
    const rowId = String(row.id);
    const allowed = row.outcome === "VALID" || confirmedRowIds.has(rowId);
    if (
      !allowed ||
      ["REJECTED", "ALREADY_IMPORTED", "SOURCE_CHANGE_REVIEW"].includes(row.outcome)
    ) {
      skipped.push({
        rowId,
        rowNumber: row.row_number,
        reason: "This row cannot be committed.",
      });
      continue;
    }
    await client.query("SAVEPOINT row_commit");
    try {
      committedCaseIds.push(await insertCaseAndAudit(client, row, actorId));
      committedRowIds.push(rowId);
      await client.query("RELEASE SAVEPOINT row_commit");
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT row_commit");
      await client.query("RELEASE SAVEPOINT row_commit");
      skipped.push({
        rowId,
        rowNumber: row.row_number,
        reason: error instanceof Error ? error.message : "Commit failed",
      });
    }
  }
  const remaining = await client.query(
    `SELECT count(*) FROM import_rows r
     WHERE r.batch_id=$1
       AND r.outcome NOT IN ('REJECTED','ALREADY_IMPORTED','SOURCE_CHANGE_REVIEW')
       AND NOT EXISTS (SELECT 1 FROM cases c WHERE c.import_row_id=r.id)`,
    [batchId],
  );
  await client.query("UPDATE import_batches SET status=$2 WHERE id=$1", [
    batchId,
    Number(remaining.rows[0].count) === 0 ? "COMMITTED" : "PREVIEW",
  ]);
  return { committedCaseIds, committedRowIds, skipped, requested: rowIds.length };
}

async function insertCaseAndAudit(
  client: PoolClient,
  row: {
    id: string;
    batch_id: string;
    source_record_id: string | null;
    source_url: string | null;
    original_values: unknown;
    proposed_values: {
      title: string;
      description: string | null;
      receivedDate: string | null;
      normalizedStatus: string | null;
    };
  },
  actorId: string,
): Promise<string> {
  const value = row.proposed_values;
  const createdAt = new Date().toISOString();
  const directory = await findDirectory(client, value.title, value.description);
  const inserted = await client.query(
    `INSERT INTO cases(source_platform,source_record_id,source_url,import_batch_id,import_row_id,original_values,title,description,received_date,normalized_status,department_id,created_at) SELECT b.source_platform,$1,$2,b.id,$3,$4,$5,$6,$7,$8,$9,$10 FROM import_batches b WHERE b.id=$11 ON CONFLICT(source_platform,source_record_id) DO NOTHING RETURNING id`,
    [
      row.source_record_id,
      row.source_url,
      row.id,
      row.original_values,
      value.title,
      value.description,
      value.receivedDate,
      value.normalizedStatus ?? "NEEDS_CLARIFICATION",
      directory?.departmentId ?? null,
      createdAt,
      row.batch_id,
    ],
  );
  if (!inserted.rows[0]) throw new Error("Source record already exists; review required");
  const caseId = String(inserted.rows[0].id);
  await client.query(
    `INSERT INTO audit_events(entity_type,entity_id,event_type,actor_id,event_time,before_values,after_values,metadata) VALUES('case',$1,'CASE_IMPORTED',$2,$3,NULL,$4,$5)`,
    [
      caseId,
      actorId,
      createdAt,
      { caseId, sourceRecordId: row.source_record_id },
      { batchId: String(row.batch_id), importRowId: String(row.id) },
    ],
  );
  await applyPolicyCheck(client, caseId);
  return caseId;
}
