# 🩺 BANTAY-TB

**Barangay-level tuberculosis surveillance and hotspot mapping for Davao City.**

BANTAY-TB helps health workers and TB coordinators record cases, see where TB is concentrated across the city's 182 barangays, and find the nearest DOTS center, all from one web app.

---

## ✨ Features

- 🗺️ **GIS hotspot map**: barangay-level case map with Getis-Ord Gi\* hotspot detection
- 📋 **Case management**: add, edit, and bulk-import TB cases from Excel
- 📊 **Analytics dashboard**: trends and breakdowns by barangay and facility
- 🏥 **DOTS center locator**: public page to find the nearest treatment facility
- 🤖 **Health chatbot**: answers TB questions from a reviewed knowledge base
- 📚 **Learn page**: plain-language health guides for residents
- 👥 **Staff-only accounts**: invite-code registration with roles for system admin, TB coordinator, barangay admin, and health worker

## 🧰 Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Maps | Leaflet, MapLibre GL |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions) |
| Hosting | Firebase Hosting |
| Testing | Vitest |

---

## 🚀 Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- A [Supabase](https://supabase.com/) project (cloud or local through the Supabase CLI)

### 2. Clone and install

```bash
git clone https://github.com/NotJayDee119/bantay-tb.git
cd bantay-tb
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root:

```env
# Used by the web app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Used only by the scripts in /scripts (keep these secret)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

> ⚠️ Never commit `.env` or expose the service role key in the frontend.

### 4. Set up the database

Apply the migrations in `supabase/migrations/` to your project:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Then load the barangays, health articles, and sample data:

```bash
npm run seed        # barangays, health articles, and sample cases
npm run kb:ingest   # builds the chatbot knowledge base (needs OPENAI_API_KEY)
```

### 5. Run the app

```bash
npm run dev
```

Open **http://localhost:5173** in your browser. 🎉

---

## 👤 Staff Accounts

> 🔒 **Sign-in is for health staff only.** Residents use the public pages (Home, DOTS Locator, Health Education, chatbot) without an account.

Staff can only register with an **invite code**, so the first admin has to be created by hand:

1. In **Supabase Dashboard → Authentication → Users**, click **Add user** and create the admin's email and password.
2. In the Supabase SQL editor, make that account a system admin:

   ```sql
   update public.profiles set role = 'system_admin' where email = 'admin@example.com';
   ```

3. Sign in at `/login`. Go to **Invite Codes** to create codes for other staff (TB coordinators, barangay admins, health workers).
4. Staff open **Register with an invite code** on the sign-in page (`/register/staff`) and enter their code. The code sets their role. Each code works once and expires after 24 hours.

---

## ☁️ Edge Functions

The chatbot and hotspot detection run as Supabase Edge Functions in `supabase/functions/`.

Deploy them with:

```bash
SUPABASE_URL=... SUPABASE_ACCESS_TOKEN=... node scripts/deploy-functions.mjs
```

Set these secrets in **Supabase Dashboard → Project Settings → Edge Functions**:

| Secret | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Chatbot replies and embeddings |
| `OPENAI_BASE_URL` | *(optional)* Custom OpenAI-compatible endpoint |
| `OPENAI_MODEL` | *(optional)* Chat model override |

---

## 📦 Build and Deploy

```bash
npm run build                  # production build in /dist
npx firebase deploy --only hosting
```

---

## 🛠️ Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler without emitting |
| `npm test` | Run the test suite |
| `npm run seed` | Seed the database with barangays and sample data |
| `npm run kb:ingest` | Rebuild the chatbot knowledge base |

---

## 📄 License

Developed as a capstone project at the University of the Immaculate Conception, Davao City.
