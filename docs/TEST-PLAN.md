# BANTAY-TB — Software Test Plan

| | |
| --- | --- |
| **PROJECT NAME** | BANTAY-TB: Web-Based Tuberculosis Case Surveillance, and Hotspot Mapping System for Davao City |
| **TEST PLAN ID** | BTB-TP-001 (Rev. 1.0) |
| **CREATED BY** | Jaydee Magkidong — QA Lead, BANTAY-TB Capstone Team |
| **DATE OF CREATION** | October 1, 2026 |
| **DATE OF REVIEW** | October 8, 2026 |

**Scope.** This plan covers system, integration, and acceptance testing of the BANTAY-TB web application (React 18 + TypeScript + Vite front end, Supabase/PostgreSQL back end with Row-Level Security, Deno Edge Functions, MapLibre/Leaflet GIS layer). Testing is performed against the staging Supabase project with seeded demo data; no live patient data is used.

**Test levels.** Unit (Vitest, `src/__tests__/`) → Integration (front end ↔ Supabase RLS and Edge Functions) → System/end-to-end (role-based user journeys) → UAT (adviser plus BHW/nurse reviewers) → Regression before each milestone build.

**Pass/fail convention.** A test item passes when 100% of its High-severity cases pass and at least 90% of Medium/Low cases pass, with every remaining defect logged, triaged, and accepted by the adviser.

---

## Test Items

### TI-01 — Authentication & Staff Registration

- **Test Strategy:** Manual black-box scenario testing per role, paired with Vitest unit tests on the invite helpers; negative-path driven (wrong code, expired code, reused code).
- **Test Type:** Functional, Security (authorization), Negative
- **Features To Be Tested:** Email/password login (`/login`); staff self-registration gated by invite code (`/register/staff`); forgot/reset password; invite-code issuance and single-use consumption (`/app/invites`); an account with no staff role (`patient` in the database) being shown nothing in the app; session persistence and logout; redirect of unauthenticated users.
- **Features Not To Be Tested:** Supabase Auth internals (token signing, email delivery infrastructure); third-party SMTP deliverability; OAuth/social login (not implemented); patient accounts (not offered — patients use the public site anonymously).
- **Entry Criteria:** Staging Supabase project migrated to the latest migration; at least one `system_admin` and one `tb_coordinator` seeded; invite-code table reachable; `npm run dev` serves without console errors.
- **Exit Criteria:** All High-severity auth cases pass; no invite code can be redeemed twice; no self-registration path grants a privileged role without a valid code; zero open Critical/High defects.
- **Deliverables:** Test cases TC-01-01…TC-01-14; executed test log; defect report; screenshots of each flow; Vitest run output.
- **Start Date:** Oct 6, 2026 — **End Date:** Oct 9, 2026
- **Assignee:** Member 1 (QA Lead)
- **Risk Analysis:** *High.* A flaw here exposes patient records. Roles are assigned by the invite flow — not by the registration form — so any gap lets a user mint their own privileges. Residual risk: password-reset emails cannot be fully verified on the free tier; mitigated by testing the token path directly.

### TI-02 — Role-Based Access Control & Area/Facility Scoping (RLS)

- **Test Strategy:** Permission-matrix testing — each of the four staff roles (`system_admin`, `tb_coordinator`, `barangay_admin`, `health_worker`) plus an account with no staff role is driven against every guarded route and table; backed by `areaScope.test.ts` and `caseAttribution.test.ts`.
- **Test Type:** Security, Functional, Integration (database policy)
- **Features To Be Tested:** `RequireRole` route guards on every app route; RLS policies on `cases`, `hotspots`, `alerts`, `profiles`; residence (`barangay_psgc`) versus treatment-facility (`facility_id`) scoping; an account with no staff role reading no case data; citywide read for coordinators versus barangay-only read for barangay admins and BHWs; direct-URL access attempts and API calls that bypass the UI.
- **Features Not To Be Tested:** PostgreSQL's own policy engine; service-role key behavior (server-side only); penetration testing of the hosting platform.
- **Entry Criteria:** TI-01 passed; one test account per role seeded across at least two barangays and two DOTS facilities; permission matrix reviewed and signed off.
- **Exit Criteria:** Every cell of the permission matrix matches the specification; no cross-barangay or cross-facility record leaks through the UI or a direct Supabase query; all guarded routes redirect unauthorized roles.
- **Deliverables:** Role × route × table permission matrix (filled); negative-access evidence log; RLS test queries; defect report.
- **Start Date:** Oct 9, 2026 — **End Date:** Oct 14, 2026
- **Assignee:** Member 1 (QA Lead) with Member 4 (Back-End/DB)
- **Risk Analysis:** *Critical.* The highest-risk item in the plan — a leak is both a privacy breach and a Data Privacy Act compliance failure. Residence and treatment facility are two independent axes, so scoping bugs are easy to introduce and hard to see; demo facility links are synthetic backfill, which can mask a real-world mismatch. Mitigated by testing at the database layer, not only through the UI.

### TI-03 — Case Filing, Case List & Case Management

- **Test Strategy:** Equivalence partitioning and boundary analysis on the case form, plus CRUD lifecycle walkthroughs per role; `caseFiling.test.ts` and `facilityFlows.test.ts` as the unit safety net.
- **Test Type:** Functional, Data validation, Regression
- **Features To Be Tested:** New case filing (`/app/cases/new`); required-field and format validation (age, sex, diagnosis date, TB site, diagnosis status, treatment outcome); residence address capture and barangay resolution; DOTS treatment-facility assignment; case list filtering, search, and pagination (`/app/cases`); case detail view; edit and status transitions; realtime case updates; audit of who filed each case.
- **Features Not To Be Tested:** Deletion of historical cases (intentionally restricted); DOH ITIS integration (out of scope); printed clinical forms.
- **Entry Criteria:** TI-02 passed; barangay PSGC reference data and DOTS centers loaded (`dots_centers_davao.sql`); case-form field specification final.
- **Exit Criteria:** No invalid case can be saved; every saved case carries the correct residence barangay, facility, and filer attribution; filters and search return correct result sets; status transitions follow the allowed sequence.
- **Deliverables:** Test cases TC-03-01…TC-03-22; boundary-value table; executed log with screenshots; defect report.
- **Start Date:** Oct 12, 2026 — **End Date:** Oct 17, 2026
- **Assignee:** Member 2 (Front-End)
- **Risk Analysis:** *High.* Case records feed the map, the hotspot engine, and every chart downstream, so a validation gap propagates silently. Diagnosis status must stay distinct from treatment outcome — conflating them corrupts the surveillance picture. Mitigated by validating at both the form layer (Zod) and the database layer.

### TI-04 — Bulk Excel Import & Data Migration

- **Test Strategy:** File-based destructive and non-destructive testing with crafted workbooks — valid, partially invalid, wrong headers, duplicate rows, empty file, oversized file; `importScope.test.ts` as the scope guard.
- **Test Type:** Functional, Data integrity, Negative, Boundary
- **Features To Be Tested:** Excel upload and parsing (`/app/import`, SheetJS); header and column mapping; per-row validation with a reviewable error report; append-only behavior for BHW/nurse/doctor imports, including automatic stamping of the importer's assignment; coordinator-only replace-all import; duplicate detection; import audit trail and stored file in the `excel_imports` bucket; rollback on failure.
- **Features Not To Be Tested:** Microsoft Excel itself; CSV and Google Sheets import (not supported); imports above the documented row ceiling.
- **Entry Criteria:** TI-03 passed; `dummy_tb_cases.xlsx` plus five crafted negative-case workbooks prepared; storage-bucket migration applied.
- **Exit Criteria:** No malformed row is ever persisted; a field-role import can only add records, never replace existing ones; replace-all is reachable only by a coordinator; row counts reconcile exactly before and after each import.
- **Deliverables:** Test workbook set (valid plus five negative); import reconciliation sheet; error-report screenshots; defect report.
- **Start Date:** Oct 15, 2026 — **End Date:** Oct 20, 2026
- **Assignee:** Member 2 (Front-End) with Member 4 (Back-End/DB)
- **Risk Analysis:** *High.* The replace-all path can destroy existing records, so it must be provably coordinator-only; an append-only role that gains replace rights is a data-loss defect, not merely a permission defect. Residual risk: real DOH workbooks may use column layouts the team has not seen — mitigated by testing against the actual facility-supplied template.

### TI-05 — GIS Mapping & Geospatial Resolution

- **Test Strategy:** Exploratory testing with visual verification against known Davao City coordinates; unit tests in `nearestBarangay.test.ts`; cross-browser map rendering checks.
- **Test Type:** Functional, Usability, Compatibility, Performance
- **Features To Be Tested:** Case map rendering (`/app/map`, `AdminHotspotMap`, MapLibre/OpenFreeMap basemap); barangay boundary overlay; heatmap layer (`leaflet.heat`); marker clustering and popups; address-to-barangay resolution with nearest-barangay fallback (`barangayResolver.ts`, `geocode.ts`); public case map (`PublicCaseMap`) showing aggregated, non-identifying counts; DOTS facility locator (`/dots-locator`) with device geolocation; zoom, pan, and layer toggles.
- **Features Not To Be Tested:** Accuracy of third-party basemap tiles and the geocoder; GPS hardware precision; offline map caching.
- **Entry Criteria:** TI-03 passed; barangay GeoJSON boundaries and DOTS center coordinates loaded; at least 150 seeded cases spread across 10 or more barangays; map tile endpoint reachable.
- **Exit Criteria:** Every seeded case plots in its correct barangay; boundaries align with plotted points; the public map exposes no individual-level location; the map is interactive within 3 seconds on the target build; renders correctly in Chrome, Edge, and Firefox.
- **Deliverables:** Geocoding accuracy spot-check table (30 addresses); annotated map screenshots per layer; browser compatibility matrix; defect report.
- **Start Date:** Oct 19, 2026 — **End Date:** Oct 24, 2026
- **Assignee:** Member 3 (GIS/Analytics)
- **Risk Analysis:** *Medium-High.* A mis-resolved address moves a case into the wrong barangay and quietly skews hotspot output. Patient privacy is at stake on the public map, where only aggregates may appear. Residual risk: tile and geocode provider rate limits during the demo — mitigated by a cached fallback basemap.

### TI-06 — Hotspot Detection (Moran's I + Getis-Ord Gi*) & Alert Generation

- **Test Strategy:** Algorithm testing against PySAL `esda` (`Moran(rates, w_rowstd, permutations=999)`, `G_Local(rates, w_binary, transform="B", star=True)`) on the same values and queen weights; planted-hotspot detection on a synthetic barangay dataset; hand-computed Gi* on toy maps; `spatialStats.test.ts`, `hotspotAlerts.test.ts`, `hotspotRefresh.test.ts`.
- **Test Type:** Functional, Algorithmic correctness, Integration (Edge Function), Performance
- **Features To Be Tested:** Queen-contiguity weights (`barangayNeighbors.json` / `barangay_neighbors`, built by `scripts/build-barangay-neighbors.ts`); Global Moran's I and Local Gi* (`supabase/functions/_shared/spatial.ts`); Gi* z-score classification (±1.96 / ±2.58); rate-per-100,000 input when population is loaded, case-count fallback otherwise; `detect-hotspots` Edge Function run storage (`hotspot_runs`, `hotspot_results`) and current-hotspot replacement (`hotspots`); Gi* choropleth and Moran's I card (`/app/hotspots`); hotspot settings (`hotspotSettings.ts`); alert on a barangay newly classified as a 95% hotspot, routed by residence barangay.
- **Features Not To Be Tested:** Epidemiological validity of a hotspot for declaring a real outbreak (clinical judgment, not software); predictive forecasting (not implemented).
- **Entry Criteria:** TI-05 passed; synthetic barangay dataset with planted hotspots prepared; PySAL environment available; Edge Function deployed to staging.
- **Exit Criteria:** Moran's I, E[I] and z match PySAL to 1e-6; Gi* z-scores match PySAL to 1e-6 with 100% class agreement; planted hotspots detected with false positives only adjacent to the planted area; no duplicate hotspots after repeated refresh; a barangay that stays a hotspot across runs raises no repeat alert; a run over 182 barangays completes within the documented time budget.
- **Deliverables:** PySAL agreement table (max |Δz|, % class agreement); planted-vs-detected table (sensitivity, precision); Edge Function logs with run durations; defect report.
- **Start Date:** Oct 22, 2026 — **End Date:** Oct 28, 2026
- **Assignee:** Member 3 (GIS/Analytics)
- **Risk Analysis:** *High.* A false negative hides a real cluster from health workers; a false positive wastes scarce field resources. Output is only as good as TI-05's geocoding, so defects can originate upstream. Residual risk: no ground-truth outbreak data is available for validation — mitigated by synthetic datasets with known answers plus adviser review of the parameters.

### TI-07 — Diagnosis Recording & Treatment Enrollment

- **Test Strategy:** State-transition testing of a case from presumptive → diagnosed → enrolled, with the client rule (`enrollment.ts`) compared line for line against the server rule (`case_enrollable()`); `enrollment.test.ts` as the unit safety net.
- **Test Type:** Functional, State-transition, Security (authorization), Negative
- **Features To Be Tested:** Recording a diagnosis (`RecordDiagnosisPanel`); enrolling a verified case on treatment (`EnrollPatientPanel`, `enroll_patient()`); every refusal reason (`not_diagnosed`, `already_enrolled`, `treatment_closed`, `name_missing`, `out_of_scope`); `enrolled_at` / `enrolled_by` stamped on the case; the "not yet enrolled" register filter.
- **Features Not To Be Tested:** Dose-by-dose adherence monitoring and SMS reminders (removed — no CHO budget); patient accounts (not offered).
- **Entry Criteria:** TI-02 and TI-03 passed; seeded cases in each diagnosis state, including unnamed imported rows and closed outcomes.
- **Exit Criteria:** Only a diagnosed, named, ongoing case inside the user's scope can be enrolled; every refusal surfaces the matching reason; a case cannot be enrolled twice; client and server rules agree on every seeded case.
- **Deliverables:** Case state-transition diagram with results; refusal-reason matrix; defect report.
- **Start Date:** Oct 26, 2026 — **End Date:** Nov 2, 2026
- **Assignee:** Member 4 (Back-End/DB)
- **Risk Analysis:** *Medium.* Enrollment marks the point a case is counted as on treatment, so a wrong enrollment inflates the treatment figures. The rule lives in two places (SQL and the client mirror), so drift between them is the likeliest defect. Mitigated by testing the server function directly, not only through the UI.

### TI-08 — Health Education & Chatbot

- **Test Strategy:** Scenario-based testing with clinically reviewed input sets; content review against DOH NTP material; `articleBlocks.test.ts` for content rendering.
- **Test Type:** Functional, Content accuracy, Usability
- **Features To Be Tested:** symptom infographic and icon rendering (`SymptomInfographic`, `SymptomIcon`); health-education articles for the eight respiratory conditions bundled in `src/` (TB, COPD, asthma, bronchitis, pneumonia, influenza, COVID-19, paragonimiasis); public learn page (`/learn`); chatbot Edge Function responses in-app (`/app/chatbot`) and on the public FAB (`PublicChatbotFab`); refusal and escalation behavior on out-of-scope or emergency questions.
- **Features Not To Be Tested:** Diagnostic accuracy as a medical device (the tool is advisory only); the language-model provider's internals; content in languages beyond the three supported.
- **Entry Criteria:** TI-01 passed; chatbot Edge Function deployed with a working key; adviser or clinical reviewer available for content sign-off; 20 scripted patient questions prepared, including five emergency and five out-of-scope prompts.
- **Exit Criteria:** All eight condition articles render completely in all three languages; the chatbot never gives a definitive diagnosis and escalates every emergency prompt to seek-care-immediately guidance; the clinical reviewer signs off on the content.
- **Deliverables:** Chatbot transcript log (20 prompts); content review sign-off sheet; defect report.
- **Start Date:** Oct 30, 2026 — **End Date:** Nov 5, 2026
- **Assignee:** Member 5 (Content/UX) with the clinical reviewer
- **Risk Analysis:** *High (safety rather than technical).* Wrong clinical content can cause real harm and is the most likely source of panel objections. A chatbot that sounds authoritative is more dangerous than one that defers. Mitigated by mandatory human review of every recommendation string and by explicit refusal testing.

### TI-09 — Analytics, Dashboards & Reporting

- **Test Strategy:** Data-driven verification — every chart figure recomputed independently in SQL against the same seeded dataset, then cross-checked across dashboards for consistency.
- **Test Type:** Functional, Data accuracy, Regression
- **Features To Be Tested:** Role dashboards (`/app/dashboard`, `/app/admin`); analytics charts and trends (`/app/analytics`); case counts by barangay, facility, TB site, diagnosis status, and treatment outcome; ACF (active case finding) presumptive-screening yield reported separately from active cases on treatment; period filters and date ranges; empty-state and single-record states; export of report figures; `DotsCentersAdmin` and `Users` admin tables.
- **Features Not To Be Tested:** Statistical significance testing; official DOH report-form generation; historical data prior to the seeded period.
- **Entry Criteria:** TI-03 and TI-04 passed; frozen seeded dataset with independently known totals; indicator definitions documented and agreed.
- **Exit Criteria:** Every displayed figure matches its independently computed SQL value exactly; the same indicator agrees across all dashboards; presumptive and active-case counts are never summed into one total; empty states render without errors.
- **Deliverables:** Chart-versus-SQL reconciliation workbook; indicator definition sheet; dashboard screenshots per role; defect report.
- **Start Date:** Nov 2, 2026 — **End Date:** Nov 7, 2026
- **Assignee:** Member 3 (GIS/Analytics)
- **Risk Analysis:** *Medium-High.* ACF screening yield counts symptomatic/presumptive individuals, not confirmed cases — adding it to active cases on treatment inflates the numbers and is the single most likely reporting defect. Dashboards are also what the panel looks at first, so a visible inconsistency costs credibility. Mitigated by independent recomputation rather than eyeballing.

### TI-10 — Public Site, Trilingual Support & Cross-Device Usability

- **Test Strategy:** Checklist-based UI/UX review on real devices, plus automated i18n key-coverage checks (`i18n.test.ts`) and an informal usability session with five non-technical participants.
- **Test Type:** Usability, Compatibility, Accessibility, Localization, Responsive
- **Features To Be Tested:** Public landing, about, learn, and DOTS locator pages; navigation and page transitions; language switching across English, Filipino (Tagalog), and Cebuano with no missing or untranslated keys; text expansion without layout breakage; responsive layout at 360px, 768px, and 1280px widths; keyboard navigation, focus order, form labels, and color contrast; toast and error message clarity; loading and lazy-fallback states.
- **Features Not To Be Tested:** Full WCAG 2.1 AA certification; screen-reader support beyond basic landmark and label checks; browsers older than the two most recent major versions; native mobile apps.
- **Entry Criteria:** TI-01 through TI-09 feature-complete on the staging build; translation files complete for all three languages; test devices available (one Android phone, one tablet, one laptop); five usability participants recruited.
- **Exit Criteria:** No untranslated or missing key in any language; no horizontal scroll or clipped text at any tested width; all interactive controls reachable by keyboard; contrast ratios meet 4.5:1 for body text; participants complete the three core tasks unaided; zero open High usability defects.
- **Deliverables:** Device and browser compatibility matrix; i18n coverage report; usability session notes with task success rates and SUS scores; annotated screenshots; defect report.
- **Start Date:** Nov 5, 2026 — **End Date:** Nov 11, 2026
- **Assignee:** Member 5 (Content/UX)
- **Risk Analysis:** *Medium.* BHWs and patients are the real users, many on low-end Android phones over mobile data, so a desktop-only pass is not evidence. Cebuano and Tagalog strings are the likeliest to be stale because they are translated last; the files are UTF-8, and a careless tooling round-trip corrupts the trilingual content. Mitigated by automated key-coverage tests and native-speaker review.

### TI-11 — Regression, Build Integrity & Deployment Readiness

- **Test Strategy:** Automated regression suite on every build (`npm run lint`, `npm run typecheck`, `npm run test`), followed by a scripted smoke walkthrough of every role on the deployed Firebase build.
- **Test Type:** Regression, Smoke, Build verification, Non-functional (performance, security configuration)
- **Features To Be Tested:** Full Vitest suite (15 test files) green; zero TypeScript and ESLint errors; production build succeeds and the bundle loads; lazy-loaded route chunks resolve; environment variables and keys absent from the client bundle; Firebase Hosting deployment and SPA route rewrites; migrations applying cleanly from an empty database; first-load performance on a throttled 3G profile; graceful behavior when Supabase is unreachable.
- **Features Not To Be Tested:** Load and stress testing beyond the demo-scale dataset; disaster recovery and backup restoration; formal penetration testing; CI pipeline configuration (builds are manual for this project).
- **Entry Criteria:** TI-01 through TI-10 executed with no open Critical or High defects; release candidate tagged; migration chain verified in order; deployment checklist prepared.
- **Exit Criteria:** All automated checks pass on the release candidate; the smoke walkthrough passes for every role on the deployed URL; no secret or service-role key appears in the client bundle; first contentful paint under 3 seconds on the throttled profile; final test summary report signed by the adviser.
- **Deliverables:** Automated test run output; regression checklist; deployment verification log; bundle secret-scan result; final Test Summary Report and defect-closure log.
- **Start Date:** Nov 9, 2026 — **End Date:** Nov 14, 2026
- **Assignee:** Member 1 (QA Lead) with the full team
- **Risk Analysis:** *Medium-High.* This is the last gate before defense, so schedule pressure makes it the item most likely to be cut short — the automated suite partly protects against that. The most damaging possible defect is an exposed key in the client bundle, hence the explicit scan. Residual risk: the demo environment differs from a real DOH deployment; this is stated as a limitation in the final report.

---

## Defect Severity Definitions

| Severity | Definition | Resolution target |
| --- | --- | --- |
| Critical | Data loss, privacy breach, or system unusable; no workaround | Fix before any further testing |
| High | Core function wrong or blocked; patient-safety or reporting impact | Fix before the milestone build |
| Medium | Function works but is incorrect in some cases; workaround exists | Fix before defense |
| Low | Cosmetic, wording, or minor usability issue | Fix if schedule permits; otherwise document |

## Suspension & Resumption Criteria

Testing is **suspended** for a test item when a Critical defect blocks further cases, when the staging environment or Supabase project is unavailable for more than four hours, or when a migration breaks the seeded dataset. Testing **resumes** once the blocking defect is fixed and verified, the environment is restored, and the seeded dataset is reloaded and reconciled against its known totals.

## Assumptions, Dependencies & Limitations

1. All testing uses seeded or synthetic data — no real patient records are used at any point.
2. Facility assignments in the demo dataset are synthetic backfill and do not reflect real DOTS referral patterns.
3. Adherence monitoring and patient accounts were removed in October 2026 (no CHO budget for SMS); they are out of scope.
4. External services (basemap tiles, geocoder, chatbot model) are treated as black boxes; their internal correctness is out of scope.
5. Clinical content requires human clinical review; the team does not certify the system as a medical device.
6. Load testing is limited to demo-scale data (about 1,000 cases); production-scale performance is stated as a known limitation.
