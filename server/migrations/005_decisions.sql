-- Keep human decisions separate from policy recommendations.
CREATE TABLE review_decisions (
  id BIGSERIAL PRIMARY KEY,
  evaluation_id BIGINT UNIQUE NOT NULL REFERENCES evaluations(id),
  decision TEXT NOT NULL CHECK (decision IN (
    'APPROVED','REJECTED','REASSIGNED','CLARIFICATION_REQUESTED'
  )),
  reason TEXT,
  decided_by TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  owner_department_id BIGINT REFERENCES departments(id),
  owner_employee_id BIGINT REFERENCES employees(id),
  CHECK (
    decision='APPROVED'
    OR length(trim(COALESCE(reason,''))) > 0
  )
);