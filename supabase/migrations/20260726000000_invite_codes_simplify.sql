-- Simplify invite codes into a plain single-use, 24h registration gate.
--
-- Codes no longer carry a role or assigned barangay. A TB coordinator / system
-- admin just generates a code; the registrant enters it, and only if it's
-- valid do they proceed to pick their own role and assigned area.

drop function if exists public.create_invite_code(public.app_role, bigint, text);
drop function if exists public.validate_invite_code(text);
drop function if exists public.redeem_invite_code(text, uuid);

alter table public.invite_codes
  drop constraint if exists invite_codes_staff_role_only;
alter table public.invite_codes drop column if exists role;
alter table public.invite_codes drop column if exists barangay_psgc;

-- ---------------------------------------------------------------------------
-- create_invite_code — coordinator generates a code. Definer so the random
-- code and 24h expiry are set server-side and created_by can't be spoofed.
-- ---------------------------------------------------------------------------
create or replace function public.create_invite_code(p_note text default null)
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

  -- Human-readable, unambiguous 8-char code (no 0/O/1/I/L).
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

  insert into public.invite_codes (code, note, created_by)
  values (new_code, nullif(btrim(p_note), ''), auth.uid())
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- validate_invite_code — anon pre-check. Is this code currently redeemable?
-- ---------------------------------------------------------------------------
create or replace function public.validate_invite_code(p_code text)
returns table (valid boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.invite_codes;
begin
  select * into rec from public.invite_codes where code = btrim(p_code);

  if not found then
    return query select false, 'not_found'::text;
  elsif rec.used_at is not null then
    return query select false, 'used'::text;
  elsif rec.expires_at <= now() then
    return query select false, 'expired'::text;
  else
    return query select true, 'ok'::text;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- redeem_invite_code — atomically consume a code for a freshly-created user.
-- The single UPDATE guard is the real single-use guarantee.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite_code(p_code text, p_user_id uuid)
returns table (valid boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invite_codes
  set used_at = now(), used_by = p_user_id
  where code = btrim(p_code)
    and used_at is null
    and expires_at > now();

  if found then
    return query select true, 'ok'::text;
  else
    return query select false, 'unavailable'::text;
  end if;
end;
$$;

grant execute on function public.validate_invite_code(text) to anon, authenticated;
grant execute on function public.redeem_invite_code(text, uuid) to anon, authenticated;
grant execute on function public.create_invite_code(text) to authenticated;
