# BANTAY-TB — Defense Guide (AT1)

10–12 minutes. Each member presents at least one of slides 4–7.

| Slide | Who | Time |
| --- | --- | --- |
| 1 · System Identification | Member 1 | 1 min |
| 2 · 4 HIS Functions | Member 1 | 2 min |
| 3 · Live Demo | Member 2 | 3 min |
| 4 · Mapping | Member 1 | 1 min |
| 5 · Pipeline & Failures | Member 2 | 1 min |
| 6 · RA 10173 | Member 3 | 1 min |
| 7 · Core Serialization Function | Member 4 | 1 min |
| 8 · Wrap-Up | Member 4 | 1 min |

---

## Slide 1 — System Identification

**Say:**
- "We are Group __. Our system is BANTAY-TB, a TB surveillance system for Davao City."
- "Problem: TB case data was stuck inside our app. Sending it to DOH ITIS meant re-typing it by hand."
- "Our bridge sends a case as a standard HL7 FHIR R4 file in one HTTPS request."
- "Target: DOH ITIS, simulated by the HAPI FHIR test server."

---

## Slide 2 — 4 HIS Functions

**Point at each box and say one line:**

| Box | Say | File |
| --- | --- | --- |
| Data Generation | "Nurses encode cases in our form." | [CaseFormPage.tsx](../src/pages/app/CaseFormPage.tsx) |
| Compilation | "Data is saved in PostgreSQL with validation rules." | [tb_register_fields.sql](../supabase/migrations/20261020000000_tb_register_fields.sql) |
| Analysis & Synthesis | "Clicking Transmit runs our Edge Function, which builds the FHIR file." | [fhir-export/index.ts](../supabase/functions/fhir-export/index.ts) |
| Communication & Use | "It is sent over HTTPS to the FHIR server." | [index.ts:608](../supabase/functions/fhir-export/index.ts#L608) |

---

## Slide 3 — Live Demo

**Do:**
1. Log in as **System Admin** → **Admin › FHIR Interoperability**
2. Pick a case + **HAPI FHIR R4** → click **Preview** → click **Transmit**
3. Show **HTTP 200** and the assigned IDs
4. Supabase → **Edge Functions › fhir-export › Logs** → "this is the backend processing"
5. Postman → `GET https://hapi.fhir.org/baseR4/Patient/<id>` → "proof the server received it"
6. **Admin › Audit Log** → click **Verify audit chain**

If it fails: play the backup video.

---

## Slide 4 — Mapping (Defense Prompt 1)

**Show:** the JSON next to the database columns.

| Show this | File |
| --- | --- |
| Database columns we export | [index.ts:74-99](../supabase/functions/fhir-export/index.ts#L74-L99) |
| Patient JSON | [fhir-sample-payload.json:123](fhir-sample-payload.json#L123) |
| Condition JSON | [fhir-sample-payload.json:265](fhir-sample-payload.json#L265) |

**Say:**
- "We use a **Bundle** so all the resources are sent together in one request."
- "**Patient** holds who the patient is. **Condition** holds the TB diagnosis."
- Data types:
  - `identifier` is an **array of objects**
  - `gender` is a **string**
  - `onsetDateTime` is an **ISO-8601 date**
  - `recordedDate` is an **ISO-8601 timestamp**
- "A suspected case gets code **Z03.0**, so we never send a diagnosis nobody made."

---

## Slide 5 — Pipeline & Failures (Defense Prompt 2)

**Show:** screenshot of [index.ts:608-653](../supabase/functions/fhir-export/index.ts#L608-L653)

**Say, line by line:**

| Lines | What it does |
| --- | --- |
| [610-616](../supabase/functions/fhir-export/index.ts#L610-L616) | Sets the headers. `application/fhir+json` tells the server "this is FHIR." |
| [617-619](../supabase/functions/fhir-export/index.ts#L617-L619) | Adds the login token for the server. |
| [621-622](../supabase/functions/fhir-export/index.ts#L621-L622) | Starts a **20-second timer**. If the server is too slow, we cancel. |
| [629-635](../supabase/functions/fhir-export/index.ts#L629-L635) | **Sends** the FHIR file with a POST request. |
| [636-637](../supabase/functions/fhir-export/index.ts#L636-L637) | Saves the server's reply and status code. |
| [638-644](../supabase/functions/fhir-export/index.ts#L638-L644) | If sending **fails**, saves the error message. |
| [645-647](../supabase/functions/fhir-export/index.ts#L645-L647) | Stops the timer. |
| [650](../supabase/functions/fhir-export/index.ts#L650) | Counts it as a success **only if the status is 200–299**. |
| [655-684](../supabase/functions/fhir-export/index.ts#L655-L684) | Writes the result to the **audit log**. |

**If the server fails:**

| Problem | What happens |
| --- | --- |
| Server offline | Error is caught → logged as `transmit_failure` |
| Server too slow | Cancelled after 20 s → "timed out" |
| HTTP 500 / 503 | Not 2xx → logged as failure with the status code |

"There is no automatic retry yet. The admin sends it again manually."

---

## Slide 6 — RA 10173 (Defense Prompt 3)

**Show:** screenshots from the Supabase SQL Editor.

```sql
-- 1. Encrypted data (unreadable hex = proof of AES-256)
select seq, left(encode(payload_cipher, 'hex'), 40) as encrypted
from public.interop_audit_log where payload_cipher is not null limit 3;

-- 2. Audit log: request ID, timestamp, status
select seq, fhir_bundle_id, created_at, event, http_status
from public.interop_audit_log order by seq desc limit 5;

-- 3. Try to delete (should ERROR = proof it cannot be changed)
delete from public.interop_audit_log where seq = 1;
```

**Say:**
- "Sensitive data is encrypted with **AES-256**." → [migration:90-97](../supabase/migrations/20261019000000_fhir_interoperability.sql#L90-L97)
- "The audit log records the request ID, timestamp and status." → [migration:182-226](../supabase/migrations/20261019000000_fhir_interoperability.sql#L182-L226)
- "No one can edit or delete it, not even the admin." → [migration:344-356](../supabase/migrations/20261019000000_fhir_interoperability.sql#L344-L356)
- "We only send the case code, birth year and barangay, never the name or phone."

---

## Slide 7 — Core Serialization Function (Defense Prompt 4)

**Show:** screenshot of [fhir.ts:219-291](../supabase/functions/_shared/fhir.ts#L219-L291) (`tbConditionCoding`)

**Say:**
1. **AI disclosure first:** "We used Claude Code for ___. We reviewed and tested it with 35 unit tests."
2. **What it does:** "It turns the TB site and diagnosis status into the correct ICD-10 and SNOMED code."
   - Suspected → **Z03.0**
   - Confirmed, lungs → **A15.0**
   - Clinically diagnosed, lungs → **A16.9**
   - Outside the lungs → **A18**
3. **Memory:** "It creates small new objects each time and keeps no shared data."
4. **Async:** "This function is not async. The async part is in [index.ts:474-486](../supabase/functions/fhir-export/index.ts#L474-L486), where `Promise.all` runs 3 queries at the same time."
5. **Formatting:** "Dates become YYYY-MM-DD ([fhir.ts:408](../supabase/functions/_shared/fhir.ts#L408)), and empty fields are removed ([fhir.ts:395](../supabase/functions/_shared/fhir.ts#L395))."

---

## Slide 8 — Wrap-Up

**Show:**
- Repo: `https://github.com/<user>/bantay-tb`
- Sample JSON: [fhir-sample-payload.json](fhir-sample-payload.json)

**Say:** "Thank you! We're ready for your questions."

---

## Quick answers to panel questions

| Question | Answer |
| --- | --- |
| Why not Mirth? | "We only send one file outbound. Mirth adds an extra step our audit log can't see." |
| Is HAPI the real DOH? | "No, it's a test server. Our data is tagged as test data." |
| Is the JSON valid? | "Yes, the HAPI validator found 0 errors." |
| Who can send records? | "Only the System Admin." |
| Weaknesses? | "Outbound only, no auto-retry, and the key is in the same database." |
