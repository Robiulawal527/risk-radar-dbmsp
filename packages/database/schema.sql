
begin;

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists postgis;

create schema if not exists app;
create schema if not exists legacy_import;

-- ---------- Helpers ----------
create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function app.current_user_id()
returns uuid language sql stable as $$
  select auth.uid();
$$;

create or replace function app.normalize_user_role(value text)
returns text language sql immutable as $$
  select case lower(coalesce(nullif(btrim(value), ''), 'user'))
    when 'admin' then 'admin'
    when 'volunteer' then 'volunteer'
    else 'user'
  end;
$$;

create or replace function app.normalize_crime_report_status(value text)
returns text language sql immutable as $$
  select case upper(coalesce(nullif(btrim(value), ''), 'PENDING'))
    when 'REPORTED' then 'PENDING'
    when 'UNDER_REVIEW' then 'PENDING'
    when 'PENDING' then 'PENDING'
    when 'APPROVED' then 'APPROVED'
    when 'REJECTED' then 'REJECTED'
    when 'RESOLVED' then 'RESOLVED'
    when 'ACTIVE' then 'ACTIVE'
    else 'PENDING'
  end;
$$;

create or replace function app.normalize_admin_status(value text)
returns text language sql immutable as $$
  select case upper(coalesce(nullif(btrim(value), ''), 'PENDING'))
    when 'ACTIVE' then 'ACTIVE'
    when 'APPROVED' then 'ACTIVE'
    when 'VERIFIED' then 'ACTIVE'
    when 'ENABLED' then 'ACTIVE'
    when 'REJECTED' then 'REJECTED'
    when 'SUSPENDED' then 'SUSPENDED'
    else 'PENDING'
  end;
$$;

create or replace function app.normalize_volunteer_status(value text)
returns text language sql immutable as $$
  select case upper(coalesce(nullif(btrim(value), ''), 'PENDING'))
    when 'ACTIVE' then 'ACTIVE'
    when 'INACTIVE' then 'INACTIVE'
    when 'SUSPENDED' then 'SUSPENDED'
    else 'PENDING'
  end;
$$;

create or replace function app.normalize_sos_status(value text)
returns text language sql immutable as $$
  select case upper(coalesce(nullif(btrim(value), ''), 'ACTIVE'))
    when 'RESOLVED' then 'RESOLVED'
    when 'CANCELLED' then 'CANCELLED'
    when 'FALSE_ALARM' then 'FALSE_ALARM'
    else 'ACTIVE'
  end;
$$;

create or replace function app.normalize_criminal_record_status(value text)
returns text language sql immutable as $$
  select case upper(coalesce(nullif(btrim(value), ''), 'ACTIVE'))
    when 'ACTIVE' then 'ACTIVE'
    when 'INACTIVE' then 'INACTIVE'
    when 'WANTED' then 'WANTED'
    when 'ARRESTED' then 'ARRESTED'
    else 'UNKNOWN'
  end;
$$;


-- ---------- Legacy import tables: matches your uploaded row files ----------
create table if not exists legacy_import.profiles (
  id uuid primary key,
  full_name text,
  role text,
  created_at timestamptz,
  email citext,
  phone text,
  avatar text,
  updated_at timestamptz,
  skills text[],
  alert_latitude double precision,
  alert_longitude double precision,
  alerts_enabled boolean
);
create table if not exists legacy_import.admins (
  id uuid primary key,
  email citext,
  name text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  phone text,
  nid_number text,
  education text,
  education_field text,
  photo_url text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text
);
create table if not exists legacy_import.volunteers (
  id uuid primary key,
  name text,
  email citext,
  phone text,
  avatar text,
  skills text[],
  status text,
  activity_count integer,
  intensity integer,
  score integer,
  created_at timestamptz,
  updated_at timestamptz
);
create table if not exists legacy_import.crimes (
  id uuid primary key,
  user_id uuid,
  type text,
  category text,
  title text,
  description text,
  latitude double precision,
  longitude double precision,
  address text,
  area text,
  district text,
  division text,
  severity text,
  reported_by text,
  status text,
  date_time timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
create table if not exists legacy_import.sos_alerts (
  id bigint primary key,
  user_id uuid,
  status text,
  latitude double precision,
  longitude double precision,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz
);
create table if not exists legacy_import.criminal_records (
  id uuid primary key,
  name text,
  age integer,
  gender text,
  description text,
  known_aliases text[],
  photo_url text,
  status text,
  crime_count integer,
  intensity integer,
  most_frequent_crime text,
  score integer,
  created_at timestamptz,
  updated_at timestamptz
);

-- ---------- Normalized app tables ----------
create table if not exists app.user_profiles (
  id uuid primary key,
  full_name text not null default '',
  role text not null default 'user' check (role in ('user','admin','volunteer')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.user_private_contacts (
  user_id uuid primary key references app.user_profiles(id) on delete cascade,
  email citext unique,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phone_reasonable check (phone is null or phone ~ '^[+0-9 ()-]{7,20}$')
);

create table if not exists app.profile_alert_settings (
  user_id uuid primary key references app.user_profiles(id) on delete cascade,
  alert_location geography(Point,4326),
  alerts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists app.skill_catalog (
  id bigserial primary key,
  name citext not null unique
);

create table if not exists app.user_skills (
  user_id uuid not null references app.user_profiles(id) on delete cascade,
  skill_id bigint not null references app.skill_catalog(id) on delete restrict,
  primary key (user_id, skill_id)
);

create table if not exists app.admin_profiles (
  user_id uuid primary key references app.user_profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','REJECTED','SUSPENDED')),
  education text,
  education_field text,
  reviewed_by uuid references app.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extra-sensitive admin-only data. NID is isolated from the profile/admin public views.
create table if not exists app.admin_sensitive_data (
  user_id uuid primary key references app.admin_profiles(user_id) on delete cascade,
  nid_number text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- SECURITY DEFINER avoids recursive RLS checks when policies need admin status.
-- Created after app.admin_profiles exists, so Supabase/Postgres can validate the reference.
create or replace function app.is_active_admin()
returns boolean
language sql
security definer
set search_path = app, public
stable
as $$
  select coalesce(auth.role() = 'service_role', false)
     or exists (
       select 1 from app.admin_profiles ap
       where ap.user_id = auth.uid() and ap.status = 'ACTIVE'
     );
$$;

create table if not exists app.volunteer_profiles (
  user_id uuid primary key references app.user_profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','INACTIVE','SUSPENDED')),
  activity_count integer not null default 0 check (activity_count >= 0),
  intensity integer not null default 0 check (intensity >= 0),
  score integer not null default 0 check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.crime_types (
  id bigserial primary key,
  name citext not null unique
);
create table if not exists app.crime_categories (
  id bigserial primary key,
  name citext not null unique
);

create table if not exists app.geo_locations (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  location geography(Point,4326),
  address text,
  area text,
  district text,
  division text,
  created_at timestamptz not null default now(),
  constraint valid_location check (location is null or (st_y(location::geometry) between -90 and 90 and st_x(location::geometry) between -180 and 180))
);
create index if not exists geo_locations_location_gix on app.geo_locations using gist(location);
create index if not exists geo_locations_area_idx on app.geo_locations(area, district, division);

create table if not exists app.crime_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references app.user_profiles(id) on delete set null,
  type_id bigint references app.crime_types(id) on delete restrict,
  category_id bigint references app.crime_categories(id) on delete restrict,
  title text not null,
  description text,
  location_id uuid references app.geo_locations(id) on delete set null,
  severity text not null default 'LOW' check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  reported_by_text text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','RESOLVED','ACTIVE')),
  date_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crime_reports_reporter_idx on app.crime_reports(reporter_id);
create index if not exists crime_reports_date_idx on app.crime_reports(date_time desc);
create index if not exists crime_reports_status_idx on app.crime_reports(status);
create index if not exists crime_reports_type_category_idx on app.crime_reports(type_id, category_id);

create table if not exists app.sos_alerts_core (
  id bigint primary key,
  user_id uuid references app.user_profiles(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RESOLVED','CANCELLED','FALSE_ALARM')),
  location_id uuid references app.geo_locations(id) on delete set null,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists sos_alerts_user_idx on app.sos_alerts_core(user_id);
create index if not exists sos_alerts_status_idx on app.sos_alerts_core(status);

create table if not exists app.criminal_records_core (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age integer check (age is null or age between 0 and 130),
  gender text,
  description text,
  photo_url text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','WANTED','ARRESTED','UNKNOWN')),
  crime_count integer not null default 0 check (crime_count >= 0),
  intensity integer not null default 0 check (intensity >= 0),
  most_frequent_crime text,
  score integer not null default 0 check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists app.criminal_record_aliases (
  criminal_record_id uuid not null references app.criminal_records_core(id) on delete cascade,
  alias text not null,
  primary key(criminal_record_id, alias)
);

-- Triggers
drop trigger if exists set_updated_at_user_profiles on app.user_profiles;
create trigger set_updated_at_user_profiles before update on app.user_profiles for each row execute function app.set_updated_at();
drop trigger if exists set_updated_at_user_private_contacts on app.user_private_contacts;
create trigger set_updated_at_user_private_contacts before update on app.user_private_contacts for each row execute function app.set_updated_at();
drop trigger if exists set_updated_at_admin_profiles on app.admin_profiles;
create trigger set_updated_at_admin_profiles before update on app.admin_profiles for each row execute function app.set_updated_at();
drop trigger if exists set_updated_at_admin_sensitive on app.admin_sensitive_data;
create trigger set_updated_at_admin_sensitive before update on app.admin_sensitive_data for each row execute function app.set_updated_at();
drop trigger if exists set_updated_at_volunteer_profiles on app.volunteer_profiles;
create trigger set_updated_at_volunteer_profiles before update on app.volunteer_profiles for each row execute function app.set_updated_at();
drop trigger if exists set_updated_at_crime_reports on app.crime_reports;
create trigger set_updated_at_crime_reports before update on app.crime_reports for each row execute function app.set_updated_at();
drop trigger if exists set_updated_at_sos on app.sos_alerts_core;
create trigger set_updated_at_sos before update on app.sos_alerts_core for each row execute function app.set_updated_at();
drop trigger if exists set_updated_at_criminal_records on app.criminal_records_core;
create trigger set_updated_at_criminal_records before update on app.criminal_records_core for each row execute function app.set_updated_at();

-- ---------- Compatibility views with old table names ----------
drop view if exists public.profiles cascade;
create view public.profiles with (security_invoker = true) as
select p.id, p.full_name, p.role, p.created_at, c.email, c.phone, p.avatar_url as avatar, p.updated_at,
       coalesce(array_agg(sc.name::text order by sc.name) filter (where sc.id is not null), '{}') as skills,
       st_y(s.alert_location::geometry) as alert_latitude,
       st_x(s.alert_location::geometry) as alert_longitude,
       coalesce(s.alerts_enabled,false) as alerts_enabled
from app.user_profiles p
left join app.user_private_contacts c on c.user_id = p.id
left join app.profile_alert_settings s on s.user_id = p.id
left join app.user_skills us on us.user_id = p.id
left join app.skill_catalog sc on sc.id = us.skill_id
group by p.id, c.email, c.phone, s.alert_location, s.alerts_enabled;

drop view if exists public.admins cascade;
create view public.admins with (security_invoker = true) as
select p.id, c.email, p.full_name as name, a.status, a.created_at, a.updated_at,
       c.phone, sd.nid_number, a.education, a.education_field, sd.photo_url,
       a.reviewed_by, a.reviewed_at, a.rejection_reason
from app.admin_profiles a
join app.user_profiles p on p.id = a.user_id
left join app.user_private_contacts c on c.user_id = p.id
left join app.admin_sensitive_data sd on sd.user_id = p.id;

drop view if exists public.volunteers cascade;
create view public.volunteers with (security_invoker = true) as
select p.id, p.full_name as name, c.email, c.phone, p.avatar_url as avatar,
       coalesce(array_agg(sc.name::text order by sc.name) filter (where sc.id is not null), '{}') as skills,
       v.status, v.activity_count, v.intensity, v.score, v.created_at, v.updated_at
from app.volunteer_profiles v
join app.user_profiles p on p.id = v.user_id
left join app.user_private_contacts c on c.user_id = p.id
left join app.user_skills us on us.user_id = p.id
left join app.skill_catalog sc on sc.id = us.skill_id
group by p.id, c.email, c.phone, v.status, v.activity_count, v.intensity, v.score, v.created_at, v.updated_at;

drop view if exists public.crimes cascade;
create view public.crimes with (security_invoker = true) as
select cr.id, cr.reporter_id as user_id, ct.name::text as type, cc.name::text as category,
       cr.title, cr.description, st_y(gl.location::geometry) as latitude, st_x(gl.location::geometry) as longitude,
       gl.address, gl.area, gl.district, gl.division, cr.severity, cr.reported_by_text as reported_by,
       cr.status, cr.date_time, cr.created_at, cr.updated_at
from app.crime_reports cr
left join app.crime_types ct on ct.id = cr.type_id
left join app.crime_categories cc on cc.id = cr.category_id
left join app.geo_locations gl on gl.id = cr.location_id;

drop view if exists public.sos_alerts cascade;
create view public.sos_alerts with (security_invoker = true) as
select s.id, s.user_id, s.status, st_y(gl.location::geometry) as latitude, st_x(gl.location::geometry) as longitude,
       s.message, s.created_at, s.updated_at, s.resolved_at
from app.sos_alerts_core s
left join app.geo_locations gl on gl.id = s.location_id;

drop view if exists public.criminal_records cascade;
create view public.criminal_records with (security_invoker = true) as
select r.id, r.name, r.age, r.gender, r.description,
       coalesce(array_agg(a.alias order by a.alias) filter (where a.alias is not null), '{}') as known_aliases,
       r.photo_url, r.status, r.crime_count, r.intensity, r.most_frequent_crime, r.score, r.created_at, r.updated_at
from app.criminal_records_core r
left join app.criminal_record_aliases a on a.criminal_record_id = r.id
group by r.id;

-- ---------- RLS ----------
alter table app.user_profiles enable row level security;
alter table app.user_private_contacts enable row level security;
alter table app.profile_alert_settings enable row level security;
alter table app.skill_catalog enable row level security;
alter table app.user_skills enable row level security;
alter table app.admin_profiles enable row level security;
alter table app.admin_sensitive_data enable row level security;
alter table app.volunteer_profiles enable row level security;
alter table app.crime_types enable row level security;
alter table app.crime_categories enable row level security;
alter table app.geo_locations enable row level security;
alter table app.crime_reports enable row level security;
alter table app.sos_alerts_core enable row level security;
alter table app.criminal_records_core enable row level security;
alter table app.criminal_record_aliases enable row level security;

-- Drop old policy names if re-running
drop policy if exists user_profiles_select_safe on app.user_profiles;
drop policy if exists user_profiles_insert_self on app.user_profiles;
drop policy if exists user_profiles_update_self_admin on app.user_profiles;
drop policy if exists private_contacts_owner_admin on app.user_private_contacts;
drop policy if exists private_contacts_insert_owner_admin on app.user_private_contacts;
drop policy if exists private_contacts_update_owner_admin on app.user_private_contacts;
drop policy if exists alert_settings_owner_admin on app.profile_alert_settings;
drop policy if exists alert_settings_write_owner_admin on app.profile_alert_settings;
drop policy if exists skill_catalog_read on app.skill_catalog;
drop policy if exists skill_catalog_admin_write on app.skill_catalog;
drop policy if exists user_skills_read on app.user_skills;
drop policy if exists user_skills_write_owner_admin on app.user_skills;
drop policy if exists admin_profiles_select_admin_or_self on app.admin_profiles;
drop policy if exists admin_profiles_write_admin on app.admin_profiles;
drop policy if exists admin_sensitive_select_admin_or_self on app.admin_sensitive_data;
drop policy if exists admin_sensitive_write_admin on app.admin_sensitive_data;
drop policy if exists volunteer_profiles_read on app.volunteer_profiles;
drop policy if exists volunteer_profiles_write_self_admin on app.volunteer_profiles;
drop policy if exists crime_lookup_read on app.crime_types;
drop policy if exists crime_lookup_admin_write on app.crime_types;
drop policy if exists crime_category_read on app.crime_categories;
drop policy if exists crime_category_admin_write on app.crime_categories;
drop policy if exists geo_locations_read_public on app.geo_locations;
drop policy if exists geo_locations_insert_auth on app.geo_locations;
drop policy if exists geo_locations_update_admin on app.geo_locations;
drop policy if exists crime_reports_read_public on app.crime_reports;
drop policy if exists crime_reports_insert_auth on app.crime_reports;
drop policy if exists crime_reports_update_owner_admin on app.crime_reports;
drop policy if exists crime_reports_delete_admin on app.crime_reports;
drop policy if exists sos_select_owner_admin on app.sos_alerts_core;
drop policy if exists sos_insert_owner on app.sos_alerts_core;
drop policy if exists sos_update_owner_admin on app.sos_alerts_core;
drop policy if exists criminal_records_read_admin on app.criminal_records_core;
drop policy if exists criminal_records_read_public on app.criminal_records_core;
drop policy if exists criminal_records_write_admin on app.criminal_records_core;
drop policy if exists criminal_aliases_read_admin on app.criminal_record_aliases;
drop policy if exists criminal_aliases_read_public on app.criminal_record_aliases;
drop policy if exists criminal_aliases_write_admin on app.criminal_record_aliases;
-- Profiles: public can see safe identity data; private contact/settings are owner/admin only.
create policy user_profiles_select_safe on app.user_profiles for select using (true);
create policy user_profiles_insert_self on app.user_profiles for insert with check (id = auth.uid() or app.is_active_admin());
create policy user_profiles_update_self_admin on app.user_profiles for update using (id = auth.uid() or app.is_active_admin()) with check (id = auth.uid() or app.is_active_admin());

create policy private_contacts_owner_admin on app.user_private_contacts for select using (user_id = auth.uid() or app.is_active_admin());
create policy private_contacts_insert_owner_admin on app.user_private_contacts for insert with check (user_id = auth.uid() or app.is_active_admin());
create policy private_contacts_update_owner_admin on app.user_private_contacts for update using (user_id = auth.uid() or app.is_active_admin()) with check (user_id = auth.uid() or app.is_active_admin());

create policy alert_settings_owner_admin on app.profile_alert_settings for select using (user_id = auth.uid() or app.is_active_admin());
create policy alert_settings_write_owner_admin on app.profile_alert_settings for all using (user_id = auth.uid() or app.is_active_admin()) with check (user_id = auth.uid() or app.is_active_admin());

create policy skill_catalog_read on app.skill_catalog for select using (true);
create policy skill_catalog_admin_write on app.skill_catalog for all using (app.is_active_admin()) with check (app.is_active_admin());
create policy user_skills_read on app.user_skills for select using (true);
create policy user_skills_write_owner_admin on app.user_skills for all using (user_id = auth.uid() or app.is_active_admin()) with check (user_id = auth.uid() or app.is_active_admin());

create policy admin_profiles_select_admin_or_self on app.admin_profiles for select using (user_id = auth.uid() or app.is_active_admin());
create policy admin_profiles_write_admin on app.admin_profiles for all using (app.is_active_admin()) with check (app.is_active_admin());
create policy admin_sensitive_select_admin_or_self on app.admin_sensitive_data for select using (user_id = auth.uid() or app.is_active_admin());
create policy admin_sensitive_write_admin on app.admin_sensitive_data for all using (app.is_active_admin()) with check (app.is_active_admin());

create policy volunteer_profiles_read on app.volunteer_profiles for select using (true);
create policy volunteer_profiles_write_self_admin on app.volunteer_profiles for all using (user_id = auth.uid() or app.is_active_admin()) with check (user_id = auth.uid() or app.is_active_admin());

create policy crime_lookup_read on app.crime_types for select using (true);
create policy crime_lookup_admin_write on app.crime_types for all using (app.is_active_admin()) with check (app.is_active_admin());
create policy crime_category_read on app.crime_categories for select using (true);
create policy crime_category_admin_write on app.crime_categories for all using (app.is_active_admin()) with check (app.is_active_admin());

create policy geo_locations_read_public on app.geo_locations for select using (true);
create policy geo_locations_insert_auth on app.geo_locations for insert with check (auth.uid() is not null or app.is_active_admin());
create policy geo_locations_update_admin on app.geo_locations for update using (app.is_active_admin()) with check (app.is_active_admin());

create policy crime_reports_read_public on app.crime_reports for select using (true);
create policy crime_reports_insert_auth on app.crime_reports for insert with check (reporter_id = auth.uid() or reporter_id is null or app.is_active_admin());
create policy crime_reports_update_owner_admin on app.crime_reports for update using (reporter_id = auth.uid() or app.is_active_admin()) with check (reporter_id = auth.uid() or app.is_active_admin());
create policy crime_reports_delete_admin on app.crime_reports for delete using (app.is_active_admin());

create policy sos_select_owner_admin on app.sos_alerts_core for select using (user_id = auth.uid() or app.is_active_admin());
create policy sos_insert_owner on app.sos_alerts_core for insert with check (user_id = auth.uid() or app.is_active_admin());
create policy sos_update_owner_admin on app.sos_alerts_core for update using (user_id = auth.uid() or app.is_active_admin()) with check (user_id = auth.uid() or app.is_active_admin());

create policy criminal_records_read_public on app.criminal_records_core for select using (true);
create policy criminal_records_write_admin on app.criminal_records_core for all using (app.is_active_admin()) with check (app.is_active_admin());
create policy criminal_aliases_read_public on app.criminal_record_aliases for select using (true);
create policy criminal_aliases_write_admin on app.criminal_record_aliases for all using (app.is_active_admin()) with check (app.is_active_admin());

-- Grants for Supabase roles. RLS still controls the actual rows/columns through underlying tables.
grant usage on schema app to anon, authenticated, service_role;
grant select on public.profiles, public.volunteers, public.crimes, public.sos_alerts, public.admins, public.criminal_records to anon, authenticated;
grant select, insert, update, delete on all tables in schema app to authenticated, service_role;
grant usage, select on all sequences in schema app to authenticated, service_role;
revoke all on schema legacy_import from anon, authenticated;


-- ---------- Compatibility write triggers ----------
-- These allow the old app code to keep inserting/updating the old public table names.
create or replace function app.write_public_profiles()
returns trigger language plpgsql security definer set search_path=app,public as $$
declare skill text;
begin
  insert into app.user_profiles(id, full_name, role, avatar_url, created_at, updated_at)
  values (new.id, coalesce(new.full_name,''), app.normalize_user_role(new.role), new.avatar, coalesce(new.created_at,now()), coalesce(new.updated_at,now()))
  on conflict(id) do update set full_name=excluded.full_name, role=excluded.role, avatar_url=excluded.avatar_url, updated_at=now();
  insert into app.user_private_contacts(user_id,email,phone) values(new.id,new.email,new.phone)
  on conflict(user_id) do update set email=excluded.email, phone=excluded.phone, updated_at=now();
  insert into app.profile_alert_settings(user_id, alert_location, alerts_enabled)
  values(new.id, case when new.alert_latitude is not null and new.alert_longitude is not null then st_setsrid(st_makepoint(new.alert_longitude,new.alert_latitude),4326)::geography end, coalesce(new.alerts_enabled,false))
  on conflict(user_id) do update set alert_location=excluded.alert_location, alerts_enabled=excluded.alerts_enabled, updated_at=now();
  delete from app.user_skills where user_id=new.id;
  if new.skills is not null then
    foreach skill in array new.skills loop
      insert into app.skill_catalog(name) values(skill) on conflict(name) do nothing;
      insert into app.user_skills(user_id,skill_id) select new.id,id from app.skill_catalog where name=skill::citext on conflict do nothing;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists write_public_profiles on public.profiles;
create trigger write_public_profiles instead of insert or update on public.profiles for each row execute function app.write_public_profiles();

create or replace function app.write_public_crimes()
returns trigger language plpgsql security definer set search_path=app,public as $$
declare v_type_id bigint; v_cat_id bigint; v_loc_id uuid;
begin
  if new.type is not null then insert into app.crime_types(name) values(new.type) on conflict(name) do nothing; select id into v_type_id from app.crime_types where name=new.type::citext; end if;
  if new.category is not null then insert into app.crime_categories(name) values(new.category) on conflict(name) do nothing; select id into v_cat_id from app.crime_categories where name=new.category::citext; end if;
  if tg_op='UPDATE' then
    select location_id into v_loc_id from app.crime_reports where id=old.id;
  end if;
  if v_loc_id is null then v_loc_id := gen_random_uuid(); end if;
  insert into app.geo_locations(id, location, address, area, district, division)
  values(v_loc_id, case when new.latitude is not null and new.longitude is not null then st_setsrid(st_makepoint(new.longitude,new.latitude),4326)::geography end, new.address, new.area, new.district, new.division)
  on conflict(id) do update set location=excluded.location, address=excluded.address, area=excluded.area, district=excluded.district, division=excluded.division;
  insert into app.crime_reports(id,reporter_id,type_id,category_id,title,description,location_id,severity,reported_by_text,status,date_time,created_at,updated_at)
  values(coalesce(new.id,gen_random_uuid()), new.user_id, v_type_id, v_cat_id, coalesce(new.title,'Untitled report'), new.description, v_loc_id, upper(coalesce(new.severity,'LOW')), new.reported_by, app.normalize_crime_report_status(new.status), new.date_time, coalesce(new.created_at,now()), coalesce(new.updated_at,now()))
  on conflict(id) do update set reporter_id=excluded.reporter_id, type_id=excluded.type_id, category_id=excluded.category_id, title=excluded.title, description=excluded.description, location_id=excluded.location_id, severity=excluded.severity, reported_by_text=excluded.reported_by_text, status=excluded.status, date_time=excluded.date_time, updated_at=now();
  return new;
end $$;
drop trigger if exists write_public_crimes on public.crimes;
create trigger write_public_crimes instead of insert or update on public.crimes for each row execute function app.write_public_crimes();

create or replace function app.write_public_sos_alerts()
returns trigger language plpgsql security definer set search_path=app,public as $$
declare v_loc_id uuid;
begin
  if tg_op='UPDATE' then select location_id into v_loc_id from app.sos_alerts_core where id=old.id; end if;
  if v_loc_id is null then v_loc_id := gen_random_uuid(); end if;
  insert into app.geo_locations(id, location)
  values(v_loc_id, case when new.latitude is not null and new.longitude is not null then st_setsrid(st_makepoint(new.longitude,new.latitude),4326)::geography end)
  on conflict(id) do update set location=excluded.location;
  insert into app.sos_alerts_core(id,user_id,status,location_id,message,created_at,updated_at,resolved_at)
  values(new.id,new.user_id,app.normalize_sos_status(new.status),v_loc_id,new.message,coalesce(new.created_at,now()),coalesce(new.updated_at,now()),new.resolved_at)
  on conflict(id) do update set user_id=excluded.user_id,status=excluded.status,location_id=excluded.location_id,message=excluded.message,updated_at=now(),resolved_at=excluded.resolved_at;
  return new;
end $$;
drop trigger if exists write_public_sos_alerts on public.sos_alerts;
create trigger write_public_sos_alerts instead of insert or update on public.sos_alerts for each row execute function app.write_public_sos_alerts();

create or replace function app.write_public_volunteers()
returns trigger language plpgsql security definer set search_path=app,public as $$
declare skill text;
begin
  insert into app.user_profiles(id, full_name, role, avatar_url, created_at, updated_at)
  values(new.id, coalesce(new.name,'Volunteer'), 'volunteer', new.avatar, coalesce(new.created_at,now()), coalesce(new.updated_at,now()))
  on conflict(id) do update set full_name=excluded.full_name, role='volunteer', avatar_url=excluded.avatar_url, updated_at=now();
  insert into app.user_private_contacts(user_id,email,phone) values(new.id,new.email,new.phone)
  on conflict(user_id) do update set email=excluded.email, phone=excluded.phone, updated_at=now();
  insert into app.volunteer_profiles(user_id,status,activity_count,intensity,score,created_at,updated_at)
  values(new.id,app.normalize_volunteer_status(new.status),coalesce(new.activity_count,0),coalesce(new.intensity,0),coalesce(new.score,0),coalesce(new.created_at,now()),coalesce(new.updated_at,now()))
  on conflict(user_id) do update set status=excluded.status, activity_count=excluded.activity_count, intensity=excluded.intensity, score=excluded.score, updated_at=now();
  delete from app.user_skills where user_id=new.id;
  if new.skills is not null then
    foreach skill in array new.skills loop
      insert into app.skill_catalog(name) values(skill) on conflict(name) do nothing;
      insert into app.user_skills(user_id,skill_id) select new.id,id from app.skill_catalog where name=skill::citext on conflict do nothing;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists write_public_volunteers on public.volunteers;
create trigger write_public_volunteers instead of insert or update on public.volunteers for each row execute function app.write_public_volunteers();

create or replace function app.write_public_admins()
returns trigger language plpgsql security definer set search_path=app,public as $$
begin
  insert into app.user_profiles(id, full_name, role, created_at, updated_at)
  values(new.id, coalesce(new.name,'Admin'), 'admin', coalesce(new.created_at,now()), coalesce(new.updated_at,now()))
  on conflict(id) do update set full_name=excluded.full_name, role='admin', updated_at=now();
  insert into app.user_private_contacts(user_id,email,phone) values(new.id,new.email,new.phone)
  on conflict(user_id) do update set email=excluded.email, phone=excluded.phone, updated_at=now();
  insert into app.admin_profiles(user_id,status,education,education_field,reviewed_by,reviewed_at,rejection_reason,created_at,updated_at)
  values(new.id,app.normalize_admin_status(new.status),new.education,new.education_field,new.reviewed_by,new.reviewed_at,new.rejection_reason,coalesce(new.created_at,now()),coalesce(new.updated_at,now()))
  on conflict(user_id) do update set status=excluded.status, education=excluded.education, education_field=excluded.education_field, reviewed_by=excluded.reviewed_by, reviewed_at=excluded.reviewed_at, rejection_reason=excluded.rejection_reason, updated_at=now();
  insert into app.admin_sensitive_data(user_id,nid_number,photo_url) values(new.id,new.nid_number,new.photo_url)
  on conflict(user_id) do update set nid_number=excluded.nid_number, photo_url=excluded.photo_url, updated_at=now();
  return new;
end $$;
drop trigger if exists write_public_admins on public.admins;
create trigger write_public_admins instead of insert or update on public.admins for each row execute function app.write_public_admins();

create or replace function app.write_public_criminal_records()
returns trigger language plpgsql security definer set search_path=app,public as $$
declare alias text;
begin
  insert into app.criminal_records_core(id,name,age,gender,description,photo_url,status,crime_count,intensity,most_frequent_crime,score,created_at,updated_at)
  values(new.id,coalesce(new.name,'Unknown'),new.age,new.gender,new.description,new.photo_url,app.normalize_criminal_record_status(new.status),coalesce(new.crime_count,0),coalesce(new.intensity,0),new.most_frequent_crime,coalesce(new.score,0),coalesce(new.created_at,now()),coalesce(new.updated_at,now()))
  on conflict(id) do update set name=excluded.name, age=excluded.age, gender=excluded.gender, description=excluded.description, photo_url=excluded.photo_url, status=excluded.status, crime_count=excluded.crime_count, intensity=excluded.intensity, most_frequent_crime=excluded.most_frequent_crime, score=excluded.score, updated_at=now();
  delete from app.criminal_record_aliases where criminal_record_id=new.id;
  if new.known_aliases is not null then
    foreach alias in array new.known_aliases loop
      insert into app.criminal_record_aliases(criminal_record_id,alias) values(new.id,alias) on conflict do nothing;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists write_public_criminal_records on public.criminal_records;
create trigger write_public_criminal_records instead of insert or update on public.criminal_records for each row execute function app.write_public_criminal_records();

grant insert, update on public.profiles, public.volunteers, public.crimes, public.sos_alerts, public.admins, public.criminal_records to authenticated;

commit;
