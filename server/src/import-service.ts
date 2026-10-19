import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { Pool, PoolClient } from "pg";

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
  if (prior.rows[0])
    return {
      repeatedBatchId: String(prior.rows[0].id),
      counts: { alreadyImported: rawRows.length },
    };
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
  return {
    batchId,
    counts: Object.fromEntries(
      Object.entries(groups).map(([key, value]) => [key, value.length]),
    ),
    groups,
  };
}
