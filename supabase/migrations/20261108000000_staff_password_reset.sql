-- ===========================================================================
-- Admin-assisted password reset for staff accounts
-- ===========================================================================
--
-- The email "Forgot password?" flow depends on the staff member still having
-- the mailbox they signed up with, and on outbound SMTP being configured. Field
-- staff often have neither, so a system administrator (any account) or a TB
-- coordinator (health workers and barangay admins only) can issue a temporary
-- password from /app/users. The Edge Function `staff-password` does the
-- actual auth change with the service role; this migration only adds the
-- bookkeeping it needs.
--
--   must_change_password  set when a temporary password is issued. While it is
--                         true the app shows nothing but the "choose a new
--                         password" screen, so the temporary password -- which
--                         the person who issued it has seen -- does not
--                         outlive the first sign-in.
--   password_reset_at/by  who issued the last temporary password, and when.
--
-- All three are frozen against self-update below. Otherwise a user could clear
-- their own flag through the REST API and keep a password someone else knows;
-- the only way to clear it is `staff-password` action "complete", which sets
-- the new password and clears the flag in the same request.
-- ===========================================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_reset_at timestamptz,
  add column if not exists password_reset_by uuid
    references public.profiles (id) on delete set null;

comment on column public.profiles.must_change_password is
  'True after an admin/coordinator issued a temporary password. The app forces a new password before anything else. Cleared only by the staff-password Edge Function.';
comment on column public.profiles.password_reset_at is
  'When a temporary password was last issued for this account.';
comment on column public.profiles.password_reset_by is
  'Who issued the last temporary password.';

-- Same shape as before (role, barangay and facility frozen), plus the three
-- reset columns.
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and not (role is distinct from (select p.role from public.profiles p where p.id = auth.uid()))
    and not (barangay_psgc is distinct from (select p.barangay_psgc from public.profiles p where p.id = auth.uid()))
    and not (facility_id is distinct from (select p.facility_id from public.profiles p where p.id = auth.uid()))
    and not (must_change_password is distinct from (select p.must_change_password from public.profiles p where p.id = auth.uid()))
    and not (password_reset_at is distinct from (select p.password_reset_at from public.profiles p where p.id = auth.uid()))
    and not (password_reset_by is distinct from (select p.password_reset_by from public.profiles p where p.id = auth.uid()))
  );

notify pgrst, 'reload schema';
