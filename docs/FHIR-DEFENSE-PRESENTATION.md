# BANTAY-TB — Interoperability Presentation Script

**12 slides · about 11 minutes of talking · demo included**

## How to use this

Each slide below has two parts:

- **ON THE SLIDE** — the few words you actually type into PowerPoint.
- **WHAT TO SAY** — your script. Do not put this on the slide. Read it a few
  times, then say it in your own words.

Slides 4 to 9 each cover **one requirement** from the task sheet. The slide
titles say so. That way the panel can follow along with the rubric.

## Who presents what (suggested)

| Member | Slides | Topic |
| --- | --- | --- |
| 1 | 1–3 | Problem and overview |
| 2 | 4–6 | Getting the data out and sending it |
| 3 | 7–9 | Data Privacy Act part |
| 4 | 10–12 | Demo and limitations |

Whoever built a part should answer questions about that part.

## Words we use (say these in plain words first)

| Word | Say it like this |
| --- | --- |
| **FHIR** | "The worldwide standard format for health records." Like PDF, but for patient data. |
| **Payload** | "The file we send." |
| **Serialize** | "Convert our database record into that file." |
| **Bundle** | "One envelope holding several records that belong together." |
| **Pseudonymised** | "We removed the patient's name." |
| **Audit log** | "A logbook of who sent what, and when." |
| **Endpoint** | "The address of the other system we are sending to." |

Have these open before you start: `/app/interoperability`, the Supabase SQL
editor, your GitHub repo, and the downloaded JSON file.

---

## Slide 1 — Title (20 seconds)

**ON THE SLIDE**

> **BANTAY-TB × HL7 FHIR**
> Sharing our TB records with other health systems
> *Names · Section · Date*

**WHAT TO SAY**

"Good morning. Our capstone is BANTAY-TB, a TB monitoring system for Davao City.

Today we are showing one feature. We can take a TB record from our database and
send it to another health system, in a format that system already understands.
And we can do it without exposing the patient."

---

## Slide 2 — The problem (1 minute)

**ON THE SLIDE**

A picture: BANTAY-TB in a box. Arrows going to a hospital, to DOH, to another
clinic. All three arrows crossed out with a red X.

> **Only our app can read our own data.**

**WHAT TO SAY**

"Our system knows things no other system knows.

It knows the barangay where the patient actually **lives**, not just where the
clinic is. It knows which DOTS center is treating them, how firmly the TB was
diagnosed, and how the treatment ended.

But only our own screen can read that. So when a patient is referred to a
hospital, or when the city sends a report to DOH, somebody has to type the record
again by hand.

That is the problem. Typing it again is slow, and it causes mistakes. Worse, our
hotspot detection needs to know the patient's **home** barangay and the
**clinic's** barangay separately. When a person retypes the record, they usually
write only one address. So that information is lost.

In short: we built a monitoring system that cannot talk to the health system it
reports to. That is what we fixed."

---

## Slide 3 — What we built (40 seconds)

**ON THE SLIDE**

> **Four requirements, four parts**
> 1. Get a record out of our database and convert it to FHIR
> 2. Send it automatically over HTTPS
> 3. Route: our own backend (not Mirth)
> 4. Data Privacy Act: encryption · access control · audit log

**WHAT TO SAY**

"The task sheet gave four requirements. We will go through them in that exact
order. The fourth one, privacy, has three parts, so it gets three slides.

Here is the whole thing in one picture first."

**Then show this simple diagram:**

```
 System admin picks a patient record
              |
              v
 +-------------------------------------+
 |  Our new backend service            |
 |                                     |
 |  1. Read the record from database   |
 |  2. Convert it to FHIR format       |
 |  3. Send it over HTTPS              |
 |  4. Write it in the logbook         |
 +-------------------------------------+
         |                  |
         v                  v
  Other health         Our audit log
  system replies       (cannot be edited)
  with the IDs it
  saved
```

---

## Slide 4 — Requirement 1: Getting the record out (1 minute)

**ON THE SLIDE**

> **Requirement 1 — Extract**
> Built fresh from the database every time
>
> `cases` · `barangays` · `dots_centers`

**WHAT TO SAY**

"Requirement one says extract an existing record and convert it **dynamically**.

Dynamically is the important word. We did not save one FHIR file and keep showing
the same file. Every time the user clicks the button, our code reads three live
tables: the case, the barangay, and the DOTS center. Then it builds the file from
scratch.

So if you change the patient's treatment outcome right now, the next export
already shows the new value. We can demo that later if you want.

One more thing we want to point out. Only the **system administrator** can use
this feature. And even then, our code reads the database **as that logged-in
user**, using the same security rules that protect our normal screens. It never
uses the master database key to read a patient. We only use that key for two
things: checking the destination address, and writing the logbook."

---

## Slide 5 — Requirement 1: Converting it to FHIR (1 minute 40)

**ON THE SLIDE**

> **Requirement 1 — Serialize**
> 1 database record → **7 FHIR records**
>
> Patient · Condition · Encounter · Organization · Location
> 2 Observations

Put one real screenshot of your JSON here.

**WHAT TO SAY**

"Now the format. FHIR is the international standard for sharing health data. The
easiest way to explain it: FHIR is to health records what PDF is to documents.
Any system that supports it can read our file. We do not need to build a
different converter for every hospital.

Our one database record becomes **seven FHIR records**: the patient, the
diagnosis, the clinic visit, the DOTS center as an organization and as a map
location, and two measurements — how the TB was confirmed, and the treatment
outcome.

We send all seven inside one envelope, which FHIR calls a transaction bundle. It
means: save all seven together, or save none of them.

Why that matters: the other system replies and tells us the ID it gave to **each**
record. That reply is our proof. It did not just accept a file. It actually read
and understood every record inside."

**Then show this table and continue:**

| Our record says | Code we send | What the code means |
| --- | --- | --- |
| Confirmed by lab, in the lungs | `A15.0` | TB of lung, lab-confirmed |
| Diagnosed by doctor, in the lungs | `A16.9` | TB of lungs, no lab result |
| **Presumptive** | **`Z03.0`** | **Suspected TB only** |

"These are ICD-10 codes, the same disease codes used in medical records
worldwide.

Please look at the last row, because this is the part we thought about the most.

In active case finding, a presumptive case is a person with symptoms. They are
**not** diagnosed yet. Many of them turn out not to have TB at all.

If we sent code `A15` for them, we would be reporting a diagnosis that no doctor
ever made. And every system that reads our data would count them as TB patients.
So we send `Z03.0`, which means *suspected TB only*. That is the honest code.

We also attach a second code, from SNOMED, next to every ICD-10 code. Some
systems use one, some use the other. This way both can read us."

**Then say your proof:**

"We tested our file using the official HAPI FHIR validator, which is the standard
tool for checking if a FHIR file is correct. The result was **zero errors**.

It gave us some warnings, but those are for our own internal code lists, which a
public server would not have. The standard SNOMED codes passed with no
warning at all. That confirms they are real codes, not something we invented."

---

## Slide 6 — Requirements 2 and 3: Sending it (1 minute 20)

**ON THE SLIDE**

> **Requirement 2 — Transmit over HTTPS**
> The database will not even store a non-HTTPS address
>
> **Requirement 3 — Route**
> We chose our own backend (Supabase Edge Function), not Mirth Connect

**WHAT TO SAY**

"Requirement two says transmit automatically over secure HTTPS.

This is the part we are happiest with. The user **cannot type a web address**.
They choose a destination from an approved list.

And in that list, the address column has a rule attached to it: the address must
start with `https`. A plain `http` address **cannot be saved into our database at
all**. So it can never be sent.

That is the point. 'We send securely' is not just a line in our code that
somebody could delete later. It is a rule inside the database itself. On top of
that, we check it two more times before sending.

The file is sent as `application/fhir+json`, which is the official FHIR content
type, with a 20-second timeout, to the HAPI public FHIR server.

Requirement three was a choice. Build it inside our own backend, or use Mirth
Connect. **We chose our own backend**, using Supabase Edge Functions, which our
project already uses. Slide 10 explains why."

---

## Slide 7 — Requirement 4a: Encryption at rest (1 minute 10)

**ON THE SLIDE**

> **Requirement 4a — Encryption at rest**
>
> Layer 1 — Supabase encrypts the whole disk (AES-256)
> Layer 2 — **we** encrypt 2 specific columns (AES-256)
> → the saved FHIR file
> → the password for the other system

**WHAT TO SAY**

"Requirement four is Data Privacy Act compliance. It has three parts. First one:
encryption at rest. That means the data is encrypted while it is just sitting in
the database.

Supabase already encrypts the whole disk and the backups with AES-256. But we
want to be honest about what that protects. It protects against a **stolen hard
drive or a stolen backup file**. It does not protect against someone who logs in
with a valid password, because for them the data comes out readable anyway.

So we added a second layer ourselves. We encrypt two specific columns one by one,
also with AES-256: the copy of the FHIR file we keep, and the password we use to
log in to the other system. Those two are where a leak would really hurt.

The encryption key is kept in a part of the database that our web API cannot
reach. It is not published as a web address, and no web user has permission to
open it. Only one special function can read it.

And we generated the key **inside** the database. So the key never travelled
through the internet, and it is not written inside any config file."

**Then say the weakness yourself:**

"We should mention one limitation. The key and the encrypted data are in the same
database. So this stops a leaked API key or a stolen backup. It does not stop
someone who has full owner access to the database.

Moving the key to a separate key vault would only change two functions, because
only two functions ever touch the key. We just did not have a key vault
available."

> Tip: say this before the panel asks. It shows you understand your own system.

---

## Slide 8 — Requirement 4b: Access control (1 minute)

**ON THE SLIDE**

> **Requirement 4b — Secure access control**
>
> 1. Is the login real?
> 2. Which cases can **this** user see?
> 3. Can this user send data outside?
> 4. Can this user include the name?
> 5. Can anyone read the password column? (No.)

**WHAT TO SAY**

"Second part of privacy: access control, and keeping our credentials safe.

We have five separate checks. We made them separate on purpose, because if there
is only one check and it fails, everything is open.

**One.** The platform checks the login before our code even runs.

**Two.** Our database row-level rules decide which cases that user can read.

**Three.** Only the **system administrator** can preview or send a FHIR file.
TB coordinators, barangay admins and health workers do not even see the menu
item. And if one of them tries to call our backend directly, it refuses them and
writes the attempt in the logbook.

**Four.** Including the patient's real name needs permission again, separately.

**Five.** This is the one we like most. The column that stores the other system's
password is not given to **any** web user at all. Even if our strongest API key
leaked, that key still cannot read that column.

On the screen, the admin only sees the last four characters of the
password. Enough to check the correct one is loaded. Useless to anybody else."

---

## Slide 9 — Requirement 4c: The audit log (1 minute 30)

**ON THE SLIDE**

> **Requirement 4c — Active immutable audit log**
>
> Like a logbook written in ink:
> **you can add a page, you cannot erase one**
>
> Records: previews · sends · failures · refusals · password changes
> **Only the system admin can view it**

**WHAT TO SAY**

"Third part of privacy. The task sheet asks for an **active immutable** audit
log, so let us explain both words.

**Active** means it does not only record the successful sends. It also records
when someone just **previewed** a file, when someone was **refused** access, when
someone **decrypted** a saved file to read it again, and when someone **changed
the password** to the other system. For each one we store who did it, when, which
account, and a digital fingerprint of exactly what was sent.

**Immutable** means it cannot be changed. We enforce that four different ways.

**One.** Nobody has permission to edit or delete rows. Not our app, not even our
strongest API key. Rows can only be added through one special function.

**Two.** Even if somebody had permission, the database refuses. If you try to
update, delete, or clear that table, it throws an error. That includes the owner
of the table.

**Three.** Every row is sealed to the row before it. Each row stores a SHA-256
fingerprint made from its own contents **plus** the previous row's fingerprint.
It is like a chain. If you break one link, the rest do not line up anymore.

**Four.** We can prove it. We added a button that recalculates the whole chain.
If someone edited a row behind our back, its fingerprint no longer matches its
contents. If someone deleted a row, the next row's link points to nothing. Either
way, we can tell you exactly which entry was touched.

And one more rule: **only the system administrator can see this log.**

You might ask: the admin sends the data **and** reads the log — can't the admin
hide what they did? No. Everything the admin does is written in the logbook too,
and the admin cannot edit or delete it either. So even the most powerful user in
our system leaves a permanent record."

**Then be honest:**

"We are not claiming that nobody in the world can ever change this. We are
claiming something smaller but true: **no part of our application can change it,
and if anyone changes it from outside, we will know.** The correct term is
tamper-**evident**."

---

## Slide 10 — Why we chose our own backend (40 seconds)

**ON THE SLIDE**

> **Why not Mirth Connect?**
> Adding Mirth later = **1 new row** in our destination table
> No code change. No database change.

**WHAT TO SAY**

"We designed the destination list so the delivery method does not matter. A Mirth
Connect channel would just be another row in that table. One row, one password.
No code change, no database change.

So why not use Mirth now? Two reasons.

First, the task is one outbound send. Mirth is an extra program in the middle,
and we do not need it yet.

Second, and more important: our audit log would stop at Mirth. We would record
that we sent the file to Mirth, but not what the real destination replied. Right
now our logbook records the actual final reply.

Mirth becomes useful when we need to send one record to many systems at once, or
translate to the older HL7 version 2 format for an old hospital system, or hold
messages and retry when a server is down. When we need that, it is one row."

---

## Slide 11 — Live demo (2 minutes)

**Practice this. HAPI is a free public server and sometimes it is slow. Take
screenshots beforehand as backup.**

Do it in this order:

**1. Click Preview payload.**
"This is the FHIR file, built right now from our database. Seven records. And this
long code here is its fingerprint."

**2. Click Transmit.**
"HTTP 200, so it was accepted. And these are the IDs the other server gave to
each of our seven records. That proves it read them properly."

**3. Open Admin → Audit Log.**
"Only the system admin has this page. Here is the transmission we just did —
with our own account name on it."

Click **Verify audit chain**: "Every entry verified. The chain is complete."

Click **View payload** on that entry, then close it: "Notice a new entry
appeared — *Payload read*. Even the admin looking at the record gets written in
the logbook."

**4. Open the Supabase SQL editor and try to change the log:**

```sql
update public.interop_audit_log set http_status = 200 where seq = 1;
```

Result:

```
ERROR: public.interop_audit_log is append-only: UPDATE is not permitted
```

"That error is coming from the database, not from our app. Even here, with direct
database access, we cannot edit the logbook."

**5. Show the downloaded JSON file**, because that is one of our submitted
requirements.

---

## Slide 12 — Limitations (40 seconds)

**ON THE SLIDE**

> **What we did not do yet**
> - Sending only — we cannot receive FHIR yet
> - No automatic retry if the other server is down
> - Encryption key is in the same database as the data
> - Our own code lists are not published online yet

**WHAT TO SAY**

"We would rather tell you these ourselves.

The biggest one is receiving. To accept a FHIR record from another system, we
first have to answer: is this patient already in our database or not? And what do
we do when two systems disagree about the same patient? That is a bigger problem
than sending. If we did it badly, we would corrupt the register that every other
part of BANTAY-TB reads. So we stopped at sending, on purpose.

Thank you. We are ready for your questions."

---

# Defense questions

**How to answer:** short answer first, two or three sentences, then **stop**. If
they want more, they will ask. Only open the code if they ask you to.

If you do not know, say "we did not implement that part." That is better than
guessing.

---

### "Is this really FHIR, or just JSON that looks like FHIR?"

It is real FHIR R4, and we can prove it. We checked our file with the official
HAPI FHIR validator and got **zero errors**. Also, the receiving server replied
with the ID it gave to each of our seven records. It could only do that if it
really read them as FHIR.

*If they ask about the warnings:* those warnings say "unknown code system." They
are for our own internal code lists, which a public server would not have. The
standard SNOMED codes had no warnings.

---

### "Where does the conversion happen? Is it really dynamic?"

In the file `_shared/fhir.ts`, which our `fhir-export` function calls. It is
fully dynamic. Every request reads three live tables and builds the file in
memory. Nothing is pre-saved. Even the sample file we submitted is produced by
that same code.

---

### "Show me the actual sending code."

*(Open `fhir-export/index.ts`, scroll to the `fetch`.)* This is the POST request.
Content type `application/fhir+json`, 20-second timeout, and the password is
attached as a header that the database prepared for us.

---

### "How do I know it is HTTPS? What if someone points it to plain HTTP?"

The address column in our database has a rule: it must start with `https`. A
plain HTTP address cannot even be **saved**, so it cannot be sent. We also check
it two more times before sending. And the user cannot type an address at all,
they pick from a list.

---

### "Is your database encrypted at rest?"

Yes, in two layers. Supabase encrypts the whole disk and the backups with
AES-256. On top of that we encrypt two specific columns ourselves, also AES-256:
the saved FHIR file, and the password for the other system.

---

### "Where do you keep the encryption key?"

In a part of the database that our web API cannot reach. It is not published as a
web address and no web user has permission to open it. Only one special function
can read it, and we generated it inside the database so it never went through the
internet.

*Then add:* "To be honest, the key and the data are in the same database. That
stops a leaked API key or a stolen backup, but not a full database owner. Moving
it to a key vault would change only two functions."

---

### "What stops a health worker from exporting a patient?"

They can't use the feature at all — only the system admin can. If a health
worker calls our backend directly, it refuses them before reading anything, and
the attempt is recorded in the logbook as `access_denied`.

---

### "What exactly makes the audit log immutable?"

Four things. Nobody has permission to edit or delete. The database throws an
error on any update, delete, or clear, even for the table owner. Every row is
SHA-256 sealed to the row before it. And one button recalculates the whole chain
and shows which row was changed.

---

### "Why can only the system admin share records?"

Because sending patient data outside our system is the most sensitive thing
BANTAY-TB can do. Keeping it to one role means one person is accountable, and
there is only one account whose sends need watching.

*If they ask "is it just a hidden menu?":* No. The menu is hidden, but our
backend also refuses every other role and logs the attempt, and the database
returns zero rows if anyone else queries the log or the destination list.

---

### "The admin sends AND reads the log. Can't they hide what they did?"

No. Every send, preview and payload read by the admin is written into the
logbook with their account name, and the admin cannot edit or delete the logbook
either — the database refuses, even for its owner. If someone goes around the
app entirely and edits the table, the fingerprint chain breaks and the verify
button shows exactly which entry.

---

### "But a database superuser could still delete the whole table."

Yes, and we wrote that in our documentation instead of hiding it. Our claim is
smaller but true: no part of our application can change a row, and if anyone
changes it from outside, the chain breaks and we can see it. Tamper-evident, not
tamper-proof. Tamper-proof would need storage outside this database completely.

---

### "Does the audit log contain patient data?"

Only the encrypted copy. In plain text it keeps who did it, when, the event type,
the **TB case code** — never a name — the destination, the size, the fingerprint
and the HTTP result. Only the system administrator can view the log at all. To
read the encrypted copy, the admin must use a special function, and that read is
also written into the logbook.

We also never save the other server's raw reply, only a summary. Otherwise a
talkative server could send patient data back into our own log.

---

### "Why keep a copy of the file at all? Is that not a risk?"

Because the Data Privacy Act gives the patient the right to ask "what exactly did
you share about me, and when?" We need to answer that months later. So instead of
deleting the copy, we protected it: it is encrypted, no web user can read that
column, previews keep no copy at all, and every time someone decrypts it, that is
logged too.

---

### "If you remove the name, is the data still useful?"

Yes. The other system receives our TB case code as the patient's ID, so it can
recognise the same patient next visit without ever having the name. Everything
medically useful is still there: the diagnosis, whether it was lab-confirmed, the
treatment outcome, and the treating DOTS center. The name is only
needed for a real referral the patient agreed to, and that is a separate
permission.

---

### "Why send the birth year only, and not the full birth date?"

Because our database only ever recorded the patient's **age in years**. To write
a full birth date we would have to invent the month and day. That would be fake
data, and it would also reveal more than we actually have. FHIR allows just the
year, so we send only what we know.

---

### "What if the other server is down or rejects the file?"

We record it as `transmit_failure`, with the HTTP status or the network error, the
time it took, and the encrypted file, so it can be retried later. Even a timeout
creates a log entry. What we do not have yet is automatic retry — that is in our
limitations.

---

### "What if the send succeeds but writing the log fails?"

Then our system reports failure, not success. The screen shows a red warning
telling the user to treat it as unrecorded and report it. We cannot un-send the
file at that point, so the least we can do is refuse to call it compliant.

---

### "Why an Edge Function instead of Mirth Connect?"

Our destination table does not care about the delivery method, so adding Mirth
later is one row and one password. For a single send, Mirth would add a step we
cannot audit, because our log would stop at Mirth instead of the real reply.
Mirth is worth it when we need to send to many systems, or translate to HL7
version 2, or retry automatically.

---

### "Can it receive FHIR, not only send?"

No, and that was a decision, not something we forgot. Receiving needs
patient-matching logic — is this incoming patient already one of ours? — and a
rule for when two systems disagree. Doing that badly would damage the register
that every other feature of BANTAY-TB reads.

---

### "How did you test this?"

We wrote 31 automated tests for the converter. They run together with the rest
of the project's tests — 176 in all. They check the bundle structure, that every
internal link points to something real, and every ICD-10 mapping including the
presumptive case. Most importantly, they check that a no-name file
really has no name, no phone, no street address, and uses the barangay centre
point instead of the actual house. Plus the external check with the HAPI
validator.

---

### "How much of your old system did you have to change?"

Almost nothing, and that was the goal. One database migration, one new backend
function, one new page, and one new menu item. No existing table, security rule,
or page changed how it works.
