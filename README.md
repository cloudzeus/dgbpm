# BPM Application

Internal Business Process Management web application with role-based access (Super Admin, Admin, Manager, Employee), process templates, and process execution with task approvals.

## Tech Stack

- **Next.js 16** (App Router)
- **Prisma 6** + MySQL
- **Auth.js v5** (Credentials provider, JWT session)
- **Tailwind CSS 4** + **shadcn/ui**
- **React Icons** (Feather icons for nav and process templates)

## Setup

1. **Environment**

   Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL` – MySQL connection string, e.g. `mysql://USER:PASSWORD@HOST:3306/DATABASE`
- `AUTH_SECRET` – random string (e.g. `openssl rand -base64 32`)
- **BunnyCDN** (for task file uploads): `BUNNY_STORAGE_ZONE`, `BUNNY_ACCESS_KEY`, `BUNNY_CDN_HOST` (e.g. `https://your-pullzone.b-cdn.net`). Optional: `BUNNY_STORAGE_REGION` (empty = Falkenstein, or `la`, `sg`, `syd`, etc.)

2. **Database**

   ```bash
   npx prisma db push
   ```

   (Use `db push` only; do not use migrations per project rules.)

3. **Seed (optional)**

   Create a Super Admin user and sample data:

   ```bash
   npx tsx prisma/seed.ts
   ```

   Super Admin credentials are set in `prisma/seed.ts` (run `npm run db:seed` after `db:push`).

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in or register; after login you are redirected to the role-specific dashboard.

## Features

- **Auth**: Login, register, forgot-password (full-page); JWT session with `role`; middleware protects all app routes except auth pages.
- **RBAC**: `requireRole()` and `hasPermission()` in server actions; nav and dashboards filtered by role.
- **Master data** (Super Admin / Admin): Users, Departments, Job Positions – list + modal create/edit/delete.
- **Process templates** (Super Admin): Create/edit templates with basic info, icon, allowed departments, and ordered tasks with approver positions and flags (needFile, mandatory).
- **Process execution**: Start process from template (filtered by user’s departments); instance page with task list; open task modal to Start / Approve / Reject; task history; process auto-completes when all mandatory tasks are approved.
- **My Tasks**: Tasks where the user is a possible assignee (by position).
- **My Processes**: Processes started by the current user.

All create/update/delete operations are server actions; no client-side direct DB access.
