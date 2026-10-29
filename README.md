# bantay-tb

Barangay-level TB surveillance and hotspot mapping system for Davao City.

## HL7 FHIR interoperability

The outbound interoperability pipeline — extract a case from PostgreSQL,
serialise it to an HL7 FHIR R4 transaction bundle, transmit it over HTTPS to an
external health information system, and record the disclosure in an
append-only, hash-chained audit log.

| | |
| --- | --- |
| **Pipeline documentation** | [`docs/FHIR-INTEROP.md`](docs/FHIR-INTEROP.md) |
| **Integration service** | [`supabase/functions/fhir-export/`](supabase/functions/fhir-export/) |
| **FHIR R4 serializer** | [`supabase/functions/_shared/fhir.ts`](supabase/functions/_shared/fhir.ts) |
| **Database layer** (endpoints, audit log, encryption) | [`supabase/migrations/20261019000000_fhir_interoperability.sql`](supabase/migrations/20261019000000_fhir_interoperability.sql) |
| **Operator UI** | [`src/pages/app/Interoperability.tsx`](src/pages/app/Interoperability.tsx) → `/app/interoperability` |
| **Sample payload** | [`docs/fhir-sample-payload.json`](docs/fhir-sample-payload.json) |
| **Tests** | [`src/__tests__/fhirBundle.test.ts`](src/__tests__/fhirBundle.test.ts) |

```bash
npm run fhir:sample   # regenerate the sample payload from the live serializer
npm test              # 176 tests, 31 of them over the FHIR serializer
```

## Development

```bash
npm install
npm run dev           # Vite dev server on :5173
npm run build         # tsc -b && vite build
npm run lint
npm run typecheck
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a local `.env`.
