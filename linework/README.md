# LINEWORK
### CIE Ltd. Projects Department — Task Management System
*© 2026 Kahlil Ambrose. All rights reserved.*

---

## Setup Instructions

### Step 1 — Run the database schema in Supabase

1. Go to [supabase.com](https://supabase.com) → your **Linework** project
2. Click **SQL Editor** in the left sidebar → **New Query**
3. Paste the entire contents of `supabase-schema.sql`
4. Click **Run**

This creates all tables and seeds your 17 projects, 4 statuses, and 5 priorities.

---

### Step 2 — Deploy to Vercel

**Option A — GitHub (recommended)**
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. Add environment variables (see below)
4. Click **Deploy**

**Option B — Vercel CLI**
```bash
npm install -g vercel
cd linework
vercel --prod
```

---

### Step 3 — Set environment variables in Vercel

In Vercel → Project → **Settings** → **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ugtpdlgxqclhrxgxespl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (service role key) |
| `SUPABASE_DB_URL` | `postgresql://postgres:!!D42nr3mc!!@db.ugtpdlgxqclhrxgxespl.supabase.co:5432/postgres` |
| `JWT_SECRET` | Any long random string e.g. `linework-cie-2026-xK9mP2qR` |

---

### Step 4 — First login

1. Open your Vercel URL
2. The setup wizard appears — create the **Administrator** account (Kahlil Ambrose)
3. Log in, click **🔐** in the header to open Admin panel
4. Add team members with name, initials, colour, and PIN
5. Share the URL with the team — everyone logs in with their own PIN

---

## Local Development

```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Tech Stack

- **Next.js 14** — React framework with App Router
- **Supabase** — PostgreSQL database + real-time
- **Vercel** — Hosting and deployment
- **bcryptjs** — PIN hashing
- **jose** — JWT session tokens
- **Tailwind CSS** — Styling
- **TypeScript** — Type safety
