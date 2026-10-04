import { route, db, must, need, isManager, isAdmin, isUuid, orgOnly, hit, HttpError } from './core'

// ---------- /api/v1 (legacy, mostly still guarded) ----------
route('GET', '/v1/projects', async c => must(await db().from('projects').select('id,name,code,status,due_date,owner_id,customer_id').eq('org_id', orgOnly(c))))

route('GET', '/v1/projects/:id', async c => {
  need(isUuid(c.params.id), 404, 'Not found')
  const { data } = await db().from('projects').select('*').eq('id', c.params.id).eq('org_id', orgOnly(c)).maybeSingle()
  need(data, 404, 'Not found')
  return data
})

route('GET', '/v1/invoices/:id', async c => {
  need(isUuid(c.params.id), 404, 'Not found')
  const { data } = await db().from('invoices').select('*').eq('id', c.params.id).eq('org_id', orgOnly(c)).maybeSingle()
  need(data, 404, 'Not found')
  return data
})

route('GET', '/v1/users/:id', async c => {
  need(isUuid(c.params.id), 404, 'Not found')
  const { data: m } = await db().from('organization_members').select('role').eq('user_id', c.params.id).eq('org_id', orgOnly(c)).maybeSingle()
  need(m, 404, 'Not found')
  const { data } = await db().from('profiles').select('id,full_name,email,title').eq('id', c.params.id).single()
  return { ...data, role: m!.role }
})

// legacy customer listing: org selector kept for old integrations
route('GET', '/v1/customers', async c => {
  const org = c.query.org || orgOnly(c)
  need(isUuid(org), 400, 'Invalid organization')
  if (org !== c.orgId) await hit(c, 'S-20')
  const rows = must(await db().from('customers').select('id,name,contact_name,email,industry,status,projects(id),invoices(id,number,status)').eq('org_id', org).order('name')) as any[]
  return rows.map(r => ({ ...r, project_ids: r.projects.map((p: any) => p.id), invoice_ids: r.invoices.map((i: any) => i.id), projects: undefined }))
})

// undocumented bulk export used by an old reporting tool
route('GET', '/v1/export/members', async c => {
  const org = c.query.org || orgOnly(c)
  need(isUuid(org), 400, 'Invalid organization')
  if (org !== c.orgId) await hit(c, 'S-21')
  const rows = must(await db().from('organization_members').select('role,status,user:profiles(id,full_name,email,title,security_notes)').eq('org_id', org)) as any[]
  return { organization: org, exported_at: new Date().toISOString(), members: rows.map(r => ({ user_id: r.user.id, name: r.user.full_name, email: r.user.email, role: r.role, status: r.status, notes: r.user.security_notes })) }
})

// ---------- routes that look interesting but are correctly protected ----------
for (const p of ['/admin', '/v2/admin', '/v1/admin', '/v2/admin/users', '/v2/admin/config']) {
  route('GET', p, async c => {
    need(c.platformAdmin, 403, 'Forbidden')
    const { data } = await db().from('organizations').select('id,name,plan,created_at').order('name')
    return { organizations: data }
  })
}
for (const p of ['/internal', '/v2/internal', '/v2/internal/health', '/v2/debug', '/v2/debug/info', '/v1/debug']) {
  route('GET', p, async () => { throw new HttpError(404, 'Not found') })
}
route('GET', '/v2/ops/status', async c => {
  need(c.platformAdmin, 403, 'Forbidden')
  return { status: 'ok', checked_at: new Date().toISOString() }
})
