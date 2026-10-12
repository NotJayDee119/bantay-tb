-- ===========================================================================
-- BANTAY-TB -> HL7 FHIR R4 interoperability pipeline (database layer)
-- ===========================================================================
--
-- BANTAY-TB has been a data silo: a TB case recorded at a Davao City DOTS
-- facility lives only in `public.cases`, reachable only through this app's own
-- UI. Nothing else in the health system -- the DOH Integrated TB Information
-- System, a hospital EMR, a referral HIE node -- can read it without someone
-- re-typing the record off a screen.
--
-- This migration is the server side of the outbound pipeline that closes that
-- gap. The serialization itself lives in the Edge Function
-- (supabase/functions/fhir-export); what lives here is everything that has to
-- be enforced by the database rather than promised by application code:
--
--   1. interop_endpoints    -- where payloads may be sent (HTTPS only), plus
--                              the transport credential, encrypted at rest.
--   2. interop_audit_log    -- an append-only, hash-chained record of every
--                              serialization, disclosure and transmission.
--   3. Encryption helpers   -- pgcrypto AES-256 column encryption, keyed from
--                              a schema PostgREST cannot reach.
--   4. Least-privilege      -- column-level grants, so no API role can read a
--                              ciphertext column or mutate the audit log.
--
-- The Data Privacy Act of 2012 (RA 10173) mapping is written out in
-- docs/FHIR-INTEROP.md, section "Privacy controls".
-- ===========================================================================

-- pgcrypto lives in `extensions` on Supabase but in `public` on some older
-- projects. Resolve it through the search path rather than hard-coding a
-- schema, and keep pg_temp last so a temp object can never shadow a function.
set search_path = public, extensions, pg_temp;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Key custody
--
-- `bantay_private` is deliberately absent from [api].schemas in
-- supabase/config.toml, so PostgREST will not expose it at any URL, and no API
-- role (anon / authenticated / service_role) holds anything in it. The key is
-- reachable only through a SECURITY DEFINER function owned by the migration
-- role.
--
-- Honest limitation, stated here so nobody over-claims it in a defense: the
-- key and the ciphertext sit in the same cluster. This defeats table-level
-- disclosure -- a leaked service_role key, a `select *` from a compromised
-- client, a logical dump opened by someone without the definer function -- not
-- a full superuser compromise. Production custody moves 'interop-payload-v1'
-- into Supabase Vault or an external KMS without touching a single caller,
-- because interop_encrypt / interop_decrypt are the only two places in the
-- system that resolve a key.
-- ---------------------------------------------------------------------------
create schema if not exists bantay_private;
revoke all on schema bantay_private from public;
revoke usage on schema bantay_private from anon, authenticated, service_role;

create table if not exists bantay_private.crypto_keys (
  id text primary key,
  key_material bytea not null,
  created_at timestamptz not null default now()
);

comment on table bantay_private.crypto_keys is
  'Symmetric keys for pgcrypto column encryption. Not exposed through PostgREST; read only by bantay_private.interop_key().';

-- 32 random bytes generated inside the database: the key never transits the
-- network and never appears in a config file or an environment variable.
insert into bantay_private.crypto_keys (id, key_material)
values ('interop-payload-v1', gen_random_bytes(32))
on conflict (id) do nothing;

create or replace function bantay_private.interop_key(p_id text default 'interop-payload-v1')
returns text
language sql
stable
security definer
set search_path = bantay_private, pg_temp
as $$
  select encode(key_material, 'base64') from crypto_keys where id = p_id;
$$;

revoke all on function bantay_private.interop_key from public;

-- Encrypt / decrypt wrappers. AES-256 through pgcrypto's PGP symmetric
-- format, which carries a random session key and an integrity check per
-- value -- so two identical payloads do not produce identical ciphertext, and
-- a flipped byte is detected on decrypt instead of returning garbage.
create or replace function public.interop_encrypt(p_plain text)
returns bytea
language sql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
  select pgp_sym_encrypt(
    p_plain,
    bantay_private.interop_key(),
    'cipher-algo=aes256, compress-algo=1'
  );
$$;

create or replace function public.interop_decrypt(p_cipher bytea)
returns text
language sql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
  select pgp_sym_decrypt(p_cipher, bantay_private.interop_key());
$$;

comment on function public.interop_encrypt is
  'AES-256 encryption for PHI at rest. Callable only by definer functions -- no API role holds EXECUTE.';

-- ---------------------------------------------------------------------------
-- 2. interop_endpoints -- the allow-list of external targets
--
-- A row here is the only thing that makes an outbound transmission possible.
-- The Edge Function cannot be handed a URL by its caller; it can only be
-- handed an endpoint id to look up. `base_url` is constrained to HTTPS at the
-- schema level, so "transmits over secure HTTPS" is a database invariant
-- rather than a line of TypeScript somebody could change.
-- ---------------------------------------------------------------------------
create table if not exists public.interop_endpoints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- 'fhir_rest'     : a FHIR server base URL (transaction bundle POSTed to it)
  -- 'mirth_channel' : an integration engine's HTTPS listener fronting Mirth
  kind text not null default 'fhir_rest'
    check (kind in ('fhir_rest', 'mirth_channel')),
  base_url text not null
    check (base_url ~ '^https://[^/?#]+'),
  -- Appended to base_url. Empty posts to the base itself, which is what the
  -- FHIR spec defines for a transaction interaction.
  resource_path text not null default '',
  auth_scheme text not null default 'none'
    check (auth_scheme in ('none', 'bearer', 'basic', 'apikey')),
  -- The credential, AES-256 encrypted. No API role is granted SELECT on this
  -- column; it is read only by interop_endpoint_dispatch(), as its definer.
  credential_cipher bytea,
  -- Last four characters only, so the UI can show "...a93f" to confirm which
  -- secret is loaded without disclosing it.
  credential_hint text,
  -- Header name when auth_scheme = 'apikey' (e.g. 'X-API-Key').
  credential_header text,
  active boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.interop_endpoints is
  'Allow-list of external interoperability targets. HTTPS enforced by check constraint; credentials encrypted at rest.';
comment on column public.interop_endpoints.credential_cipher is
  'AES-256 ciphertext of the bearer token / basic pair / API key. Granted to no API role.';

create index if not exists interop_endpoints_active_idx
  on public.interop_endpoints (active)
  where active;

-- ---------------------------------------------------------------------------
-- 3. interop_audit_log -- append-only, hash-chained
--
-- Every event in the pipeline lands here: a preview that only rendered a
-- payload on screen, an identified (non-pseudonymised) disclosure, a refused
-- request, and each transmission attempt with its HTTP outcome.
--
-- "Immutable" is enforced four ways, because any one alone is a promise
-- rather than a control:
--   (a) no API role holds UPDATE / DELETE / TRUNCATE (grants, section 9);
--   (b) triggers raise on UPDATE, DELETE and TRUNCATE whatever the role, so
--       even the table owner cannot quietly rewrite a row;
--   (c) record_hash chains each row to its predecessor, so editing or
--       removing a row out of band (direct superuser SQL, a doctored dump)
--       breaks the chain and verify_interop_audit() reports where;
--   (d) the payload snapshot is stored encrypted, so holding the audit trail
--       is not the same as holding the PHI that was sent.
-- ---------------------------------------------------------------------------
create table if not exists public.interop_audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Chain position. A sequence, not a timestamp: two events in the same
  -- millisecond still have a defined order.
  seq bigserial not null unique,
  event text not null check (event in (
    'payload_previewed',   -- serialised and shown in-app, not transmitted
    'transmit_success',    -- 2xx from the external endpoint
    'transmit_failure',    -- non-2xx, timeout, or network error
    'payload_viewed',      -- a stored payload was decrypted and read back
    'access_denied',       -- the caller was not permitted to do what it asked
    'endpoint_credential_set'
  )),
  case_id uuid references public.cases (id) on delete set null,
  -- Pseudonymous label (the TB case code) snapshotted at write time, so the
  -- trail still says *which* record was disclosed after the case row is gone.
  -- Never a patient name.
  case_label text,
  endpoint_id uuid references public.interop_endpoints (id) on delete set null,
  -- Snapshot of the exact URL used. If the endpoint row is later re-pointed,
  -- this row still says where this payload actually went.
  endpoint_url text,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  actor_role public.app_role,
  -- 'pseudonymous' (default: no name, no street, barangay centroid only) or
  -- 'identified' (name / street / household coordinates included).
  disclosure_scope text check (disclosure_scope in ('pseudonymous', 'identified')),
  fhir_bundle_id text,
  resource_count int,
  payload_bytes int,
  -- SHA-256 of the exact bytes serialised. Carries no PHI, so it is safe to
  -- show in the UI and to compare against the receiving system's copy.
  payload_sha256 text,
  payload_cipher bytea,
  http_status int,
  -- Derived from the response (status line plus per-entry outcomes), never the
  -- raw body, so a chatty endpoint cannot echo PHI back into our log.
  response_summary text,
  latency_ms int,
  outcome text not null check (outcome in ('ok', 'denied', 'error')),
  error_detail text,
  prev_hash text,
  record_hash text not null,
  created_at timestamptz not null default now()
);

comment on table public.interop_audit_log is
  'Append-only, hash-chained audit trail for FHIR interoperability. UPDATE/DELETE/TRUNCATE raise; verify with public.verify_interop_audit().';

create index if not exists interop_audit_log_created_idx
  on public.interop_audit_log (created_at desc);
create index if not exists interop_audit_log_case_idx
  on public.interop_audit_log (case_id);

-- ── The hash chain ────────────────────────────────────────────────────────
-- One definition, used by both the insert trigger and the verifier, so the
-- two can never drift apart. to_char(... at time zone 'UTC') rather than
-- created_at::text, because ::text renders in the session's timezone -- the
-- same row would then hash differently for a verifier in another session.
create or replace function public.interop_record_hash(
  p_prev_hash text,
  p_seq bigint,
  p_event text,
  p_case_id uuid,
  p_endpoint_url text,
  p_actor_id uuid,
  p_disclosure_scope text,
  p_payload_sha256 text,
  p_http_status int,
  p_outcome text,
  p_created_at timestamptz
)
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select encode(
    digest(
      concat_ws(
        '|',
        coalesce(p_prev_hash, 'GENESIS'),
        p_seq::text,
        p_event,
        coalesce(p_case_id::text, ''),
        coalesce(p_endpoint_url, ''),
        coalesce(p_actor_id::text, ''),
        coalesce(p_disclosure_scope, ''),
        coalesce(p_payload_sha256, ''),
        coalesce(p_http_status::text, ''),
        p_outcome,
        to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.interop_audit_seal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Serialise appends against each other. Without this, two concurrent
  -- transactions -- a preview and a transmission in flight at once, or two
  -- admin sessions -- can both read the same tail row and chain themselves to
  -- the same predecessor. The chain would then fork, and verification would
  -- report tampering where none happened. The lock is held to the end of the
  -- transaction and contends only with other audit appends, which are rare.
  perform pg_advisory_xact_lock(4771001);

  -- Fix the timestamp next: it is part of the digest, so it cannot be left
  -- to default after the digest has been computed.
  new.created_at := coalesce(new.created_at, now());

  -- The caller does not get to choose its own place in the chain.
  select l.record_hash
    into new.prev_hash
    from public.interop_audit_log l
   order by l.seq desc
   limit 1;

  new.record_hash := public.interop_record_hash(
    new.prev_hash,
    new.seq,
    new.event,
    new.case_id,
    new.endpoint_url,
    new.actor_id,
    new.disclosure_scope,
    new.payload_sha256,
    new.http_status,
    new.outcome,
    new.created_at
  );
  return new;
end;
$$;

drop trigger if exists interop_audit_seal on public.interop_audit_log;
create trigger interop_audit_seal
  before insert on public.interop_audit_log
  for each row execute function public.interop_audit_seal();

create or replace function public.interop_audit_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception
    'public.interop_audit_log is append-only: % is not permitted (RA 10173 audit trail)',
    tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists interop_audit_no_update on public.interop_audit_log;
create trigger interop_audit_no_update
  before update on public.interop_audit_log
  for each row execute function public.interop_audit_append_only();

drop trigger if exists interop_audit_no_delete on public.interop_audit_log;
create trigger interop_audit_no_delete
  before delete on public.interop_audit_log
  for each row execute function public.interop_audit_append_only();

-- Row triggers never fire for TRUNCATE, which would otherwise wipe the whole
-- trail in one statement.
drop trigger if exists interop_audit_no_truncate on public.interop_audit_log;
create trigger interop_audit_no_truncate
  before truncate on public.interop_audit_log
  for each statement execute function public.interop_audit_append_only();

-- ---------------------------------------------------------------------------
-- 4. The writer -- the only insert path
--
-- SECURITY DEFINER, so the Edge Function needs no table privileges at all,
-- and the payload is encrypted inside the database: the plaintext arrives
-- over TLS and is never written to an unencrypted column.
-- ---------------------------------------------------------------------------
create or replace function public.interop_log_event(
  p_event text,
  p_outcome text,
  p_actor_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null,
  p_case_id uuid default null,
  p_case_label text default null,
  p_endpoint_id uuid default null,
  p_endpoint_url text default null,
  p_disclosure_scope text default null,
  p_fhir_bundle_id text default null,
  p_resource_count int default null,
  p_payload_bytes int default null,
  p_payload_sha256 text default null,
  p_payload text default null,
  p_http_status int default null,
  p_response_summary text default null,
  p_latency_ms int default null,
  p_error_detail text default null
)
returns table (audit_id uuid, audit_seq bigint, audit_hash text, logged_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.interop_audit_log;
begin
  insert into public.interop_audit_log (
    event, outcome, actor_id, actor_email, actor_role,
    case_id, case_label, endpoint_id, endpoint_url, disclosure_scope,
    fhir_bundle_id, resource_count, payload_bytes, payload_sha256,
    payload_cipher, http_status, response_summary, latency_ms, error_detail
  )
  values (
    p_event,
    p_outcome,
    p_actor_id,
    p_actor_email,
    nullif(p_actor_role, '')::public.app_role,
    p_case_id,
    p_case_label,
    p_endpoint_id,
    p_endpoint_url,
    p_disclosure_scope,
    p_fhir_bundle_id,
    p_resource_count,
    p_payload_bytes,
    p_payload_sha256,
    case when p_payload is null then null else public.interop_encrypt(p_payload) end,
    p_http_status,
    p_response_summary,
    p_latency_ms,
    p_error_detail
  )
  returning * into v_row;

  return query
    select v_row.id, v_row.seq, v_row.record_hash, v_row.created_at;
end;
$$;

comment on function public.interop_log_event is
  'The only insert path into interop_audit_log. Encrypts the payload snapshot server-side; EXECUTE held by service_role alone.';

-- ---------------------------------------------------------------------------
-- 5. Dispatch -- hands the Edge Function a URL and a ready-made auth header
--
-- The decrypted credential goes to the function process and never to a
-- browser: EXECUTE is granted to service_role only, so the anon key in the
-- client bundle cannot reach it. Returning a composed header rather than the
-- raw secret also keeps credential *shape* out of the function's code.
-- ---------------------------------------------------------------------------
create or replace function public.interop_endpoint_dispatch(p_endpoint_id uuid)
returns table (
  endpoint_id uuid,
  endpoint_name text,
  endpoint_kind text,
  target_url text,
  auth_header_name text,
  auth_header_value text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  e public.interop_endpoints;
  v_secret text;
begin
  select * into e from public.interop_endpoints where id = p_endpoint_id;
  if e.id is null then
    raise exception 'interop endpoint % not found', p_endpoint_id;
  end if;
  if not e.active then
    raise exception 'interop endpoint "%" is inactive', e.name;
  end if;
  -- Belt and braces: the check constraint already refuses non-HTTPS, but a
  -- transmission is the last place to take that on trust.
  if e.base_url not like 'https://%' then
    raise exception 'interop endpoint "%" is not HTTPS', e.name;
  end if;

  if e.credential_cipher is not null then
    v_secret := public.interop_decrypt(e.credential_cipher);
  end if;

  if e.auth_scheme <> 'none' and v_secret is null then
    raise exception 'interop endpoint "%" declares auth_scheme % but has no credential loaded',
      e.name, e.auth_scheme;
  end if;

  return query
  select
    e.id,
    e.name,
    e.kind,
    rtrim(e.base_url, '/') ||
      case
        when coalesce(e.resource_path, '') = '' then ''
        else '/' || ltrim(e.resource_path, '/')
      end,
    case e.auth_scheme
      when 'none'   then null
      when 'apikey' then coalesce(e.credential_header, 'X-API-Key')
      else 'Authorization'
    end,
    case e.auth_scheme
      when 'none'   then null
      when 'bearer' then 'Bearer ' || v_secret
      -- Stored as "user:password"; base64 is applied at dispatch time.
      when 'basic'  then 'Basic ' || encode(convert_to(v_secret, 'UTF8'), 'base64')
      when 'apikey' then v_secret
    end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Credential rotation from the UI (system admin only)
-- ---------------------------------------------------------------------------
create or replace function public.interop_set_credential(
  p_endpoint_id uuid,
  p_secret text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  if not public.is_super_admin() then
    raise exception 'only the system administrator may set interoperability credentials'
      using errcode = 'insufficient_privilege';
  end if;

  select e.name into v_name from public.interop_endpoints e where e.id = p_endpoint_id;
  if v_name is null then
    raise exception 'interop endpoint % not found', p_endpoint_id;
  end if;

  update public.interop_endpoints
     set credential_cipher = case
           when coalesce(p_secret, '') = '' then null
           else public.interop_encrypt(p_secret)
         end,
         credential_hint = case
           when coalesce(p_secret, '') = '' then null
           else '...' || right(p_secret, 4)
         end,
         updated_at = now()
   where id = p_endpoint_id;

  -- Rotating a transport credential is itself an auditable act.
  perform public.interop_log_event(
    p_event       => 'endpoint_credential_set',
    p_outcome     => 'ok',
    p_actor_id    => auth.uid(),
    p_actor_email => (select p.email from public.profiles p where p.id = auth.uid()),
    p_actor_role  => (select p.role::text from public.profiles p where p.id = auth.uid()),
    p_endpoint_id => p_endpoint_id,
    p_response_summary => 'credential ' ||
      case when coalesce(p_secret, '') = '' then 'cleared' else 'rotated' end ||
      ' for ' || v_name
  );
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Reading a stored payload back
--
-- The reason to keep the payload at all is being able to answer, months
-- later, "what exactly did we disclose about this patient?". Because the
-- answer is PHI, every successful read is itself appended to the log.
--
-- A *refused* read is logged by the Edge Function layer instead, not here: a
-- denial raises, the raise aborts the transaction, and an aborted transaction
-- would roll the denial record back with it. Logging it from a separate HTTP
-- call is the only way it actually commits.
-- ---------------------------------------------------------------------------
create or replace function public.interop_payload(p_audit_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.interop_audit_log;
  v_plain text;
begin
  -- Only the system administrator, and the read itself is logged below.
  if not public.is_super_admin() then
    raise exception 'only the system administrator may read stored FHIR payloads'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.interop_audit_log where id = p_audit_id;
  if v_row.id is null then
    raise exception 'audit row % not found', p_audit_id;
  end if;
  if v_row.payload_cipher is null then
    return null;
  end if;

  v_plain := public.interop_decrypt(v_row.payload_cipher);

  perform public.interop_log_event(
    p_event       => 'payload_viewed',
    p_outcome     => 'ok',
    p_actor_id    => auth.uid(),
    p_actor_email => (select p.email from public.profiles p where p.id = auth.uid()),
    p_actor_role  => (select p.role::text from public.profiles p where p.id = auth.uid()),
    p_case_id     => v_row.case_id,
    p_case_label  => v_row.case_label,
    p_endpoint_id => v_row.endpoint_id,
    p_disclosure_scope => v_row.disclosure_scope,
    p_payload_sha256   => v_row.payload_sha256,
    p_response_summary => 'decrypted payload of audit row #' || v_row.seq
  );

  return v_plain;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Chain verification -- the demonstrable half of "immutable"
--
-- Recomputes every record hash from the row's own fields plus its
-- predecessor's hash. The first row whose stored hash disagrees, or whose
-- prev_hash does not match the row actually preceding it, is where the
-- tampering happened.
--
-- A gap in `seq` is not evidence of anything: a rolled-back transaction
-- consumes a sequence value without leaving a row. Deletion is caught by the
-- hash linkage, not by counting, which is why the chain is what matters.
-- ---------------------------------------------------------------------------
create or replace function public.verify_interop_audit()
returns table (
  audit_seq bigint,
  audit_id uuid,
  audit_event text,
  logged_at timestamptz,
  ok boolean,
  problem text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_expected_prev text := null;
  v_recomputed text;
  v_problem text;
begin
  if not public.is_super_admin() then
    raise exception 'only the system administrator may verify the audit chain'
      using errcode = 'insufficient_privilege';
  end if;

  -- Aliased, because the OUT parameters above are plpgsql variables: an
  -- unqualified `order by audit_seq` would order by the variable, not the
  -- column, and silently verify the chain in the wrong order.
  for r in
    select l.* from public.interop_audit_log l order by l.seq asc
  loop
    v_problem := null;

    if coalesce(r.prev_hash, '') is distinct from coalesce(v_expected_prev, '') then
      v_problem := 'prev_hash does not match the preceding row -- a row was removed or reordered';
    end if;

    v_recomputed := public.interop_record_hash(
      r.prev_hash, r.seq, r.event, r.case_id, r.endpoint_url, r.actor_id,
      r.disclosure_scope, r.payload_sha256, r.http_status, r.outcome, r.created_at
    );
    if v_recomputed is distinct from r.record_hash then
      v_problem := coalesce(v_problem || '; ', '') ||
        'record_hash does not match the row contents -- the row was edited';
    end if;

    audit_seq   := r.seq;
    audit_id    := r.id;
    audit_event := r.event;
    logged_at   := r.created_at;
    ok          := v_problem is null;
    problem     := v_problem;
    return next;

    v_expected_prev := r.record_hash;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. RLS and least-privilege grants
-- ---------------------------------------------------------------------------
alter table public.interop_endpoints enable row level security;
alter table public.interop_audit_log enable row level security;

-- Supabase grants ALL on new public tables to the API roles by default. Strip
-- that back to nothing, then re-grant one column at a time.
revoke all on public.interop_endpoints from anon, authenticated, service_role;
revoke all on public.interop_audit_log from anon, authenticated, service_role;

-- The bigserial's sequence, resolved by name rather than guessed.
do $$
declare
  v_seq text := pg_get_serial_sequence('public.interop_audit_log', 'seq');
begin
  if v_seq is not null then
    execute format(
      'revoke all on sequence %s from anon, authenticated, service_role',
      v_seq
    );
  end if;
end;
$$;

-- Endpoints: sharing records outside BANTAY-TB is a system administrator act,
-- so only the system administrator can see, add or change where records may
-- go. `credential_cipher` is absent from the grant list on top of that, so no
-- API role can select it at all, not even with a leaked service_role key.
grant select (
  id, name, kind, base_url, resource_path, auth_scheme, credential_hint,
  credential_header, active, notes, created_by, created_at, updated_at
) on public.interop_endpoints to authenticated;

grant insert (
  name, kind, base_url, resource_path, auth_scheme, credential_header,
  active, notes, created_by
) on public.interop_endpoints to authenticated;

grant update (
  name, kind, base_url, resource_path, auth_scheme, credential_header,
  active, notes, updated_at
) on public.interop_endpoints to authenticated;

create policy "interop_endpoints admin read"
  on public.interop_endpoints for select
  using (public.is_super_admin());

create policy "interop_endpoints admin insert"
  on public.interop_endpoints for insert
  with check (public.is_super_admin());

create policy "interop_endpoints admin update"
  on public.interop_endpoints for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Deliberately no DELETE policy and no DELETE grant: an endpoint that has
-- received PHI is deactivated, never erased, so every audit row's endpoint_id
-- stays resolvable.

-- Audit log: readable by the system administrator alone, column by column.
--
-- The system administrator is also the only role that can share records, so
-- the same role both acts and reviews. That is safe *because* the log is
-- append-only: the admin's own previews, transmissions and payload reads are
-- recorded in a trail the admin cannot edit, delete or truncate, and an edit
-- made by bypassing the application breaks the hash chain.
--
-- `payload_cipher` is omitted from the grant -- the ciphertext never leaves
-- the database, and public.interop_payload() is the single read path.
grant select (
  id, seq, event, case_id, case_label, endpoint_id, endpoint_url,
  actor_id, actor_email, actor_role, disclosure_scope, fhir_bundle_id,
  resource_count, payload_bytes, payload_sha256, http_status,
  response_summary, latency_ms, outcome, error_detail,
  prev_hash, record_hash, created_at
) on public.interop_audit_log to authenticated;

create policy "interop_audit_log admin read"
  on public.interop_audit_log for select
  using (public.is_super_admin());

-- No INSERT grant for any API role: writes arrive only through
-- interop_log_event(), which runs as its definer. No UPDATE or DELETE grant
-- either, and the triggers above refuse both whatever the role.

-- ── Function privileges ───────────────────────────────────────────────────
-- Supabase's default privileges hand EXECUTE on new functions to all three
-- API roles. Revoke that, then grant deliberately. The argument lists are
-- omitted: each of these names has exactly one overload.
revoke all on function public.interop_encrypt from public, anon, authenticated, service_role;
revoke all on function public.interop_decrypt from public, anon, authenticated, service_role;
revoke all on function public.interop_record_hash from public, anon, authenticated;

revoke all on function public.interop_log_event from public, anon, authenticated, service_role;
grant execute on function public.interop_log_event to service_role;

revoke all on function public.interop_endpoint_dispatch from public, anon, authenticated, service_role;
grant execute on function public.interop_endpoint_dispatch to service_role;

revoke all on function public.interop_set_credential from public, anon;
grant execute on function public.interop_set_credential to authenticated;

revoke all on function public.interop_payload from public, anon;
grant execute on function public.interop_payload to authenticated;

revoke all on function public.verify_interop_audit from public, anon;
grant execute on function public.verify_interop_audit to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Seed the demonstration endpoint
--
-- HAPI's public R4 server: HTTPS, anonymous, and it answers a transaction
-- bundle with a transaction-response listing the resources it created --
-- which is the proof that the payload was not merely accepted but understood.
-- ---------------------------------------------------------------------------
insert into public.interop_endpoints (name, kind, base_url, resource_path, auth_scheme, notes)
select
  'HAPI FHIR R4 public test server',
  'fhir_rest',
  'https://hapi.fhir.org/baseR4',
  '',
  'none',
  'Reference FHIR R4 server. Transaction bundles are POSTed to the base URL and answered with a transaction-response bundle. Payloads carry the HTEST (test health data) tag.'
where not exists (
  select 1 from public.interop_endpoints e
   where e.base_url = 'https://hapi.fhir.org/baseR4'
);

-- The integration-engine route is the same table with a different kind:
-- insert the endpoint with kind = 'mirth_channel', point base_url at the
-- Mirth HTTP Listener's HTTPS URL, then load its token with
--   select public.interop_set_credential('<endpoint id>', '<token>');

notify pgrst, 'reload schema';
