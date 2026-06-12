
// activate admin

update public.admins
set
  status = 'ACTIVE',
  reviewed_at = now(),
  updated_at = now()
where email = 'admin-email@example.com';

// Reject admin

update public.admins
set
  status = 'REJECTED',
  reviewed_at = now(),
  updated_at = now(),
  rejection_reason = 'Not approved'
where email = 'admin-email@example.com';


// pending admin

select id, email, name, phone, nid_number, education, education_field, status, created_at
from public.admins
where status = 'PENDING'
order by created_at desc;


test sql: 

SQL 


Join Example : Display crime reports with reporter information.


SELECT 
    cr.id,
    cr.title,
    up.full_name AS reporter,
    cr.status,
    cr.severity
FROM app.crime_reports cr
JOIN app.user_profiles up
ON cr.reporter_id = up.id;


Aggregation example : Count crimes by severity level.


SELECT 
    severity,
    COUNT(*) AS total_crimes
FROM app.crime_reports
GROUP BY severity;



group by example: Find crime count by category.


SELECT
    cc.name AS category,
    COUNT(cr.id) AS crime_count
FROM app.crime_reports cr
JOIN app.crime_categories cc
ON cr.category_id = cc.id
GROUP BY cc.name;

