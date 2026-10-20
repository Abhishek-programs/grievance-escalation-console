import type { Pool } from "pg";

function visibleTo(viewerId: string | null) {
  return viewerId
    ? { sql: "(owner_user_id IS NULL OR owner_user_id=$1)", values: [viewerId] }
    : { sql: "owner_user_id IS NULL", values: [] };
}

export async function dashboardMetrics(pool: Pool, viewerId: string | null) {
  // Count operational queues from the same state used by the table.
  const visible = visibleTo(viewerId);
  const result = await pool.query(`SELECT
    count(*) FILTER (WHERE normalized_status<>'RESOLVED') AS open,
    count(*) FILTER (WHERE recommendation_outcome='ESCALATE') AS overdue,
    count(*) FILTER (WHERE department_id IS NULL) AS missing_department,
    count(*) FILTER (WHERE department_id IS NOT NULL AND employee_id IS NULL) AS unassigned_employee,
    count(*) FILTER (WHERE follow_up_status='OPEN') AS waiting_on_team,
    count(*) FILTER (WHERE decision='REJECTED') AS rejected
    FROM case_operational_state WHERE ${visible.sql}`, visible.values);
  const row = result.rows[0];

  return {
    open: Number(row.open),
    overdue: Number(row.overdue),
    missingDepartment: Number(row.missing_department),
    unassignedEmployee: Number(row.unassigned_employee),
    waitingOnTeam: Number(row.waiting_on_team),
    rejected: Number(row.rejected),
  };
}

export async function dashboardCases(
  pool: Pool,
  input: {
    bucket?: string;
    departmentId?: string;
    page: number;
    pageSize: number;
    viewerId: string | null;
  },
) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const visible = visibleTo(input.viewerId);
  conditions.push(visible.sql.replaceAll("$1", `$${values.length + 1}`));
  values.push(...visible.values);
  const add = (sql: string, value?: unknown) => {
    conditions.push(sql);
    if (value !== undefined) values.push(value);
  };

  if (input.bucket === "open") add("normalized_status<>'RESOLVED'");
  if (input.bucket === "overdue") add("recommendation_outcome='ESCALATE'");
  if (input.bucket === "missingDepartment") add("department_id IS NULL");
  if (input.bucket === "unassignedEmployee")
    add("department_id IS NOT NULL AND employee_id IS NULL");
  if (input.bucket === "waitingOnTeam") add("follow_up_status='OPEN'");
  if (input.bucket === "rejected") add("decision='REJECTED'");
  if (input.departmentId)
    add(`department_id=$${values.length + 1}`, input.departmentId);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(input.pageSize, (input.page - 1) * input.pageSize);
  const rows = await pool.query(
    `SELECT * FROM case_operational_state ${where} ORDER BY id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const total = await pool.query(
    `SELECT count(*) FROM case_operational_state ${where}`,
    values.slice(0, -2),
  );

  return {
    page: input.page,
    pageSize: input.pageSize,
    total: Number(total.rows[0].count),
    items: rows.rows,
  };
}

export async function caseEvidence(pool: Pool, caseId: string, viewerId: string | null) {
  // Return every layer needed to explain one operational record.
  const [caseRow, evaluations, decisions, followUps, audit] = await Promise.all(
    [
      pool.query(
        `SELECT c.*,ir.original_values,ir.proposed_values,ir.outcome AS import_outcome,ib.source_name,ib.source_platform,ib.imported_at,ib.imported_by FROM cases c JOIN import_rows ir ON ir.id=c.import_row_id JOIN import_batches ib ON ib.id=c.import_batch_id WHERE c.id=$1`,
        [caseId],
      ),
      pool.query(
        "SELECT * FROM evaluations WHERE case_id=$1 ORDER BY evaluated_at DESC,id DESC",
        [caseId],
      ),
      pool.query(
        `SELECT d.* FROM review_decisions d JOIN evaluations e ON e.id=d.evaluation_id WHERE e.case_id=$1 ORDER BY d.decided_at DESC,d.id DESC`,
        [caseId],
      ),
      pool.query(
        "SELECT * FROM follow_up_actions WHERE case_id=$1 ORDER BY created_at DESC,id DESC",
        [caseId],
      ),
      pool.query(
        "SELECT * FROM audit_events WHERE entity_type='case' AND entity_id=$1 ORDER BY event_time,id",
        [caseId],
      ),
    ],
  );

  const record = caseRow.rows[0];
  if (!record) return null;
  const owner = record.owner_user_id == null ? null : String(record.owner_user_id);
  if (owner && owner !== viewerId) return null;
  return {
    case: record,
    writable: owner !== null && owner === viewerId,
    evaluations: evaluations.rows,
    decisions: decisions.rows,
    followUps: followUps.rows,
    audit: audit.rows,
  };
}
