import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { Pool } from "pg";
import { previewImport } from "../src/import-service.ts";

const pool = new Pool({
  connectionString:
    "postgres://app:local-development-only@localhost:5432/grievances",
});

const header =
  "submission_id,subject,description,received_on,status,source_url";

// 1. AUTOMATE CLEAN SLATE BEFORE EVERY SINGLE TEST RUN
beforeEach(async () => {
  await pool.query(
    "TRUNCATE cases, import_batches, import_rows, review_decisions, follow_up_actions, evaluations, audit_events CASCADE;",
  );
});

test("changed source records require review", async () => {
  // Generate a completely unique ID and CSV files locally inside this test scope
  const testSourceId = `TEST-CHANGE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const originalCsv = `${header}\n${testSourceId},Water supply stopped,Fictional test,2026-10-01,open,https://example.invalid/test`;
  const changedCsv = `${header}\n${testSourceId},Water supply stopped,Changed fictional text,2026-10-01,open,https://example.invalid/test`;

  const first: any = await previewImport(
    pool,
    "website",
    "first.csv",
    originalCsv,
    "test-runner",
  );

  const row = first.groups.valid[0];
  assert.ok(
    row,
    "The original row should be classified as VALID on a clean slate database.",
  );

  const inserted = await pool.query(
    `INSERT INTO cases(source_platform,source_record_id,source_url,import_batch_id,import_row_id,original_values,title,description,received_date,normalized_status,created_at) 
     VALUES('website',$1,$2,$3,$4,$5,$6,$7,$8,'OPEN',now()) RETURNING id`,
    [
      testSourceId,
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

  // Previewing the modified CSV should now cleanly flag a changed source record
  const review: any = await previewImport(
    pool,
    "website",
    "changed.csv",
    changedCsv,
    "test-runner",
  );
  assert.equal(review.counts.changedSourceRecords, 1);
});

test("byte-identical repeat files return the existing batch", async () => {
  // This test is now 100% self-contained and no longer depends on Test 1!
  const testSourceId = `TEST-REPEAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const uniqueCsv = `${header}\n${testSourceId},Water supply stopped,Fictional test,2026-10-01,open,https://example.invalid/test`;

  // First ingestion: stages the initial batch and records the fingerprint
  const firstImport: any = await previewImport(
    pool,
    "website",
    "changed.csv",
    uniqueCsv,
    "test-runner",
  );

  // Second ingestion: attempts to upload the byte-identical CSV content
  const repeated: any = await previewImport(
    pool,
    "website",
    "changed-again.csv",
    uniqueCsv,
    "test-runner",
  );

  assert.equal(repeated.counts.alreadyImported, 1);
  assert.ok(repeated.repeatedBatchId);
  assert.equal(repeated.repeatedBatchId, firstImport.batchId);
});

test.after(async () => {
  await pool.end();
});
