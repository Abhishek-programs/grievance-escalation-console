-- Store complete, versioned calendar assumptions.
CREATE TABLE policy_configs (
  id BIGSERIAL PRIMARY KEY,
  policy_version TEXT UNIQUE NOT NULL,
  timezone TEXT NOT NULL,
  working_iso_days INTEGER[] NOT NULL,
  allowed_working_days INTEGER NOT NULL CHECK (allowed_working_days > 0),
  deadline_inclusivity TEXT NOT NULL CHECK (deadline_inclusivity IN ('DUE_THROUGH_END_OF_DAY','OVERDUE_ON_DUE_DATE')),
  missing_date_behavior TEXT NOT NULL CHECK (missing_date_behavior='NEEDS_CLARIFICATION'),
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE calendar_holidays (
  id BIGSERIAL PRIMARY KEY,
  policy_id BIGINT NOT NULL REFERENCES policy_configs(id),
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  UNIQUE(policy_id,holiday_date)
);

-- Seed a Nepal demo policy with selected 2083 holiday dates.
INSERT INTO policy_configs
  (policy_version,timezone,working_iso_days,allowed_working_days,deadline_inclusivity,missing_date_behavior,effective_from)
VALUES
  ('NP-GRIEVANCE-2026-V1','Asia/Kathmandu','{1,2,3,4,5}',5,'DUE_THROUGH_END_OF_DAY','NEEDS_CLARIFICATION','2026-04-14');
INSERT INTO calendar_holidays(policy_id,holiday_date,name,source_url)
SELECT p.id,h.day::date,h.name,'https://moha.gov.np/en/page/government-and-public-holidays-in-2083'
FROM policy_configs p
CROSS JOIN (VALUES
  ('2026-10-20','Dashain holiday'),
  ('2026-10-21','Dashain holiday'),
  ('2026-11-11','Tihar holiday')
) AS h(day,name)
WHERE p.policy_version='NP-GRIEVANCE-2026-V1';