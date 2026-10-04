-- Nuqta Workspace (synthetic training environment) - core schema
create extension if not exists pgcrypto with schema extensions;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text,
  country text,
  plan text not null default 'team',
  credit_balance numeric(12,2) not null default 0,
  billing_email text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  title text,
  phone text,
  avatar_path text,
  platform_role text check (platform_role in ('platform_admin')),
  is_instructor boolean not null default false,
  is_trainee boolean not null default false,
  default_org_id uuid references public.organizations(id) on delete set null,
  last_ip text,
  security_notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('employee','manager','organization_admin')),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  industry text,
  status text not null default 'active',
  annual_value numeric(12,2) default 0,
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  description text,
  status text not null default 'Draft' check (status in ('Draft','Active','Review','Approved','Archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  start_date date,
  due_date date,
  budget numeric(12,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'contributor',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  bucket text not null,
  path text not null,
  name text not null,
  mime_type text,
  size_bytes bigint default 0,
  visibility text not null default 'org' check (visibility in ('org','private')),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  summary text,
  body text,
  status text not null default 'Draft' check (status in ('Draft','Shared','Reviewed','Archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  file_id uuid references public.files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version int not null,
  body text,
  note text,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null default 'general',
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'Draft' check (status in ('Draft','Sent','Approved','Paid')),
  currency text not null default 'OMR',
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  credit_applied numeric(12,2) not null default 0,
  due_date date,
  issued_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'employee',
  token text not null,
  status text not null default 'Created' check (status in ('Created','Sent','Accepted','Member Created')),
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device text,
  ip text,
  user_agent text,
  location text,
  revoked boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create table public.ai_models (
  id text primary key,
  name text not null,
  description text,
  tier text not null default 'standard',
  context_window int not null default 32000,
  price_per_1k numeric(8,4) not null default 0,
  status text not null default 'available'
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null default 'New conversation',
  model text references public.ai_models(id),
  visibility text not null default 'private' check (visibility in ('private','org','shared')),
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  tokens int default 0,
  attachment_file_id uuid references public.files(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  visibility text not null default 'org' check (visibility in ('org','restricted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  kb_id uuid not null references public.knowledge_bases(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  title text not null,
  summary text,
  status text not null default 'Uploaded' check (status in ('Uploaded','Processing','Available')),
  token_count int default 0,
  uploader_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  prefix text not null,
  key_hash text not null,
  status text not null default 'Active' check (status in ('Created','Active','Revoked')),
  scopes text[] not null default '{chat}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete cascade,
  day date not null,
  model text,
  requests int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost numeric(10,4) not null default 0
);

create table public.api_request_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete cascade,
  method text not null,
  path text not null,
  status_code int not null,
  latency_ms int,
  model text,
  ip text,
  created_at timestamptz not null default now()
);

create table public.plans (
  id text primary key,
  name text not null,
  price_monthly numeric(10,2) not null,
  seats int not null,
  ai_tokens bigint not null,
  description text
);

-- Training / instructor tables (no FK to resettable data so they survive resets)
create table public.security_reports (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null,
  title text not null,
  component text,
  severity text not null default 'Medium',
  description text,
  steps text,
  evidence text,
  impact text,
  remediation text,
  status text not null default 'Submitted' check (status in ('Submitted','Under Review','Valid','Duplicate','Informational','Needs More Evidence','Resolved','Retested')),
  score int,
  scenario_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.security_reports(id) on delete cascade,
  author_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.training_scenarios (
  id text primary key,
  title text not null,
  category text not null,
  feature text not null,
  prerequisites text,
  difficulty text not null,
  severity text not null,
  expected_secure text,
  flawed_behavior text,
  investigation_path text,
  expected_evidence text,
  business_impact text,
  remediation text,
  chain text,
  created_at timestamptz not null default now()
);

create table public.vulnerability_catalog (
  id text primary key, category text not null, endpoint text not null,
  affected_resource text, required_role text,
  secure_behavior text not null, actual_behavior text not null,
  root_cause text not null, expected_evidence text not null,
  business_impact text not null, remediation text not null,
  chain_membership text[] not null default '{}',
  reset_dependencies text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.scenario_events (
  id uuid primary key default gen_random_uuid(), trainee_id uuid,
  scenario_id text not null, action text not null, resource_id text,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create table public.training_progress (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null,
  scenario_id text not null references public.training_scenarios(id) on delete cascade,
  discovered boolean not null default true,
  discovered_at timestamptz not null default now(),
  hits int not null default 1,
  unique (trainee_id, scenario_id)
);

create table public.instructor_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  trainee_id uuid,
  scenario_id text,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.password_resets (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  attempts int not null default 0,
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

create index on public.organization_members (user_id);
create index on public.projects (org_id);
create index on public.tasks (org_id, project_id);
create index on public.documents (org_id);
create index on public.invoices (org_id);
create index on public.messages (org_id, channel, created_at);
create index on public.audit_logs (org_id, created_at desc);
create index on public.ai_messages (conversation_id, created_at);
create index on public.api_usage (org_id, day);
create index on public.api_request_logs (org_id, created_at desc);

do $$ declare t text; begin
  for t in select table_name from information_schema.columns
    where table_schema='public' and column_name='updated_at'
  loop
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ===== Row Level Security =====
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and platform_role = 'platform_admin')
$$;

create or replace function public.org_role(o uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from organization_members where org_id = o and user_id = auth.uid() and status = 'active'
$$;

create or replace function public.is_org_member(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.org_role(o) is not null or public.is_platform_admin()
$$;

create or replace function public.is_org_manager(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.org_role(o) in ('manager','organization_admin') or public.is_platform_admin()
$$;

create or replace function public.shares_org_with(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from organization_members a join organization_members b on a.org_id = b.org_id
                where a.user_id = auth.uid() and b.user_id = u)
$$;

do $$ declare t text; begin
  for t in select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- standard tenant tables: members read, managers write
do $$ declare t text; begin
  foreach t in array array['customers','projects','invoices','knowledge_bases','knowledge_documents','api_usage']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(org_id))', t||'_sel', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_org_manager(org_id)) with check (public.is_org_manager(org_id))', t||'_wr', t);
  end loop;
  -- member-writable collaboration tables
  foreach t in array array['tasks','documents','files']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(org_id))', t||'_sel', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t||'_wr', t);
  end loop;
end $$;

-- One controlled RLS training defect: comments are readable by any signed-in user.
create policy project_comments_training_read on public.project_comments
  for select to authenticated using (true);
create policy project_comments_insert on public.project_comments
  for insert to authenticated with check (public.is_org_member(org_id));
create policy project_comments_update on public.project_comments
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy project_comments_delete on public.project_comments
  for delete to authenticated using (public.is_org_manager(org_id));

create policy organizations_sel on public.organizations for select to authenticated using (public.is_org_member(id));
create policy organizations_upd on public.organizations for update to authenticated
  using (public.org_role(id) = 'organization_admin' or public.is_platform_admin());

create policy profiles_sel on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id) or public.is_platform_admin());
create policy profiles_upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and platform_role is not distinct from (select p.platform_role from public.profiles p where p.id = auth.uid()) and is_instructor = false);

create policy members_sel on public.organization_members for select to authenticated using (public.is_org_member(org_id));
create policy members_wr on public.organization_members for all to authenticated
  using (public.org_role(org_id) = 'organization_admin' or public.is_platform_admin())
  with check (public.org_role(org_id) = 'organization_admin' or public.is_platform_admin());

create policy project_members_all on public.project_members for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_manager(p.org_id)));

create policy doc_versions_sel on public.document_versions for select to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id));
create policy doc_versions_ins on public.document_versions for insert to authenticated
  with check (exists (select 1 from public.documents d where d.id = document_id));

create policy invoice_items_sel on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy invoice_items_wr on public.invoice_items for all to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_org_manager(i.org_id)))
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_org_manager(i.org_id)));

create policy messages_sel on public.messages for select to authenticated using (public.is_org_member(org_id));
create policy messages_ins on public.messages for insert to authenticated with check (public.is_org_member(org_id) and sender_id = auth.uid());

create policy invitations_sel on public.invitations for select to authenticated using (public.is_org_manager(org_id));
create policy invitations_wr on public.invitations for all to authenticated
  using (public.org_role(org_id) = 'organization_admin') with check (public.org_role(org_id) = 'organization_admin');

create policy sessions_own on public.sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_sel on public.audit_logs for select to authenticated using (public.is_org_manager(org_id));

create policy conv_sel on public.ai_conversations for select to authenticated
  using (owner_id = auth.uid() or (public.is_org_member(org_id) and visibility in ('org','shared')));
create policy conv_wr on public.ai_conversations for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_org_member(org_id));
create policy ai_msg_sel on public.ai_messages for select to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id));
create policy ai_msg_ins on public.ai_messages for insert to authenticated
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.owner_id = auth.uid()));

create policy api_keys_sel on public.api_keys for select to authenticated
  using (owner_id = auth.uid() or public.org_role(org_id) = 'organization_admin');
create policy api_keys_wr on public.api_keys for all to authenticated
  using (owner_id = auth.uid() or public.org_role(org_id) = 'organization_admin')
  with check (public.is_org_member(org_id));
create policy api_logs_sel on public.api_request_logs for select to authenticated using (public.is_org_manager(org_id));

create policy models_sel on public.ai_models for select to authenticated using (true);
create policy plans_sel on public.plans for select to authenticated using (true);

create policy reports_sel on public.security_reports for select to authenticated using (trainee_id = auth.uid());
create policy reports_ins on public.security_reports for insert to authenticated with check (trainee_id = auth.uid() and status = 'Submitted' and score is null);
create policy report_comments_sel on public.report_comments for select to authenticated
  using (exists (select 1 from public.security_reports r where r.id = report_id and r.trainee_id = auth.uid()));
-- training_scenarios, training_progress, instructor_notes, password_resets, rate_limits:
-- RLS enabled with no policies => unreachable for anon/authenticated; service role only.

revoke all on all tables in schema public from anon;
revoke all on public.training_scenarios, public.training_progress, public.instructor_notes,
  public.password_resets, public.rate_limits from authenticated;
