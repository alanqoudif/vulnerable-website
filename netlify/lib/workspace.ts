import { route, db, must, need, pick, isManager, isAdmin, isUuid, orgOnly, hit, audit, HttpError, signContext, tid } from './core'

// ---------- bootstrap ----------
route('GET', '/v2/me', async c => {
  const { data: mem } = await db().from('organization_members')
    .select('org_id, role, organizations(id,name,slug,plan)').eq('user_id', c.userId).eq('status', 'active')
  let orgs = (mem ?? []).map((m: any) => ({ id: m.org_id, name: m.organizations.name, slug: m.organizations.slug, role: m.role, plan: m.organizations.plan }))
  if (c.platformAdmin) {
    const { data } = await db().from('organizations').select('id,name,slug,plan').order('name')
    orgs = (data ?? []).map((o: any) => ({ ...o, role: orgs.find(x => x.id === o.id)?.role ?? 'organization_admin' }))
  }
  const { security_notes, last_ip, ...safe } = c.profile
  return { user: safe, orgs, activeOrgId: c.orgId, role: c.role, isInstructor: !!c.profile.is_instructor, isPlatformAdmin: c.platformAdmin }
})

route('GET', '/v2/meta/config', async () => ({
  app: 'Nuqta Workspace', build: '2026.10.3-r4', region: 'me-central',
  features: { mibyan: true, developerPlatform: true, sharedConversations: true, knowledge: true },
  sandboxTenantId: tid('org:4'),
  legacyExportPath: '/api/v1/export/members',
  signingHint: 'TRAINING_SECRET_demo_12345',
  support: 'support@nuqta-demo.test',
}))

route('GET', '/v2/auth/context', async c => ({
  token: signContext({ sub: c.userId, org: c.orgId, role: c.role, iat: Math.floor(Date.now() / 1000) }),
}))

// ---------- dashboard ----------
route('GET', '/v2/dashboard', async c => {
  const org = orgOnly(c)
  const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)
  const [proj, tasks, docs, audits, usage, convs, invs, mine] = await Promise.all([
    db().from('projects').select('id,name,status,due_date,owner:profiles!projects_owner_id_fkey(full_name)').eq('org_id', org).order('created_at', { ascending: false }),
    db().from('tasks').select('id,status').eq('org_id', org),
    db().from('documents').select('id,title,status,updated_at').eq('org_id', org).neq('status', 'Draft').order('updated_at', { ascending: false }).limit(5),
    db().from('audit_logs').select('id,action,entity_type,created_at,actor:profiles!audit_logs_actor_id_fkey(full_name)').eq('org_id', org).order('created_at', { ascending: false }).limit(8),
    db().from('api_usage').select('day,requests,input_tokens,output_tokens,cost').eq('org_id', org).gte('day', since),
    db().from('ai_conversations').select('id,title,model,updated_at').eq('org_id', org).or(`owner_id.eq.${c.userId},visibility.in.(org,shared)`).order('updated_at', { ascending: false }).limit(5),
    db().from('invoices').select('id,number,status,total,currency,due_date').eq('org_id', org).order('created_at', { ascending: false }),
    db().from('tasks').select('id,title,status,priority,due_date,project:projects(name)').eq('org_id', org).eq('assignee_id', c.userId).neq('status', 'done').order('due_date').limit(6),
  ])
  const p = must(proj) as any[], t = must(tasks) as any[], u = must(usage) as any[], iv = must(invs) as any[]
  const byDay: Record<string, number> = {}
  u.forEach(r => { byDay[r.day] = (byDay[r.day] ?? 0) + r.requests })
  return {
    stats: {
      activeProjects: p.filter(x => x.status === 'Active').length,
      openTasks: t.filter(x => x.status !== 'done').length,
      apiRequests14d: u.reduce((s, r) => s + r.requests, 0),
      mibyanTokens14d: u.reduce((s, r) => s + Number(r.input_tokens) + Number(r.output_tokens), 0),
      outstanding: iv.filter(x => x.status !== 'Paid').reduce((s, r) => s + Number(r.total), 0),
    },
    projects: p.slice(0, 5), recentDocuments: must(docs), activity: must(audits),
    usageSeries: Object.entries(byDay).sort().map(([day, requests]) => ({ day, requests })),
    conversations: must(convs), invoices: iv.slice(0, 5), myTasks: must(mine),
  }
})

// ---------- projects ----------
const PROJECT_FLOW = ['Draft', 'Active', 'Review', 'Approved', 'Archived']

async function loadProject(c: any, id: string) {
  need(isUuid(id), 404, 'Project not found')
  const { data } = await db().from('projects').select('*, owner:profiles!projects_owner_id_fkey(id,full_name,email), customer:customers(id,name)').eq('id', id).eq('org_id', orgOnly(c)).maybeSingle()
  need(data, 404, 'Project not found')
  return data as any
}

route('GET', '/v2/projects', async c => must(await db().from('projects')
  .select('id,name,code,status,due_date,budget,created_at, owner:profiles!projects_owner_id_fkey(id,full_name), customer:customers(id,name)')
  .eq('org_id', orgOnly(c)).order('created_at', { ascending: false })))

route('GET', '/v2/projects/:id', async c => {
  const p = await loadProject(c, c.params.id)
  const [members, tasks, docs, acts] = await Promise.all([
    db().from('project_members').select('role, user:profiles(id,full_name,title)').eq('project_id', p.id),
    db().from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(full_name)').eq('project_id', p.id).order('created_at'),
    db().from('documents').select('id,title,status,updated_at').eq('project_id', p.id).neq('status', 'Draft'),
    db().from('audit_logs').select('action,created_at,actor:profiles!audit_logs_actor_id_fkey(full_name)').eq('entity_id', p.id).order('created_at', { ascending: false }).limit(10),
  ])
  return { ...p, members: must(members), tasks: must(tasks), documents: must(docs), activity: must(acts) }
})

route('POST', '/v2/projects', async c => {
  need(isManager(c), 403, 'Only managers can create projects')
  const b = c.body ?? {}
  need(typeof b.name === 'string' && b.name.trim().length > 1, 400, 'Project name is required')
  if (b.customer_id) {
    const { data } = await db().from('customers').select('id').eq('id', b.customer_id).eq('org_id', orgOnly(c)).maybeSingle()
    need(data, 400, 'Unknown customer')
  }
  const row = must(await db().from('projects').insert({
    org_id: orgOnly(c), name: b.name.trim(), description: b.description, customer_id: b.customer_id || null,
    due_date: b.due_date || null, budget: Number(b.budget) || 0, owner_id: c.userId, status: 'Draft',
    code: (b.name as string).replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() + '-' + Math.floor(200 + Math.random() * 700),
  }).select().single())
  await db().from('project_members').insert({ project_id: (row as any).id, user_id: c.userId, role: 'lead' })
  await audit(c, 'project.created', 'project', (row as any).id, { name: b.name })
  return row
})

route('PATCH', '/v2/projects/:id', async c => {
  const p = await loadProject(c, c.params.id)
  need(isManager(c) || p.owner_id === c.userId, 403, 'You cannot edit this project')
  const b = c.body ?? {}
  // editable fields for the project edit form
  const patch = pick(b, ['name', 'description', 'due_date', 'budget', 'customer_id', 'status'])
  if (patch.status && patch.status !== p.status) await hit(c, 'S-16')
  need(!patch.status || PROJECT_FLOW.includes(patch.status), 400, 'Invalid status')
  const row = must(await db().from('projects').update(patch).eq('id', p.id).select().single())
  await audit(c, 'project.updated', 'project', p.id, patch)
  return row
})

route('POST', '/v2/projects/:id/transition', async c => {
  const p = await loadProject(c, c.params.id)
  const to = c.body?.to
  const from = PROJECT_FLOW.indexOf(p.status), next = PROJECT_FLOW.indexOf(to)
  need(next === from + 1, 409, `Cannot move a ${p.status} project to ${to}`)
  if (to === 'Approved') need(isManager(c) && p.owner_id !== c.userId || isAdmin(c), 403, 'Approval requires a different manager or an administrator')
  else need(isManager(c) || p.owner_id === c.userId, 403, 'You cannot change this project status')
  const row = must(await db().from('projects').update({ status: to }).eq('id', p.id).select().single())
  await audit(c, 'project.status_changed', 'project', p.id, { from: p.status, to })
  return row
})

// ---------- tasks ----------
route('GET', '/v2/tasks', async c => {
  let q = db().from('tasks').select('*, project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name)').eq('org_id', orgOnly(c)).order('due_date')
  if (c.query.mine) q = q.eq('assignee_id', c.userId)
  if (c.query.project_id && isUuid(c.query.project_id)) q = q.eq('project_id', c.query.project_id)
  return must(await q)
})
route('POST', '/v2/tasks', async c => {
  const b = c.body ?? {}
  need(b.title, 400, 'Title is required')
  if (b.project_id) { await loadProject(c, b.project_id) }
  return must(await db().from('tasks').insert({
    org_id: orgOnly(c), project_id: b.project_id || null, title: b.title, description: b.description,
    priority: ['low', 'medium', 'high'].includes(b.priority) ? b.priority : 'medium', assignee_id: b.assignee_id || c.userId, due_date: b.due_date || null,
  }).select().single())
})
route('PATCH', '/v2/tasks/:id', async c => {
  need(isUuid(c.params.id), 404, 'Task not found')
  const patch = pick(c.body, ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date'])
  const { data } = await db().from('tasks').update(patch).eq('id', c.params.id).eq('org_id', orgOnly(c)).select().maybeSingle()
  need(data, 404, 'Task not found')
  return data
})

// ---------- customers ----------
route('GET', '/v2/customers', async c => {
  const rows = must(await db().from('customers').select('*, owner:profiles!customers_owner_id_fkey(full_name)').eq('org_id', orgOnly(c)).order('name')) as any[]
  return rows.map(r => isManager(c) ? r : { ...r, annual_value: null, notes: null })
})
route('GET', '/v2/customers/:id', async c => {
  need(isUuid(c.params.id), 404, 'Customer not found')
  const { data } = await db().from('customers').select('*, owner:profiles!customers_owner_id_fkey(full_name)').eq('id', c.params.id).eq('org_id', orgOnly(c)).maybeSingle()
  need(data, 404, 'Customer not found')
  const [projects, invoices] = await Promise.all([
    db().from('projects').select('id,name,status').eq('customer_id', c.params.id),
    db().from('invoices').select('id,number,status,total,currency').eq('customer_id', c.params.id),
  ])
  const row: any = data
  return { ...(isManager(c) ? row : { ...row, annual_value: null, notes: null }), projects: must(projects), invoices: isManager(c) ? must(invoices) : [] }
})
route('POST', '/v2/customers', async c => {
  need(isManager(c), 403, 'Only managers can add customers')
  const b = c.body ?? {}
  need(b.name, 400, 'Name is required')
  return must(await db().from('customers').insert({ ...pick(b, ['name', 'contact_name', 'email', 'phone', 'industry', 'annual_value', 'notes']), org_id: orgOnly(c), owner_id: c.userId }).select().single())
})
route('PATCH', '/v2/customers/:id', async c => {
  need(isUuid(c.params.id), 404, 'Customer not found')
  const b = { ...(c.body ?? {}) }
  delete b.id
  if (!isManager(c)) for (const k of Object.keys(b)) if (!['contact_name', 'email', 'phone', 'notes'].includes(k) && !['org_id', 'owner_id'].includes(k)) delete b[k]
  if ((b.org_id && b.org_id !== c.orgId) || (b.owner_id && b.owner_id !== c.userId)) await hit(c, 'S-06')
  const { data, error } = await db().from('customers').update(b).eq('id', c.params.id).eq('org_id', orgOnly(c)).select().maybeSingle()
  if (error) throw new HttpError(400, 'Update failed')
  need(data, 404, 'Customer not found')
  await audit(c, 'customer.updated', 'customer', c.params.id)
  return data
})

// ---------- team ----------
route('GET', '/v2/members', async c => {
  const rows = must(await db().from('organization_members')
    .select('role,status,created_at, user:profiles(id,full_name,email,title,phone,avatar_path,last_ip,security_notes,status)')
    .eq('org_id', orgOnly(c)).neq('status', 'removed').order('created_at')) as any[]
  return rows.map(r => ({ user_id: r.user.id, role: r.role, status: r.status, joined_at: r.created_at, ...r.user }))
})
route('PATCH', '/v2/members/:userId', async c => {
  need(isAdmin(c), 403, 'Only administrators can change roles')
  need(['employee', 'manager', 'organization_admin'].includes(c.body?.role), 400, 'Invalid role')
  need(isUuid(c.params.userId), 404, 'Member not found')
  const { data } = await db().from('organization_members').update({ role: c.body.role }).eq('org_id', orgOnly(c)).eq('user_id', c.params.userId).select().maybeSingle()
  need(data, 404, 'Member not found')
  await audit(c, 'member.role_changed', 'member', c.params.userId, { role: c.body.role })
  return data
})
route('DELETE', '/v2/members/:userId', async c => {
  need(isUuid(c.params.userId), 404, 'Member not found')
  need(c.params.userId !== c.userId, 400, 'You cannot remove yourself')
  if (!isAdmin(c)) await hit(c, 'S-07')
  const { data } = await db().from('organization_members').update({ status: 'removed' }).eq('org_id', orgOnly(c)).eq('user_id', c.params.userId).select().maybeSingle()
  need(data, 404, 'Member not found')
  await audit(c, 'member.removed', 'member', c.params.userId)
  return { ok: true }
})

// ---------- messages ----------
route('GET', '/v2/messages', async c => {
  const channel = c.query.channel || 'general'
  return must(await db().from('messages').select('id,channel,body,created_at, sender:profiles!messages_sender_id_fkey(id,full_name)')
    .eq('org_id', orgOnly(c)).eq('channel', channel).order('created_at', { ascending: true }).limit(100))
})
route('POST', '/v2/messages', async c => {
  const body = String(c.body?.body ?? '').slice(0, 2000)
  need(body.trim(), 400, 'Message cannot be empty')
  const channel = ['general', 'projects', 'finance', 'support'].includes(c.body?.channel) ? c.body.channel : 'general'
  return must(await db().from('messages').insert({ org_id: orgOnly(c), channel, sender_id: c.userId, body }).select().single())
})

// ---------- search ----------
route('GET', '/v2/search', async c => {
  const q = String(c.query.q ?? '').replace(/[%,()]/g, ' ').trim()
  if (!q) return { query: q, projects: [], documents: [], customers: [] }
  const org = orgOnly(c)
  const [p, d, cu] = await Promise.all([
    db().from('projects').select('id,name,status').eq('org_id', org).ilike('name', `%${q}%`).limit(8),
    db().from('documents').select('id,title,status').eq('org_id', org).neq('status', 'Draft').ilike('title', `%${q}%`).limit(8),
    db().from('customers').select('id,name,industry').eq('org_id', org).ilike('name', `%${q}%`).limit(8),
  ])
  return { query: q, projects: must(p), documents: must(d), customers: must(cu) }
})
