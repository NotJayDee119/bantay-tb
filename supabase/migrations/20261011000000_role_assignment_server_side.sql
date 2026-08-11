-- Make role assignment server-authoritative.
--
-- Until now handle_new_user() took the role straight out of the signup
-- metadata. 20260701000000 capped 'system_admin' down to 'patient', but every
-- other role still passed through untouched, so this was enough to mint a
-- citywide coordinator account from an anonymous browser:
--
--   supabase.auth.signUp({ email, password,
--     options: { data: { role: 'tb_coordinator' } } })
--
-- The invite code in StaffRegister was only ever a client-side gate — signUp
-- itself was never behind it, and redeem_invite_code ran *after* the account
-- already existed, so it could not prevent anything.
--
-- After this migration the trigger writes 'patient' unconditionally and the
-- only route to a staff role is claim_staff_role(), which verifies the invite
-- code server-side before it assigns anything. Scope-granting columns
-- (role, barangay_psgc, facility_id) are never read from client metadata.

-- ---------------------------------------------------------------------------
-- handle_new_user — no longer trusts the client for anything that grants
-- scope. full_name and phone are descriptive, so they stay.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    -- Always the least-privileged role. Staff are promoted afterwards by
    -- claim_staff_role(); patients are linked to a case by the claim flow.
    'patient'::public.app_role,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_staff_role — the single promotion path. The caller has just signed up
-- (so they hold a session and a 'patient' profile) and presents the invite
-- code they were given. The code is consumed and the role assigned in one
-- statement each, inside one transaction: if the assignment fails the code is
-- not burned, and if the code was already used no role is granted.
--
-- Definer so it can write the frozen columns the "profiles self update" policy
-- protects — that policy is what stops the same write from the client.
-- ---------------------------------------------------------------------------
create or replace function public.claim_staff_role(
  p_code text,
  p_role public.app_role,
  p_barangay_psgc bigint default null,
  p_facility_id uuid default null
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_role_value public.app_role;
  effective_facility uuid;
begin
  if uid is null then
    return query select false, 'not_authenticated'::text;
    return;
  end if;

  -- system_admin is never self-service; an existing system admin promotes
  -- another account through /app/users.
  if p_role not in (
    'barangay_admin'::public.app_role,
    'health_worker'::public.app_role,
    'tb_coordinator'::public.app_role
  ) then
    return query select false, 'role_not_allowed'::text;
    return;
  end if;

  -- Single-use per account: only a fresh 'patient' profile may be promoted, so
  -- a staff member cannot re-run this to move themselves into another area.
  select role into current_role_value from public.profiles where id = uid;
  if current_role_value is distinct from 'patient'::public.app_role then
    return query select false, 'already_assigned'::text;
    return;
  end if;

  -- These two roles read by area, so an unset barangay would mean an account
  -- that can see nothing — or, worse, that a later policy change opens up.
  if p_role in ('barangay_admin'::public.app_role, 'health_worker'::public.app_role)
     and p_barangay_psgc is null then
    return query select false, 'barangay_required'::text;
    return;
  end if;

  -- Only health_worker reads by facility (see areaScope.ts); drop the posting
  -- for anyone else so it can't linger on an account that ignores it.
  effective_facility := case
    when p_role = 'health_worker'::public.app_role then p_facility_id
    else null
  end;

  -- The UPDATE's own guard is the single-use guarantee, exactly as in
  -- redeem_invite_code before it.
  update public.invite_codes
  set used_at = now(), used_by = uid
  where code = btrim(p_code)
    and used_at is null
    and expires_at > now();

  if not found then
    return query select false, 'code_unavailable'::text;
    return;
  end if;

  update public.profiles
  set role = p_role,
      barangay_psgc = p_barangay_psgc,
      facility_id = effective_facility
  where id = uid;

  return query select true, 'ok'::text;
end;
$$;

-- redeem_invite_code is superseded: it was granted to anon and took an
-- arbitrary p_user_id, so it could burn a code on behalf of any account, and
-- it never assigned the role that made the code worth anything.
drop function if exists public.redeem_invite_code(text, uuid);

grant execute on function public.claim_staff_role(
  text, public.app_role, bigint, uuid
) to authenticated;

-- ---------------------------------------------------------------------------
-- Defense in depth: the direct-insert path is capped the same way as the
-- trigger. Previously only 'system_admin' was blocked here, which left the
-- API open to inserting a coordinator profile outright.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
  on public.profiles for insert
  with check (
    auth.uid() = id
    and role = 'patient'::public.app_role
  );

comment on function public.claim_staff_role(text, public.app_role, bigint, uuid) is
  'Consumes an invite code and promotes the calling account to a staff role. The only path to a non-patient role outside of /app/users.';
