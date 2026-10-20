-- Present current operational state without deleting history.
CREATE VIEW case_operational_state AS
SELECT
  c.id,c.title,c.normalized_status,c.received_date,c.source_platform,
  c.department_id,c.employee_id,d.name AS department_name,
  e.recommendation_outcome,e.calculated_deadline,
  e.recommended_next_step,e.recommendation_reason,
  rd.decision,
  f.id AS follow_up_id,f.status AS follow_up_status,
  f.due_date AS follow_up_due_date
FROM cases c
LEFT JOIN departments d ON d.id=c.department_id
LEFT JOIN LATERAL (
  SELECT * FROM evaluations
  WHERE case_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1
) e ON TRUE
LEFT JOIN review_decisions rd ON rd.evaluation_id=e.id
LEFT JOIN LATERAL (
  SELECT * FROM follow_up_actions
  WHERE case_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1
) f ON TRUE;