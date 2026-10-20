import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { recordDecision } from "../src/decision-service.ts";

const pool = new Pool({
  connectionString:
    "postgres://app:local-development-only@localhost:5432/grievances",
});
test("a follow-up failure rolls back the decision", async () => {
  const evaluation = await pool.query(
    "SELECT id FROM evaluations WHERE recommended_department_id IS NULL ORDER BY id DESC LIMIT 1",
  );
  if (!evaluation.rows[0]) return;
  const evaluationId = String(evaluation.rows[0].id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(() =>
      recordDecision(client, {
        evaluationId,
        decision: "APPROVED",
        actorId: "test-supervisor",
      }),
    );
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
  const decisions = await pool.query(
    "SELECT id FROM review_decisions WHERE evaluation_id=$1",
    [evaluationId],
  );
  assert.equal(decisions.rowCount, 0);
});
test.after(async () => pool.end());
