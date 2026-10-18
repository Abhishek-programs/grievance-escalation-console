-- Store the fictional organizational directory.
CREATE TABLE departments (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE employees (
  id BIGSERIAL PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department_id BIGINT NOT NULL REFERENCES departments(id),
  role TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  escalation_level INTEGER NOT NULL CHECK (escalation_level BETWEEN 1 AND 5),
  official_email TEXT,
  official_phone TEXT
);

-- Keep names and contacts fictional in every seed.
INSERT INTO departments (code,name) VALUES
  ('WATER','Water Services'),('ROADS','Roads and Transport'),
  ('HEALTH','Public Health'),('ADMIN','Citizen Administration');

-- Seed fictional staff for deterministic demos.
INSERT INTO employees
  (employee_code,name,department_id,role,active,escalation_level,official_email)
SELECT seed.employee_code,seed.name,d.id,seed.role,TRUE,seed.level,seed.email
FROM (VALUES
  ('EMP-1001','Asha Rai','WATER','Case Officer',1,'asha.rai@example.invalid'),
  ('EMP-1002','Nabin Shrestha','WATER','Supervisor',2,'nabin.shrestha@example.invalid'),
  ('EMP-2001','Mina Gurung','ROADS','Case Officer',1,'mina.gurung@example.invalid'),
  ('EMP-2002','Suman Thapa','ROADS','Supervisor',2,'suman.thapa@example.invalid'),
  ('EMP-3001','Rojina Karki','HEALTH','Case Officer',1,'rojina.karki@example.invalid'),
  ('EMP-4001','Bikash Lama','ADMIN','Review Officer',2,'bikash.lama@example.invalid')
) AS seed(employee_code,name,department_code,role,level,email)
JOIN departments d ON d.code=seed.department_code;

-- Preserve every import and original source row.
CREATE TABLE import_batches (
  id BIGSERIAL PRIMARY KEY,
  source_platform TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_fingerprint TEXT UNIQUE NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL,
  imported_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PREVIEW','COMMITTED','CANCELLED'))
);

CREATE TABLE import_rows (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES import_batches(id),
  row_number INTEGER NOT NULL,
  source_record_id TEXT,
  source_url TEXT,
  original_values JSONB NOT NULL,
  proposed_values JSONB NOT NULL,
  outcome TEXT NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]',
  errors JSONB NOT NULL DEFAULT '[]',
  duplicate_case_id BIGINT,
  UNIQUE(batch_id,row_number)
);

-- Create cases only after a human commits reviewed rows.
CREATE TABLE cases (
  id BIGSERIAL PRIMARY KEY,
  source_platform TEXT NOT NULL,
  source_record_id TEXT,
  source_url TEXT,
  import_batch_id BIGINT NOT NULL REFERENCES import_batches(id),
  import_row_id BIGINT UNIQUE NOT NULL REFERENCES import_rows(id),
  original_values JSONB NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  received_date DATE,
  normalized_status TEXT NOT NULL,
  department_id BIGINT REFERENCES departments(id),
  employee_id BIGINT REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(source_platform,source_record_id)
);