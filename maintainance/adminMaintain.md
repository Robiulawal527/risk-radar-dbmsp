
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