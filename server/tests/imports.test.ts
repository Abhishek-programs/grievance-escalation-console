import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { Pool } from "pg";
import { commitSelectedRows, detectPlatform, previewImport } from "../src/import-service.ts";

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

test("csv headers choose the source", () => {
  assert.equal(
    detectPlatform("message_id,message,notes,sent_at,state\n"),
    "whatsapp",
  );
  assert.equal(detectPlatform('"submission_id","subject","description"\n'), "website");
  assert.equal(detectPlatform("post_ref,post_text\n"), "facebook");
  assert.equal(detectPlatform("complaint_no,complaint\n"), "spreadsheet");
  assert.throws(() => detectPlatform("name,notes\n"), /not a WhatsApp/);
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

  assert.equal(repeated.repeatedBatchId, firstImport.batchId);
  assert.equal(repeated.batchId, firstImport.batchId);
  assert.equal(repeated.groups.valid.length, 1);
  assert.deepEqual(repeated.committedRowIds, []);
});

test("a repeated file can commit the rows that are still open", async () => {
  const testSourceId = `TEST-PARTIAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const uniqueCsv = `${header}\n${testSourceId},Water supply stopped,Fictional test,2026-10-01,open,https://example.invalid/test\n${testSourceId}-B,Clinic queue delay,Fictional test,2026-10-02,open,https://example.invalid/test-b`;
  const first: any = await previewImport(pool, "website", "partial.csv", uniqueCsv, "test-runner");
  const [firstRow, secondRow] = first.groups.valid;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const partial = await commitSelectedRows(client, first.batchId, [String(firstRow.id)], new Set(), "test-runner");
    await client.query("COMMIT");
    assert.deepEqual(partial.committedRowIds, [String(firstRow.id)]);
    assert.deepEqual(partial.skipped, []);
    const department = await client.query(
      "SELECT d.code FROM cases c JOIN departments d ON d.id=c.department_id WHERE c.import_row_id=$1",
      [firstRow.id],
    );
    assert.equal(department.rows[0].code, "WATER");
    const policy = await client.query(
      `SELECT e.recommendation_outcome, emp.name
       FROM cases c
       JOIN evaluations e ON e.case_id=c.id
       LEFT JOIN employees emp ON emp.id=c.employee_id
       WHERE c.import_row_id=$1`,
      [firstRow.id],
    );
    assert.equal(policy.rows[0].recommendation_outcome, "ESCALATE");
    assert.equal(policy.rows[0].name, "Asha Rai");
  } finally {
    client.release();
  }

  const again: any = await previewImport(pool, "website", "partial.csv", uniqueCsv, "test-runner");
  assert.deepEqual(again.committedRowIds, [String(firstRow.id)]);

  const retry = await pool.connect();
  try {
    await retry.query("BEGIN");
    const second = await commitSelectedRows(
      retry,
      again.batchId,
      [String(firstRow.id), String(secondRow.id)],
      new Set(),
      "test-runner",
    );
    await retry.query("COMMIT");
    assert.deepEqual(second.committedRowIds, [String(secondRow.id)]);
    assert.equal(second.skipped.length, 1);
    assert.equal(second.skipped[0].rowId, String(firstRow.id));
    assert.match(second.skipped[0].reason, /already exists/);
  } finally {
    retry.release();
  }
});

test.after(async () => {
  await pool.end();
});
