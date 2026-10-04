# Nuqta Workspace

Internal company workspace (projects, documents, customers, invoices, team messaging) with **Mibyan**, an AI assistant and developer platform. React + Vite + TypeScript + Tailwind on the front end, Supabase (Auth, Postgres, Storage) for data, and Netlify Functions for server-side application logic.

> **Training environment.** Every user, organization, document, invoice, conversation, API key and secret in this project is synthetic. The AI gateway is simulated and never contacts an external model provider. Keep this project connected only to its own dedicated Supabase project.

## Architecture

```
Browser (React SPA)
  ├─ Supabase Auth (sign-in, JWT)          → publishable key only
  ├─ Supabase Storage (avatars)            → RLS-protected
  └─ /api/*  ───────────────►  Netlify Function `api` (netlify/functions/api.ts)
                                  ├─ resolves user + active organization from the JWT
                                  ├─ routes: /api/v2/* (current), /api/v1/* (legacy), /api/instructor/*
                                  └─ Supabase (service role, server side only) → Postgres + Storage
```

* `src/` – SPA (pages per sidebar section, shared UI kit in `src/lib/ui.tsx`).
* `netlify/functions/api.ts` – single entry point; `netlify/lib/*` – route modules (workspace, content, platform, legacy, training).
* `supabase/migrations/` – schema + RLS, deterministic seed & reset functions, storage buckets/policies.
* `scripts/` – local API server and storage seeding.

## Routes

| Area | Paths |
|---|---|
| Auth | `/login`, `/forgot-password`, `/invite/:token`, `/share/:token` |
| Workspace | `/`, `/projects`, `/projects/:id`, `/tasks`, `/documents`, `/documents/:id`, `/customers`, `/customers/:id`, `/team`, `/messages`, `/search` |
| Mibyan | `/mibyan/chat[/:id]`, `/mibyan/conversations`, `/mibyan/knowledge[/:id]`, `/mibyan/models` |
| API platform | `/developer`, `/developer/api-keys`, `/developer/usage`, `/developer/logs`, `/developer/models`, `/developer/docs` |
| Finance | `/finance/invoices[/:id]`, `/finance/plans` |
| Organization | `/org/members`, `/org/invitations`, `/org/settings`, `/org/audit` |
| Account | `/account/profile`, `/account/security`, `/account/sessions`, `/account/report` |
| Instructor | `/instructor` (instructor account only) |

## Database

Core tables: `organizations`, `organization_members`, `profiles`, `projects`, `project_members`, `tasks`, `customers`, `documents`, `document_versions`, `files`, `messages`, `invoices`, `invoice_items`, `invitations`, `sessions`, `audit_logs`, `ai_models`, `ai_conversations`, `ai_messages`, `knowledge_bases`, `knowledge_documents`, `api_keys`, `api_usage`, `api_request_logs`, `plans`, plus programme tables (`security_reports`, `report_comments`, `training_scenarios`, `training_progress`, `instructor_notes`, `password_resets`, `rate_limits`).

Row Level Security is enabled on every table. Helper functions (`is_org_member`, `is_org_manager`, `org_role`, `shares_org_with`, `is_platform_admin`) back tenant-scoped policies; programme tables have no client policies and are reachable only with the service role.

Storage buckets: `avatars`, `documents`, `knowledge-files`, `attachments`.

## Setup

1. Create a **dedicated** Supabase project (never reuse a production project).
2. Apply `supabase/migrations/*.sql` in order, then the instructor setup in `supabase/instructor/` (see `docs/INSTRUCTOR_SETUP.md`).
3. Copy `.env.example` to `.env` and fill in the values. `SUPABASE_SERVICE_ROLE_KEY` is server-only.
4. Upload placeholder files for the seeded records: `npm run seed:storage`.
5. Run locally (two terminals):
   ```bash
   npm install
   npm run dev:api   # API on :8888
   npm run dev       # SPA on :5173 (proxies /api)
   ```

## Deploy to Netlify

1. Push the repo and import it in Netlify (build command and publish dir come from `netlify.toml`).
2. Set environment variables (Site settings → Environment variables):

| Variable | Scope | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | build | project URL |
| `VITE_SUPABASE_ANON_KEY` | build | publishable key only |
| `SUPABASE_URL` | functions | project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | functions | **secret – mark as secret, never expose to the client** |
| `CONTEXT_SIGNING_SECRET` | functions (optional) | defaults to a synthetic value |

3. Deploy. Run `npm run seed:storage` once from a machine with the same env (or use *Environment → Reset* in the instructor console, which also re-uploads files).

## Simulated infrastructure

No operating-system, network or cloud-metadata behaviour is exposed. The "AI gateway" returns canned text; reset codes are written to a simulated outbox visible to the instructor; "secrets" shown anywhere are synthetic placeholders. Nothing reads `process.env` into a response.
