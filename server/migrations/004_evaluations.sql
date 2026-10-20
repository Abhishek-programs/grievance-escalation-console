-- Append policy evaluations without update or delete paths.
CREATE TABLE evaluations (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES cases(id),
  policy_id BIGINT NOT NULL REFERENCES policy_configs(id),
  policy_version TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  rule_id TEXT NOT NULL,
  input_facts JSONB NOT NULL,
  deadline_calculation JSONB NOT NULL,
  calculated_deadline DATE,
  recommendation_outcome TEXT NOT NULL,
  recommended_next_step TEXT NOT NULL,
  recommendation_reason TEXT NOT NULL,
  recommended_department_id BIGINT REFERENCES departments(id),
  suggested_employee_id BIGINT REFERENCES employees(id),
  next_follow_up_deadline DATE
);
CREATE INDEX evaluations_case_time_idx
  ON evaluations(case_id,evaluated_at DESC,id DESC);

-- Track approved operational work separately from recommendations.
CREATE TABLE follow_up_actions (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES cases(id),
  evaluation_id BIGINT NOT NULL REFERENCES evaluations(id),
  action_text TEXT NOT NULL,
  owner_department_id BIGINT NOT NULL REFERENCES departments(id),
  owner_employee_id BIGINT REFERENCES employees(id),
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN','COMPLETED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);
CREATE INDEX follow_up_case_status_idx
  ON follow_up_actions(case_id,status,due_date);