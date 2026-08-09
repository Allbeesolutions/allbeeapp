-- ALLBEE — pr-f_m3: scope `class_students` CRUD to administrators.
--
-- Deep-dive (PHASE2_SECURITY_DEEP_DIVE.md, M3): class_students is a legacy
-- table (108 rows) whose RLS policies allow unrestricted authenticated CRUD
-- (using true / with check true), while every app surface that reads it is
-- gated to admin/superadmin in the UI (nav entry "admin", AllbeeApp.jsx).
-- Align the database gate with the UI gate.
--
-- Idempotent: drops the three policy names first, then recreates them.
-- Non-admins lose visibility only (their reads return empty rows); existing
-- rows are untouched. Audit/history tables are not affected.

alter table public.class_students enable row level security;

drop policy if exists class_students_read on public.class_students;
create policy class_students_read on public.class_students
  for select to authenticated using (public.is_admin());

drop policy if exists class_students_write on public.class_students;
create policy class_students_write on public.class_students
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists class_students_delete on public.class_students;
create policy class_students_delete on public.class_students
  for delete to authenticated using (public.is_superadmin());