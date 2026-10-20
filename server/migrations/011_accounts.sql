-- A verified visitor owns the cases they import. The seeded desk stays shared and read only.
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_codes (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_ip TEXT
);

CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE import_batches ADD COLUMN owner_user_id BIGINT REFERENCES users(id);
ALTER TABLE cases ADD COLUMN owner_user_id BIGINT REFERENCES users(id);

ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_source_fingerprint_key;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_source_platform_source_record_id_key;

CREATE UNIQUE INDEX import_batches_seed_fingerprint ON import_batches (source_fingerprint) WHERE owner_user_id IS NULL;
CREATE UNIQUE INDEX import_batches_owner_fingerprint ON import_batches (owner_user_id, source_fingerprint) WHERE owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX cases_seed_source ON cases (source_platform, source_record_id) WHERE owner_user_id IS NULL;
CREATE UNIQUE INDEX cases_owner_source ON cases (owner_user_id, source_platform, source_record_id) WHERE owner_user_id IS NOT NULL;

CREATE OR REPLACE VIEW case_operational_state AS
SELECT
  c.id,c.title,c.normalized_status,c.received_date,c.source_platform,
  c.department_id,c.employee_id,d.name AS department_name,
  e.recommendation_outcome,e.calculated_deadline,
  e.recommended_next_step,e.recommendation_reason,
  rd.decision,
  f.id AS follow_up_id,f.status AS follow_up_status,
  f.due_date AS follow_up_due_date,
  emp.name AS employee_name,
  emp.role AS employee_role,
  c.description,
  rd.reason AS decision_reason,
  c.complainant_name,c.phone,c.district,c.local_level,c.ward,c.place,c.category,c.relief_sought,
  c.owner_user_id
FROM cases c
LEFT JOIN departments d ON d.id=c.department_id
LEFT JOIN employees emp ON emp.id=c.employee_id
LEFT JOIN LATERAL (
  SELECT * FROM evaluations
  WHERE case_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1
) e ON TRUE
LEFT JOIN review_decisions rd ON rd.evaluation_id=e.id
LEFT JOIN LATERAL (
  SELECT * FROM follow_up_actions
  WHERE case_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1
) f ON TRUE;
