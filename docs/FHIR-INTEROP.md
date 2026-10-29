# BANTAY-TB HL7 FHIR Interoperability Pipeline

How a TB case recorded in BANTAY-TB leaves the silo: extracted from PostgreSQL,
serialised into an HL7 FHIR R4 transaction bundle, transmitted over HTTPS to an
external health information system, and recorded in an append-only audit trail.

**Route chosen: native backend.** The integration service is a Supabase Edge
Function in the project's existing stack (Deno + PostgREST + PostgreSQL), not a
Mirth Connect channel. The Mirth equivalent is described in
[Integration-engine route](#integration-engine-route-mirth-connect) — it needs
no database change, because a Mirth listener is just another row in
`interop_endpoints`.

---

## 1. The silo, and what breaks it

A case recorded at a Davao City DOTS facility lives in `public.cases`. It holds
things no other system has: the barangay of **residence** (not the facility's
barangay), the geocoded household, the DOTS facility providing treatment, the
NTP diagnosis axis, and the treatment outcome. Until now the only way to
read any of it was through this app's own UI. A referral to a hospital, a report
to the DOH Integrated TB Information System, or a hand-off to a regional HIE
node all meant a human re-typing the record off a screen.

The pipeline replaces that with one HTTPS request carrying a standard payload:

```
┌────────────────────────────┐
│ System Administrator       │   1. picks a case + a destination
│ /app/interoperability      │
└──────────┬─────────────────┘
           │ supabase.functions.invoke("fhir-export")  [caller's JWT]
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Edge Function: fhir-export            (the integration service) │
│                                                                 │
│  2. EXTRACT    reads cases + barangays + dots_centers           │
│                AS THE CALLER, so RLS decides what they          │
│                may export                                       │
│  3. SERIALIZE  _shared/fhir.ts -> FHIR R4 transaction Bundle    │
│                built from live rows, nothing pre-rendered       │
│  4. DISPATCH   interop_endpoint_dispatch() returns the URL and  │
│                a composed auth header, decrypted in the DB      │
│  5. TRANSMIT   POST application/fhir+json over TLS 1.2+         │
│  6. AUDIT      interop_log_event() appends the attempt,         │
│                its SHA-256, the HTTP outcome and an             │
│                AES-256-encrypted copy of the payload            │
└──────────┬──────────────────────────────────────┬───────────────┘
           │ 7. HTTPS POST                        │ 8. hash-chained append
           ▼                                      ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ External FHIR server         │    │ public.interop_audit_log     │
│ (HAPI R4 / DOH ITIS / EMR /  │    │ append-only, SHA-256 chained │
│  Mirth Connect channel)      │    │ UPDATE/DELETE/TRUNCATE raise │
│                              │    └──────────────────────────────┘
│ answers transaction-response │
│ with the id it assigned to   │
│ each resource  ──────────────┼──▶ shown back in the UI as proof
└──────────────────────────────┘
```

### Files

| Path | What it is |
| --- | --- |
| `supabase/functions/fhir-export/index.ts` | The integration service: auth, extract, dispatch, transmit, audit |
| `supabase/functions/_shared/fhir.ts` | The FHIR R4 serializer and terminology mapping |
| `supabase/migrations/20261019000000_fhir_interoperability.sql` | Endpoints, audit log, encryption, grants |
| `src/pages/app/Interoperability.tsx` | Operator UI at `/app/interoperability` |
| `src/__tests__/fhirBundle.test.ts` | 31 tests over the serializer |
| `scripts/sample-fhir-payload.ts` | Regenerates the sample payload (`npm run fhir:sample`) |
| `docs/fhir-sample-payload.json` | Exported sample payload |

---

## 2. Extract — dynamic, and scoped to the caller

Nothing is stored pre-serialised. Each request reads live rows:

| Source table | What it contributes |
| --- | --- |
| `cases` | the record itself: TB code, site, diagnosis status, outcome, dates |
| `barangays` | residence barangay name and centroid |
| `dots_centers` | the treating facility, its address and coordinates |

Only the **system administrator** can use the pipeline. Every other role —
TB coordinator, barangay admin, health worker, an account with no staff role —
is refused by the Edge
Function before anything is read, and the refusal is written to the audit log
as `access_denied`.

Even for the admin, the extract runs **with the caller's JWT**, not the service
role, so Row Level Security still answers "which cases may this person read?"
using the same policies as the register. Today the admin is citywide, so that
is every case — but the pipeline never bypasses RLS, so narrowing the admin's
scope later would narrow the export with it. An unknown case id returns
`404 case not found, or outside your assigned area`.

The service role key is used for exactly two things: the endpoint dispatch
lookup and the audit append. It is never used to read a case.

---

## 3. Serialize — HL7 FHIR R4, seven resources

A **transaction bundle**, which is the interaction the FHIR specification
defines for pushing a set of related resources in one atomic request. The
receiver answers with a `transaction-response` naming the id it assigned to each
resource — that response is the evidence the payload was parsed and stored as
discrete resources rather than accepted as an opaque blob.

| Resource | Carries | Bound to |
| --- | --- | --- |
| `Patient` | TB case code as business identifier, gender, birth year, barangay, geolocation | v2-0203 `MR`, v3-Confidentiality, v3-ObservationValue |
| `Condition` | the TB diagnosis | **ICD-10** + **SNOMED CT**, condition-category / -clinical / -ver-status |
| `Encounter` | the registration/notification contact | v3-ActCode `AMB`, diagnosis-role `AD` |
| `Organization` | the DOTS facility | organization-type `prov` |
| `Location` | the facility's real coordinates | v3-RoleCode `OF` |
| `Observation` ×1 | NTP diagnosis axis | local CodeSystem, observation-category `laboratory` |
| `Observation` ×1 | WHO/NTP treatment outcome | local CodeSystem, observation-category `therapy` |

Entries reference one another by `urn:uuid:` matching their own `fullUrl`, so
the receiver resolves the graph internally. `Patient`, `Organization` and
`Location` use conditional create (`ifNoneExist` on the identifier), so
re-sending a case updates rather than duplicates.

### Terminology decisions

The NTP records three facts on separate columns — anatomical site, how firmly
the case is diagnosed, and drug susceptibility — while ICD-10 folds site and
bacteriological confirmation into one code:

| `tb_site` / `diagnosis_status` | ICD-10 | `verificationStatus` |
| --- | --- | --- |
| pulmonary / bacteriologically confirmed | `A15.0` | `confirmed` |
| pulmonary / clinically diagnosed | `A16.9` | `provisional` |
| extra-pulmonary / either | `A18` | `confirmed` or `provisional` |
| **presumptive** | **`Z03.0`** observation for suspected TB | `unconfirmed` |

That last row is the important one. Active case finding yield is **symptomatic,
not confirmed** — many presumptives turn out not to have TB. Coding them `A15`
or `A16` would export a diagnosis nobody made. Every TB `Condition` also carries
SNOMED CT `56717001` *Tuberculosis (disorder)*, so a receiver that speaks only
one of the two systems still understands the payload.

Where BANTAY-TB holds a concept the published systems do not model the NTP's
way — the three-way diagnosis axis and the DOH outcome list — the resource carries an explicit local CodeSystem URI under
`https://bantay-tb.davao.gov.ph/fhir/CodeSystem/…` rather than a mis-mapped
standard code. A plausible-looking SNOMED code we had not verified would make
the payload *look* more standardised and be less interoperable.

### Validation

The sample payload validates against the HAPI FHIR R4 reference validator:

```
POST https://hapi.fhir.org/baseR4/Bundle/$validate
-> HTTP 200, OperationOutcome: 0 errors, 0 fatals, warnings only
```

The warnings are expected and are not defects:

- **`dom-6`** "a resource should have narrative", once per resource — a
  *best-practice recommendation*, not a constraint. We deliberately send no
  XHTML narrative: it would duplicate the structured data, and in an identified
  bundle it would restate PHI as unstructured text a receiver cannot
  selectively redact.
- **"CodeSystem is unknown and can't be validated"** — our own local code
  systems, plus `http://hl7.org/fhir/sid/icd-10`, which the public HAPI instance
  does not have loaded. Notably the SNOMED CT codes validate clean, which
  confirms those are real codes.

---

## 4. Transmit — HTTPS, allow-listed, credentialled

The function cannot be handed a URL by its caller. It is handed an **endpoint
id** to look up in `public.interop_endpoints`, and:

- `base_url` carries a check constraint `~ '^https://[^/?#]+'`, so **plaintext
  HTTP cannot be stored**, let alone transmitted. "Transmits over secure HTTPS"
  is a database invariant, not a line of TypeScript somebody could change.
- `interop_endpoint_dispatch()` re-checks HTTPS, refuses an inactive endpoint,
  refuses an endpoint that declares an auth scheme with no credential loaded,
  and the function checks the scheme again before `fetch`.
- The request is sent as `application/fhir+json; charset=utf-8` with a 20-second
  abort timeout.

The seeded endpoint is the HAPI public R4 test server, so the pipeline
demonstrates end to end with no setup. Payloads bound for a known public
reference server are tagged `HTEST` (*test health data*), so no unmarked
Philippine health data ever sits in a sandbox anyone can read back.

---

## 5. Privacy controls (RA 10173, Data Privacy Act of 2012)

### 5.1 Encryption at rest — two layers

**Platform.** Supabase Postgres volumes and backups are encrypted with AES-256
at the storage layer. That covers a stolen disk or a leaked backup file, and
nothing else — a query with valid credentials still returns plaintext.

**Column-level, which is the layer that matters here.** The two fields whose
disclosure would actually hurt are encrypted individually with `pgcrypto`
AES-256, via PGP symmetric encryption (random session key and integrity check
per value, so two identical payloads do not produce identical ciphertext):

| Column | Why |
| --- | --- |
| `interop_audit_log.payload_cipher` | the transmitted FHIR bundle — PHI |
| `interop_endpoints.credential_cipher` | the bearer token / API key / basic pair |

Key custody: the key lives in `bantay_private.crypto_keys`, in a schema
deliberately **absent from `[api].schemas`** in `supabase/config.toml`, so
PostgREST exposes it at no URL and no API role holds `usage` on the schema. It
is readable only through a `SECURITY DEFINER` function. The 32 bytes are
generated by `gen_random_bytes(32)` inside the database, so the key never
transits the network and never appears in an environment variable.

**Stated limitation.** The key and the ciphertext sit in the same cluster. This
defeats table-level disclosure — a leaked `service_role` key, a `select *` from
a compromised client, a logical dump opened by someone without the definer
function — but not a full superuser compromise. Production custody moves the
key to Supabase Vault or an external KMS without touching a single caller,
because `interop_encrypt` / `interop_decrypt` are the only two places in the
system that resolve a key.

### 5.2 Access control

| Control | Mechanism |
| --- | --- |
| JWT signature verified before the function runs | `verify_jwt = true` (`scripts/deploy-functions.mjs`) |
| Which cases may be exported | RLS, because the extract runs as the caller |
| Who may preview a payload | **system admin only** — Edge Function role gate |
| Who may transmit outside BANTAY-TB | **system admin only** — Edge Function role gate |
| Who may lift pseudonymisation | **system admin only** — Edge Function role gate |
| Who may see or manage endpoints | **system admin only** — `is_super_admin()` in RLS |
| Who may read the audit trail | **system admin only** — `is_super_admin()` in RLS |
| Who may verify the hash chain | **system admin only** — `verify_interop_audit()` |
| Who may read a stored payload back | **system admin only** — `interop_payload()`, and the read is itself logged |
| Who may rotate a credential | **system admin only** — `interop_set_credential()`, audited |

**One role, and it cannot cover its own tracks.** Sharing patient records
outside BANTAY-TB is a system-administrator act end to end: **Admin → FHIR
Interoperability** (`/app/interoperability`) to send, **Admin → Audit Log**
(`/app/audit-log`) to review. The same role acting and reviewing is safe here
*because* the log is append-only: the admin's own previews, transmissions and
payload reads are recorded in a trail the admin cannot edit, delete or
truncate, and an edit made by bypassing the application breaks the hash chain.

This is enforced by the database and the Edge Function, not by hiding pages.
A TB coordinator calling the function directly is refused and logged; querying
`interop_audit_log` or `interop_endpoints` returns zero rows; calling
`verify_interop_audit()` or `interop_set_credential()` raises.

Credentials are never exposed to a browser. `credential_cipher` is **absent
from every column-level grant**, so no API role can select it — not even with a
leaked `service_role` key. `interop_endpoint_dispatch` holds `EXECUTE` for
`service_role` alone and returns a *composed header*, so the credential's shape
never enters the function's code. The UI sees only `credential_hint` —
`...a93f`, the last four characters.

### 5.3 Minimum necessary (s.11)

The default disclosure scope is **`pseudonymous`**:

| Sent | Withheld |
| --- | --- |
| TB case code as business identifier | patient name |
| gender, birth **year** (derived from age) | contact number |
| barangay name, barangay **centroid** | street address, household coordinates |
| diagnosis, outcome | clinical free-text notes |

The bundle labels itself: `meta.security` carries v3-Confidentiality `R`
(*restricted*) and v3-ObservationValue `PSEUDED` (*pseudonymized*), so a
receiver can enforce handling rules without parsing the payload.

An **`identified`** bundle — name, phone, street, household coordinates,
clinical notes — is a separate, deliberate act: a distinct checkbox, the
`PSEUDED` label dropped, and `disclosure_scope = 'identified'`
written into the audit row.

Birth year rather than a full birth date is not laziness. BANTAY-TB only ever
recorded an age in years; asserting a full `birthDate` would be fabricating
data *and* disclosing more than we hold.

### 5.4 Active immutable audit log

`public.interop_audit_log` records every event in the pipeline:
`payload_previewed`, `transmit_success`, `transmit_failure`, `payload_viewed`,
`access_denied`, `endpoint_credential_set` — with actor, role, email, case
label, endpoint URL **snapshotted at send time**, disclosure scope, resource
count, byte count, SHA-256, HTTP status, latency, and the encrypted payload.

Immutability is enforced four ways, because any one alone is a promise rather
than a control:

1. **Privileges.** `revoke all` from `anon`, `authenticated` and `service_role`,
   then `grant select` on 23 of 24 columns to `authenticated` — no INSERT,
   UPDATE or DELETE grant to any API role at all. Writes arrive only through
   `interop_log_event()`, a `SECURITY DEFINER` function.
2. **Triggers.** `BEFORE UPDATE`, `BEFORE DELETE` and `BEFORE TRUNCATE` triggers
   raise `insufficient_privilege` regardless of role — so even the table owner
   cannot quietly rewrite a row, and `TRUNCATE` cannot wipe the trail in one
   statement (row triggers never fire for truncate, which is why the statement
   trigger is there).
3. **Hash chain.** A `BEFORE INSERT` trigger seals each row:
   `record_hash = SHA-256(prev_hash ‖ seq ‖ event ‖ case_id ‖ endpoint_url ‖
   actor_id ‖ disclosure_scope ‖ payload_sha256 ‖ http_status ‖ outcome ‖
   created_at)`. The caller does not choose its own place in the chain. The
   timestamp is hashed as UTC via `to_char`, not `::text`, so a verifier in a
   different session timezone computes the same digest.
4. **Verification.** `public.verify_interop_audit()` recomputes the whole chain
   and returns a per-row verdict. Edit a row out of band and its `record_hash`
   stops matching its contents; delete one and the next row's `prev_hash` stops
   matching its predecessor. The **Verify audit chain** button on the system
   admin's Audit Log page runs this live.

Two correctness details in the chain itself. Appends take
`pg_advisory_xact_lock` before reading the tail row, because two concurrent
transactions would otherwise chain themselves to the same predecessor and fork
the chain — verification would then report tampering where none happened. And a
**gap in `seq` is not evidence of anything**: a rolled-back transaction consumes
a sequence value without leaving a row. Deletion is caught by the hash linkage,
not by counting.

Two design notes worth defending:

- **Previews keep no payload copy** — only the digest. A preview is not a
  disclosure to anyone, so there is nothing to retain; the SHA-256 is still
  enough to prove later that a given payload is the one that was previewed.
- **Response bodies are summarised, never stored raw.** Only the status line
  and per-entry outcomes are kept, so a verbose endpoint cannot echo the PHI we
  just sent straight back into our own audit log.
- **A failed audit append fails the operation visibly.** If the payload went out
  but the audit write failed, the API returns `ok: false` and the UI shows a red
  "treat this disclosure as unrecorded and report it" banner, rather than a
  green tick. A disclosure that cannot be recorded is not a compliant
  disclosure.

---

## 6. Running it

### Deploy

```bash
# 1. database layer
supabase db push                # or: supabase migration up

# 2. the integration service
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ACCESS_TOKEN=<personal access token> \
node scripts/deploy-functions.mjs     # deploys fhir-export with verify_jwt=true
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into Edge Functions by the platform; no secret needs to be configured by hand.

### Demonstrate

1. Sign in as the **system administrator** and open **Admin → FHIR
   Interoperability** (`/app/interoperability`).
2. Pick a case; pick **HAPI FHIR R4 public test server**.
3. **Preview payload** → the FHIR bundle, its SHA-256 and its resource list.
4. **Transmit** → `HTTP 200`, latency, and the ids the receiver assigned
   (`Patient/12345/_history/1`, …).
5. Open **Admin → Audit Log** (`/app/audit-log`). The transmission is there.
6. **Verify audit chain** → every entry reports *verified*.
7. **View payload** on the transmission → the decrypted bundle. Close it: a new
   `payload_viewed` entry has appeared — reading the record was itself recorded.
8. Sign in as the TB coordinator: neither page is in the sidebar, and opening
   `/app/interoperability` directly redirects away.

### Prove the audit log really is immutable

```sql
-- as the table owner, in the SQL editor:
update public.interop_audit_log set http_status = 200 where seq = 1;
-- ERROR: public.interop_audit_log is append-only: UPDATE is not permitted
--        (RA 10173 audit trail)

delete from public.interop_audit_log where seq = 1;
-- ERROR: ... DELETE is not permitted ...

truncate public.interop_audit_log;
-- ERROR: ... TRUNCATE is not permitted ...
```

### Regenerate the sample payload

```bash
npm run fhir:sample     # -> docs/fhir-sample-payload.json
npm test                # 35 serializer tests
```

The sample is produced by the **same serializer the Edge Function runs**, from
a synthetic Buhangin case. If the sample and the live pipeline ever disagree,
that is a bug in one of them, not a stale document.

---

## 7. Integration-engine route (Mirth Connect)

The database layer is transport-agnostic, so the same pipeline runs through an
integration engine with no schema change:

1. In Mirth, create a channel with an **HTTP Listener** source connector on an
   HTTPS port, accepting `application/fhir+json`.
2. Register it as an endpoint:

```sql
insert into public.interop_endpoints (name, kind, base_url, auth_scheme, notes)
values (
  'Mirth Connect — TB referral channel',
  'mirth_channel',
  'https://mirth.example.ph:8443/fhir/tb-case',
  'bearer',
  'HTTP Listener source; JavaScript transformer routes to the DOH ITIS destination.'
);

select public.interop_set_credential('<endpoint id>', '<channel token>');
```

3. Select it in the UI. Everything else — serialization, HTTPS, the audit
   chain, the encrypted payload copy — is unchanged, because what varied was
   only the row in `interop_endpoints`.

Mirth's own value starts *after* this boundary: fan-out to several
destinations, HL7 v2 ↔ FHIR translation for legacy receivers, store-and-forward
retry. We chose the native route because the pipeline this task asks for is a
single outbound FHIR transmission, and putting a second runtime in front of it
would add an unaudited hop between the database and the receiver — the audit
trail would end at Mirth's door rather than at the destination.

---

## 8. Known limitations

- **Outbound only.** There is no inbound FHIR endpoint; BANTAY-TB does not yet
  accept a bundle from another system. That needs matching logic (is this
  `Patient` one of ours?) and a merge policy, which is a bigger design problem
  than transmission.
- **No retry queue.** A failed transmission is recorded as
  `transmit_failure` and must be retried by hand. A durable outbox table with
  a scheduled retry would close this.
- **Encryption key co-resident with the data** — see §5.1.
- **No narrative** on resources (`dom-6`), by choice — see §3.
- **Local code systems are not published.** The
  `https://bantay-tb.davao.gov.ph/fhir/CodeSystem/…` URIs are canonical
  identifiers, not resolvable documents. A real deployment publishes a
  `CodeSystem` resource at each.
