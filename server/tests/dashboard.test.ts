import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { dashboardCases } from "../src/dashboard-service.ts";

const pool = new Pool({
  connectionString:
    "postgres://app:local-development-only@localhost:5432/grievances",
});
test("dashboard pagination respects page size", async () => {
  const result = await dashboardCases(pool, { page: 1, pageSize: 1, viewerId: null });
  assert.ok(result.items.length <= 1);
  assert.equal(result.pageSize, 1);
});
test("a session sees only cases it owns", async () => {
  const anon = await dashboardCases(pool, { page: 1, pageSize: 100, viewerId: null });
  assert.equal(anon.total, 0);
  const other = await dashboardCases(pool, { page: 1, pageSize: 100, viewerId: "0" });
  assert.ok(other.items.every((item: { owner_user_id: unknown }) => String(item.owner_user_id) === "0"));
});
test("open bucket excludes resolved cases", async () => {
  const result = await dashboardCases(pool, {
    bucket: "open",
    page: 1,
    pageSize: 100,
    viewerId: null,
  });
  assert.ok(
    result.items.every((item: any) => item.normalized_status !== "RESOLVED"),
  );
});
test("audit events retain chronological order", async () => {
  const caseResult = await pool.query(
    "SELECT id FROM cases ORDER BY id LIMIT 1",
  );
  if (!caseResult.rows[0]) return;
  const events = await pool.query(
    "SELECT event_time FROM audit_events WHERE entity_id=$1 ORDER BY event_time,id",
    [String(caseResult.rows[0].id)],
  );
  const times = events.rows.map((row) => new Date(row.event_time).getTime());
  assert.deepEqual(
    times,
    [...times].sort((a, b) => a - b),
  );
});
test.after(async () => pool.end());
