-- Single-use, 24-hour staff invite codes.
--
-- Replaces the old single static VITE_STAFF_INVITE_CODE gate. A TB coordinator
-- (or system admin) generates a code bound to a role and an assigned barangay;
-- the code works exactly once and expires 24 hours after it is created. A
-- prospective health worker contacts the coordinator, receives a code, and
-- redeems it during staff registration.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  role public.app_role not null default 'health_worker',
  barangay_psgc bigint references public.barangays (psgc) on delete set null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  -- Codes may only ever grant a staff role, never 'patient'.
  constraint invite_codes_staff_role_only
    check (role in ('barangay_admin', 'health_worker', 'tb_coordinator'))
);

create index invite_codes_created_by_idx on public.invite_codes (created_by);
create index invite_codes_code_idx on public.invite_codes (code);

alter table public.invite_codes enable row level security;

-- Only coordinators / admins may read and manage codes from the UI. Anonymous
-- registrants never touch the table directly — they go through the SECURITY
-- DEFINER functions below, which validate and consume a single code without
-- exposing the rest of the table.
create policy "invite_codes staff read"
  on public.invite_codes for select
  using (public.current_role() in ('tb_coordinator', 'system_admin'));

create policy "invite_codes staff insert"
  on public.invite_codes for insert
  with check (
    created_by = auth.uid()
    and public.current_role() in ('tb_coordinator', 'system_admin')
  );

-- Revoking an unused code = deleting it.
create policy "invite_codes staff delete"
  on public.invite_codes for delete
  using (
    public.current_role() in ('tb_coordinator', 'system_admin')
    and used_at is null
  );

-- ---------------------------------------------------------------------------
-- create_invite_code — coordinator generates a code. Runs as definer so the
-- generated random code and the 24h expiry are set server-side, and the caller
-- can't spoof created_by. Returns the full row so the UI can show it once.
-- ---------------------------------------------------------------------------
create or replace function public.create_invite_code(
  p_role public.app_role,
  p_barangay_psgc bigint default null,
  p_note text default null
)
returns public.invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.app_role;
  new_code text;
  result public.invite_codes;
begin
  caller_role := public.current_role();
  if caller_role is null or caller_role not in ('tb_coordinator', 'system_admin') then
    raise exception 'Only TB coordinators or system admins may create invite codes.'
      using errcode = '42501';
  end if;

  if p_role not in ('barangay_admin', 'health_worker', 'tb_coordinator') then
    raise exception 'Invite codes may only grant a staff role.'
      using errcode = '22023';
  end if;

  -- Generate a human-readable, unambiguous 8-char code (no 0/O/1/I/L).
  loop
    new_code := (
      select string_agg(
        substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
               1 + floor(random() * 31)::int, 1),
        ''
      )
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from public.invite_codes where code = new_code);
  end loop;

  insert into public.invite_codes (code, role, barangay_psgc, note, created_by)
  values (new_code, p_role, p_barangay_psgc, nullif(btrim(p_note), ''), auth.uid())
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- validate_invite_code — anon-callable pre-check during registration. Returns
-- whether the code is currently redeemable plus the role/barangay it grants,
-- without consuming it. Never leaks anything for a bad code.
-- ---------------------------------------------------------------------------
create or replace function public.validate_invite_code(p_code text)
returns table (
  valid boolean,
  reason text,
  role public.app_role,
  barangay_psgc bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.invite_codes;
begin
  select * into rec
  from public.invite_codes
  where code = btrim(p_code);

  if not found then
    return query select false, 'not_found'::text, null::public.app_role, null::bigint;
    return;
  end if;

  if rec.used_at is not null then
    return query select false, 'used'::text, null::public.app_role, null::bigint;
    return;
  end if;

  if rec.expires_at <= now() then
    return query select false, 'expired'::text, null::public.app_role, null::bigint;
    return;
  end if;

  return query select true, 'ok'::text, rec.role, rec.barangay_psgc;
end;
$$;

-- ---------------------------------------------------------------------------
-- redeem_invite_code — atomically consume a code for a freshly-created user.
-- The single UPDATE with `used_at is null and expires_at > now()` guarantees
-- exactly-once redemption even if two people submit the same code at once.
-- Returns the granted role/barangay so the client can set the profile, or
-- valid=false if the code was already taken / expired in the meantime.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite_code(p_code text, p_user_id uuid)
returns table (
  valid boolean,
  reason text,
  role public.app_role,
  barangay_psgc bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.invite_codes;
begin
  update public.invite_codes
  set used_at = now(), used_by = p_user_id
  where code = btrim(p_code)
    and used_at is null
    and expires_at > now()
  returning * into rec;

  if not found then
    return query select false, 'unavailable'::text, null::public.app_role, null::bigint;
    return;
  end if;

  return query select true, 'ok'::text, rec.role, rec.barangay_psgc;
end;
$$;

-- Registration happens before the user is authenticated, so anon needs these.
grant execute on function public.validate_invite_code(text) to anon, authenticated;
grant execute on function public.redeem_invite_code(text, uuid) to anon, authenticated;
grant execute on function public.create_invite_code(public.app_role, bigint, text) to authenticated;
