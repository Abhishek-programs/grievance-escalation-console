-- Fill departments for cases already imported from keyword titles.
UPDATE cases AS c
SET department_id = d.id
FROM departments AS d
WHERE c.department_id IS NULL
  AND d.code = CASE
    WHEN lower(c.title || ' ' || coalesce(c.description, '')) LIKE '%water%' THEN 'WATER'
    WHEN lower(c.title || ' ' || coalesce(c.description, '')) LIKE '%road%'
      OR lower(c.title || ' ' || coalesce(c.description, '')) LIKE '%transport%' THEN 'ROADS'
    WHEN lower(c.title || ' ' || coalesce(c.description, '')) LIKE '%clinic%'
      OR lower(c.title || ' ' || coalesce(c.description, '')) LIKE '%health%' THEN 'HEALTH'
    WHEN lower(c.title || ' ' || coalesce(c.description, '')) LIKE '%certificate%'
      OR lower(c.title || ' ' || coalesce(c.description, '')) LIKE '%administration%' THEN 'ADMIN'
  END;
