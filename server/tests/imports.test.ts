import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { previewImport } from "../src/import-service.ts";

const pool = new Pool({
  connectionString:
    "postgres://app:local-development-only@localhost:5432/grievances",
});
const sourceId = `TEST-${Date.now()}`;
const header =
  "submission_id,subject,description,received_on,status,source_url";
const original = `${header}\n${sourceId},Water supply stopped,Fictional test,2026-10-01,open,https://example.invalid/test`;
const changed = `${header}\n${sourceId},Water supply stopped,Changed fictional text,2026-10-01,open,https://example.invalid/test`;

test("changed source records require review", async () => {
  const first: any = await previewImport(
    pool,
    "website",
    "first.csv",
    original,
    "test-runner",
  );
  const row = first.groups.valid[0];
  const inserted = await pool.query(
    `INSERT INTO cases(source_platform,source_record_id,source_url,import_batch_id,import_row_id,original_values,title,description,received_date,normalized_status,created_at) VALUES('website',$1,$2,$3,$4,$5,$6,$7,$8,'OPEN',now()) RETURNING id`,
    [
      sourceId,
      row.source_url,
      first.batchId,
      row.id,
      row.original_values,
      row.proposed_values.title,
      row.proposed_values.description,
      row.proposed_values.receivedDate,
    ],
  );
  assert.ok(inserted.rows[0].id);
  const review: any = await previewImport(
    pool,
    "website",
    "changed.csv",
    changed,
    "test-runner",
  );
  assert.equal(review.counts.changedSourceRecords, 1);
});

test("byte-identical repeat files return the existing batch", async () => {
  // The changed file was staged by the previous test.
  const repeated: any = await previewImport(
    pool,
    "website",
    "changed-again.csv",
    changed,
    "test-runner",
  );
  assert.equal(repeated.counts.alreadyImported, 1);
  assert.ok(repeated.repeatedBatchId);
});
test.after(async () => {
  await pool.end();
});
