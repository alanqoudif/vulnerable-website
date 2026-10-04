import { route, db, must, need, pick, isManager, isAdmin, isUuid, orgOnly, hit, audit, HttpError, randomToken, sha256, sleep, readContext, clientIp, rateLimit, Ctx } from './core'

// ---------- developer platform (training keys only) ----------
route('GET', '/v2/developer/keys', async c => {
  let q = db().from('api_keys').select('id,name,prefix,status,scopes,last_used_at,created_at,revoked_at,owner:profiles!api_keys_owner_id_fkey(id,full_name)').eq('org_id', orgOnly(c)).order('created_at', { ascending: false })
  if (!isAdmin(c)) q = q.eq('owner_id', c.userId)
  return must(await q)
})
route('POST', '/v2/developer/keys', async c => {
  const name = String(c.body?.name ?? '').trim()
  need(name.length > 1, 400, 'Give the key a name')
  const plain = randomToken('mb_test_', 12)
  const row: any = must(await db().from('api_keys').insert({
    org_id: orgOnly(c), owner_id: c.userId, name, prefix: plain.slice(0, 12), key_hash: sha256(plain), status: 'Created',
    scopes: Array.isArray(c.body?.scopes) && c.body.scopes.length ? c.body.scopes.filter((s: string) => ['chat', 'knowledge', 'embeddings'].includes(s)) : ['chat'],
  }).select('id,name,prefix,status,scopes,created_at').single())
  await audit(c, 'api_key.created', 'api_key', row.id, { name })
  return { ...row, secret: plain, notice: 'Copy this key now. It will not be shown again.' }
})
async function ownKey(c: Ctx) {
  need(isUuid(c.params.id), 404, 'Key not found')
  const { data } = await db().from('api_keys').select('*').eq('id', c.params.id).eq('org_id', orgOnly(c)).maybeSingle()
  need(data && (data.owner_id === c.userId || isAdmin(c)), 404, 'Key not found')
  return data as any
}
route('POST', '/v2/developer/keys/:id/activate', async c => {
  const k = await ownKey(c)
  need(k.status === 'Created', 409, 'Only newly created keys can be activated')
  return must(await db().from('api_keys').update({ status: 'Active' }).eq('id', k.id).select('id,status').single())
})
route('POST', '/v2/developer/keys/:id/revoke', async c => {
  const k = await ownKey(c)
  need(k.status !== 'Revoked', 409, 'Key is already revoked')
  await audit(c, 'api_key.revoked', 'api_key', k.id)
  return must(await db().from('api_keys').update({ status: 'Revoked', revoked_at: new Date().toISOString() }).eq('id', k.id).select('id,status').single())
})

route('GET', '/v2/developer/usage', async c => {
  const days = Math.min(Number(c.query.days) || 14, 60)
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
  const rows = must(await db().from('api_usage').select('day,model,requests,input_tokens,output_tokens,cost, key:api_keys(name)').eq('org_id', orgOnly(c)).gte('day', since).order('day')) as any[]
  const daily: Record<string, any> = {}, models: Record<string, any> = {}
  for (const r of rows) {
    const d = (daily[r.day] ||= { day: r.day, requests: 0, tokens: 0, cost: 0 })
    d.requests += r.requests; d.tokens += Number(r.input_tokens) + Number(r.output_tokens); d.cost += Number(r.cost)
    const m = (models[r.model] ||= { model: r.model, requests: 0, tokens: 0, cost: 0 })
    m.requests += r.requests; m.tokens += Number(r.input_tokens) + Number(r.output_tokens); m.cost += Number(r.cost)
  }
  return { daily: Object.values(daily), models: Object.values(models), totals: { requests: rows.reduce((s, r) => s + r.requests, 0), cost: rows.reduce((s, r) => s + Number(r.cost), 0) } }
})
route('GET', '/v2/developer/logs', async c => {
  need(isManager(c), 403, 'Request logs are available to managers and administrators')
  return must(await db().from('api_request_logs').select('id,method,path,status_code,latency_ms,model,ip,created_at, key:api_keys(name,prefix)').eq('org_id', orgOnly(c)).order('created_at', { ascending: false }).limit(100))
})
route('GET', '/v2/developer/docs', async () => ({
  baseUrl: 'https://api.mibyan-demo.test',
  auth: 'Authorization: Bearer mb_test_…',
  endpoints: [
    { method: 'POST', path: '/v2/chat/completions', description: 'Create a chat completion (simulated).', body: { model: 'mibyan-fast', messages: [{ role: 'user', content: 'Hello' }] } },
    { method: 'GET', path: '/v2/ai/models', description: 'List available models.' },
    { method: 'GET', path: '/v2/developer/usage', description: 'Aggregated usage for your organization.' },
  ],
  notes: 'Training keys are issued for the simulated gateway only and never reach external AI services.',
}))

// Simulated gateway: validates a training key and returns canned output.
route('POST', '/v2/chat/completions', async c => {
  const m = /^Bearer\s+(mb_test_[0-9a-f]+)$/i.exec(c.req.headers.get('authorization') ?? '')
  need(m, 401, 'Missing or malformed API key')
  const { data: k } = await db().from('api_keys').select('*').eq('key_hash', sha256(m![1])).maybeSingle()
  need(k && k.status === 'Active', 401, 'Invalid API key')
  const model = ['mibyan-4.1', 'mibyan-fast', 'mibyan-reasoning'].includes(c.body?.model) ? c.body.model : 'mibyan-fast'
  const last = String(c.body?.messages?.at(-1)?.content ?? '')
  const out = `Simulated response from ${model}: received ${last.length} characters.`
  await db().from('api_request_logs').insert({ org_id: k.org_id, api_key_id: k.id, method: 'POST', path: '/v2/chat/completions', status_code: 200, latency_ms: 120 + Math.floor(Math.random() * 300), model, ip: c.ip })
  await db().from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', k.id)
  return { id: 'cmpl_' + randomToken('', 6), model, choices: [{ index: 0, message: { role: 'assistant', content: out } }], usage: { prompt_tokens: Math.ceil(last.length / 4), completion_tokens: 18 } }
}, { auth: false })

// ---------- finance ----------
const INV_FLOW = ['Draft', 'Sent', 'Approved', 'Paid']

async function loadInvoice(c: Ctx, id: string) {
  need(isUuid(id), 404, 'Invoice not found')
  const { data } = await db().from('invoices').select('*, customer:customers(id,name,email), owner:profiles!invoices_owner_id_fkey(id,full_name)').eq('id', id).eq('org_id', orgOnly(c)).maybeSingle()
  need(data, 404, 'Invoice not found')
  return data as any
}
route('GET', '/v2/invoices', async c => must(await db().from('invoices').select('id,number,status,total,currency,due_date,issued_at,customer:customers(id,name),owner:profiles!invoices_owner_id_fkey(full_name)').eq('org_id', orgOnly(c)).order('created_at', { ascending: false })))
route('GET', '/v2/invoices/:id', async c => {
  const inv = await loadInvoice(c, c.params.id)
  const items = must(await db().from('invoice_items').select('*').eq('invoice_id', inv.id).order('amount', { ascending: false }))
  return { ...inv, items }
})
route('POST', '/v2/invoices', async c => {
  need(isManager(c), 403, 'Only managers can create invoices')
  const b = c.body ?? {}
  need(Array.isArray(b.items) && b.items.length > 0 && b.items.length <= 30, 400, 'Add at least one line item')
  const org = orgOnly(c)
  if (b.customer_id) { const { data } = await db().from('customers').select('id').eq('id', b.customer_id).eq('org_id', org).maybeSingle(); need(data, 400, 'Unknown customer') }
  let negative = false
  const items = b.items.map((i: any) => {
    const quantity = Number(i.quantity), unit_price = Number(i.unit_price)
    need(i.description && Number.isFinite(quantity) && Number.isFinite(unit_price), 400, 'Each line needs a description, quantity and price')
    need(unit_price >= 0, 400, 'Unit price cannot be negative')
    if (quantity <= 0) negative = true
    return { description: String(i.description).slice(0, 200), quantity, unit_price, amount: Math.round(quantity * unit_price * 100) / 100 }
  })
  if (negative) await hit(c, 'S-15')
  const subtotal = items.reduce((s: number, i: any) => s + i.amount, 0)
  const tax = Math.round(subtotal * 0.05 * 100) / 100
  const { count } = await db().from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', org)
  const inv: any = must(await db().from('invoices').insert({
    org_id: org, number: 'INV-' + (2000 + (count ?? 0) + 1), customer_id: b.customer_id || null, owner_id: c.userId, status: 'Draft',
    subtotal, tax, total: subtotal + tax, due_date: b.due_date || null, issued_at: new Date().toISOString().slice(0, 10),
  }).select().single())
  await db().from('invoice_items').insert(items.map((i: any) => ({ ...i, invoice_id: inv.id })))
  await audit(c, 'invoice.created', 'invoice', inv.id)
  return inv
})
route('POST', '/v2/invoices/:id/transition', async c => {
  const inv = await loadInvoice(c, c.params.id)
  const to = c.body?.to
  need(INV_FLOW.indexOf(to) === INV_FLOW.indexOf(inv.status) + 1, 409, `Cannot move a ${inv.status} invoice to ${to}`)
  if (to === 'Sent') need(isManager(c) || inv.owner_id === c.userId, 403, 'You cannot send this invoice')
  if (to === 'Approved') need(isManager(c), 403, 'Only managers can approve invoices')
  if (to === 'Paid' && !isAdmin(c)) await hit(c, 'S-04')
  const row = must(await db().from('invoices').update({ status: to }).eq('id', inv.id).select().single())
  await audit(c, 'invoice.' + to.toLowerCase(), 'invoice', inv.id)
  return row
})
route('PATCH', '/v2/invoices/:id/status', async c => {
  const inv = await loadInvoice(c, c.params.id)
  need(isManager(c), 403, 'Only invoice managers can change status')
  const to = c.body?.status
  need(INV_FLOW.includes(to), 400, 'Invalid invoice status')
  const row = must(await db().from('invoices').update({ status: to }).eq('id', inv.id).select().single())
  if (INV_FLOW.indexOf(to) !== INV_FLOW.indexOf(inv.status) + 1) {
    await hit(c, 'VULN-06')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-06', action: 'invalid_invoice_transition_persisted', resource_id: inv.id, metadata: { from: inv.status, to } })
  }
  return row
})
route('POST', '/v2/invoices/:id/approve', async c => {
  const inv = await loadInvoice(c, c.params.id)
  need(isManager(c), 403, 'Only managers can approve invoices')
  need(['Sent','Approved'].includes(inv.status), 409, 'Invoice is not ready for approval')
  const { count } = await db().from('scenario_events').select('id', { count: 'exact', head: true }).eq('trainee_id', c.userId).eq('scenario_id', 'VULN-07').eq('resource_id', inv.id)
  need((count ?? 0) < 3, 409, 'Approval replay limit reached')
  await db().from('audit_logs').insert({ org_id: inv.org_id, actor_id: c.userId, action: 'invoice.approved', entity_type: 'invoice', entity_id: inv.id, metadata: { source: 'training_approval' }, ip: c.ip })
  const row = must(await db().from('invoices').update({ status: 'Approved' }).eq('id', inv.id).select().single())
  await hit(c, 'VULN-07')
  await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-07', action: 'invoice_approval_effect', resource_id: inv.id })
  return row
})
route('GET', '/v2/invoices/:id/items', async c => {
  need(isUuid(c.params.id), 404, 'Invoice not found')
  const { data: inv } = await db().from('invoices').select('id,number,currency,org_id,status').eq('id', c.params.id).maybeSingle()
  need(inv, 404, 'Invoice not found')
  if (inv.org_id !== c.orgId) await hit(c, 'S-05')
  const items = must(await db().from('invoice_items').select('id,description,quantity,unit_price,amount').eq('invoice_id', inv.id))
  return { invoice: { id: inv.id, number: inv.number, currency: inv.currency, status: inv.status }, items }
})
route('POST', '/v2/invoices/:id/apply-credit', async c => {
  need(isManager(c), 403, 'Only managers can apply credit')
  const inv = await loadInvoice(c, c.params.id)
  need(inv.status === 'Approved', 409, 'Credit can be applied to approved invoices')
  const amount = Math.round(Number(c.body?.amount) * 100) / 100
  need(Number.isFinite(amount) && amount > 0, 400, 'Enter a valid amount')
  const { data: org } = await db().from('organizations').select('credit_balance').eq('id', inv.org_id).single()
  const balance = Number(org!.credit_balance)
  need(amount <= balance, 422, 'Amount exceeds available credit')
  need(Number(inv.credit_applied) + amount <= Number(inv.total), 422, 'Amount exceeds the invoice balance')
  await sleep(120)
  await db().from('organizations').update({ credit_balance: balance - amount }).eq('id', inv.org_id)
  await db().from('invoices').update({ credit_applied: Number(inv.credit_applied) + amount }).eq('id', inv.id)
  await db().from('audit_logs').insert({ org_id: inv.org_id, actor_id: c.userId, action: 'invoice.credit_applied', entity_type: 'invoice', entity_id: inv.id, metadata: { amount, balance_seen: balance }, ip: c.ip })
  const since = new Date(Date.now() - 20_000).toISOString()
  const { data: recent } = await db().from('audit_logs').select('metadata').eq('org_id', inv.org_id).eq('action', 'invoice.credit_applied').gte('created_at', since)
  const spent = (recent ?? []).reduce((s: number, r: any) => s + Number(r.metadata?.amount ?? 0), 0)
  if (spent > balance) await hit(c, 'S-17')
  return { applied: amount, remaining_credit: balance - amount }
})
route('GET', '/v2/plans', async c => {
  const plans = must(await db().from('plans').select('*').order('price_monthly'))
  const { data: org } = await db().from('organizations').select('plan,credit_balance').eq('id', orgOnly(c)).single()
  const { count } = await db().from('organization_members').select('id', { count: 'exact', head: true }).eq('org_id', c.orgId!).eq('status', 'active')
  return { plans, current: org!.plan, credit_balance: isManager(c) ? org!.credit_balance : null, seats_used: count ?? 0 }
})

// ---------- organization ----------
route('GET', '/v2/org', async c => {
  const { data } = await db().from('organizations').select('id,name,slug,industry,country,plan,billing_email,settings,created_at').eq('id', orgOnly(c)).single()
  return data
})
route('PATCH', '/v2/org/settings', async c => {
  const ctx = readContext(c.req.headers.get('x-workspace-context'))
  const effectiveRole = ctx?.claims?.role ?? c.role
  need(effectiveRole === 'organization_admin', 403, 'Only administrators can change organization settings')
  if (ctx?.unsigned && c.role !== 'organization_admin') await hit(c, 'S-14')
  const patch = pick(c.body, ['name', 'billing_email', 'industry'])
  if (c.body?.settings && typeof c.body.settings === 'object') patch.settings = c.body.settings
  const row = must(await db().from('organizations').update(patch).eq('id', orgOnly(c)).select('id,name,billing_email,industry,settings').single())
  if (ctx?.claims?.role === 'organization_admin' && c.role !== 'organization_admin') {
    await hit(c, 'VULN-17')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-17', action: 'client_role_claim_authorized', resource_id: c.orgId! })
  }
  await audit(c, 'org.settings_updated', 'organization', c.orgId!)
  return row
})
route('GET', '/v2/audit', async c => {
  need(isManager(c), 403, 'Audit log is available to managers and administrators')
  return must(await db().from('audit_logs').select('id,action,entity_type,entity_id,metadata,ip,created_at,actor:profiles!audit_logs_actor_id_fkey(id,full_name)').eq('org_id', orgOnly(c)).order('created_at', { ascending: false }).limit(150))
})

// ---------- invitations ----------
route('GET', '/v2/invitations', async c => {
  if (!isManager(c)) await hit(c, 'S-22')
  return must(await db().from('invitations').select('id,email,role,token,status,expires_at,created_at,inviter:profiles!invitations_invited_by_fkey(full_name)').eq('org_id', orgOnly(c)).order('created_at', { ascending: false }))
})
route('POST', '/v2/invitations', async c => {
  need(isManager(c), 403, 'Only managers can invite people')
  const email = String(c.body?.email ?? '').trim().toLowerCase()
  need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), 400, 'Enter a valid email address')
  const role = ['employee', 'manager'].includes(c.body?.role) ? c.body.role : 'employee'
  need(role !== 'manager' || isAdmin(c), 403, 'Only administrators can invite managers')
  const row: any = must(await db().from('invitations').insert({ org_id: orgOnly(c), email, role, token: randomToken('inv_', 12), invited_by: c.userId, status: 'Created', expires_at: new Date(Date.now() + 14 * 864e5).toISOString() }).select().single())
  await audit(c, 'member.invited', 'invitation', row.id, { email, role })
  return row
})
route('POST', '/v2/invitations/:id/send', async c => {
  need(isManager(c), 403, 'Only managers can send invitations')
  need(isUuid(c.params.id), 404, 'Invitation not found')
  const { data: inv } = await db().from('invitations').select('*').eq('id', c.params.id).eq('org_id', orgOnly(c)).maybeSingle()
  need(inv, 404, 'Invitation not found')
  need(inv.status === 'Created', 409, 'Invitation was already sent')
  return must(await db().from('invitations').update({ status: 'Sent' }).eq('id', inv.id).select('id,status').single())
})
route('DELETE', '/v2/invitations/:id', async c => {
  need(isAdmin(c), 403, 'Only administrators can cancel invitations')
  need(isUuid(c.params.id), 404, 'Invitation not found')
  await db().from('invitations').delete().eq('id', c.params.id).eq('org_id', orgOnly(c))
  return { ok: true }
})
route('GET', '/v2/invitations/lookup/:token', async c => {
  const { data } = await db().from('invitations').select('email,status,expires_at,organizations(name)').eq('token', c.params.token).maybeSingle()
  need(data && data.status === 'Sent' && new Date(data.expires_at) > new Date(), 404, 'This invitation is not valid')
  return { email: data!.email, organization: (data as any).organizations.name }
}, { auth: false })
async function acceptInvite(c: Ctx, token?: string, secure = false) {
  const b = c.body ?? {}
  const inviteToken = token ?? b.token
  need(inviteToken && b.password && b.full_name, 400, 'Name and password are required')
  need(String(b.password).length >= 10, 400, 'Password must be at least 10 characters')
  const { data: inv } = await db().from('invitations').select('*').eq('token', inviteToken).maybeSingle()
  need(inv && inv.status === 'Sent' && new Date(inv.expires_at) > new Date(), 404, 'This invitation is not valid')
  const role = secure ? inv.role : (b.role ?? inv.role)
  need(['employee', 'manager', 'organization_admin'].includes(role), 400, 'Invalid role')
  if (!secure && b.role && b.role !== inv.role) {
    await hit(c, 'S-23'); await hit(c, 'VULN-05')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-05', action: 'invitation_role_overridden', resource_id: inv.id, metadata: { requested_role: b.role, invitation_role: inv.role } })
  }
  await db().from('invitations').update({ status: 'Accepted' }).eq('id', inv.id)
  const created = await db().auth.admin.createUser({ email: inv.email, password: b.password, email_confirm: true, user_metadata: { full_name: b.full_name } })
  if (created.error) throw new HttpError(409, 'An account with this email already exists')
  const uid = created.data.user.id
  await db().from('profiles').insert({ id: uid, email: inv.email, full_name: String(b.full_name).slice(0, 80), default_org_id: inv.org_id, title: 'New member' })
  await db().from('organization_members').insert({ org_id: inv.org_id, user_id: uid, role })
  await db().from('invitations').update({ status: 'Member Created' }).eq('id', inv.id)
  if (!secure && role === 'organization_admin' && inv.role !== role) await db().from('scenario_events').insert({ trainee_id: uid, scenario_id: 'CHAIN-C', action: 'invitee_created_as_synthetic_admin', resource_id: inv.id, metadata: { organization_id: inv.org_id } })
  await db().from('audit_logs').insert({ org_id: inv.org_id, actor_id: uid, action: 'member.joined', entity_type: 'member', entity_id: uid, metadata: { role }, ip: c.ip })
  return { ok: true, email: inv.email }
}
route('POST', '/v2/invitations/accept', async c => acceptInvite(c), { auth: false })
route('POST', '/v2/invitations/:token/accept', async c => acceptInvite(c, c.params.token), { auth: false })
route('POST', '/v2/invitations/:token/complete', async c => acceptInvite(c, c.params.token, true), { auth: false })

// ---------- account ----------
route('PATCH', '/v2/account/profile', async c => {
  const patch = pick(c.body, ['full_name', 'title', 'phone', 'avatar_path'])
  if (patch.avatar_path) need(String(patch.avatar_path).startsWith(c.userId + '/'), 400, 'Invalid avatar path')
  const profile = must(await db().from('profiles').update(patch).eq('id', c.userId).select('id,full_name,title,phone,avatar_path,email').single())
  if (['employee','manager','organization_admin'].includes(c.body?.role)) {
    const { data } = await db().from('organization_members').update({ role: c.body.role }).eq('user_id', c.userId).eq('org_id', orgOnly(c)).select().maybeSingle()
    if (data) { await hit(c, 'VULN-04'); await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-04', action: 'profile_mass_assignment_role_change', resource_id: c.userId, metadata: { role: c.body.role } }) }
  }
  return profile
})
route('POST', '/v2/account/password', async c => {
  need(!c.profile?.is_instructor, 403, 'Password changes are unavailable for the instructor account in this range')
  need(String(c.body?.password ?? '').length >= 10, 400, 'Password must be at least 10 characters')
  const r = await db().auth.admin.updateUserById(c.userId, { password: c.body.password })
  if (r.error) throw new HttpError(400, 'Could not update password')
  await hit(c, 'VULN-16')
  let claims: any = {}
  try { claims = JSON.parse(Buffer.from(c.token.split('.')[1], 'base64url').toString()) } catch { /* authenticated middleware already validated the token */ }
  await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-16', action: 'password_changed_without_session_revocation', resource_id: claims.session_id ?? c.userId, metadata: { token_hash: sha256(c.token), expires_at: claims.exp ?? null } })
  await audit(c, 'account.password_changed', 'user', c.userId)
  return { ok: true }
})
route('GET', '/v2/account/sessions', async c => must(await db().from('sessions').select('id,device,ip,location,revoked,last_seen_at,created_at').eq('user_id', c.userId).order('last_seen_at', { ascending: false })))
route('POST', '/v2/account/sessions/register', async c => {
  const ua = c.req.headers.get('user-agent') ?? ''
  const device = /iPhone|Android/.test(ua) ? 'Mobile browser' : /Mac/.test(ua) ? 'Mac - Browser' : /Windows/.test(ua) ? 'Windows - Browser' : 'Web browser'
  let tokenClaims: any
  try { tokenClaims = JSON.parse(Buffer.from(c.token.split('.')[1], 'base64url').toString()) } catch { throw new HttpError(401, 'Your session is not valid') }
  need(isUuid(tokenClaims.session_id), 401, 'Your session is not valid')
  await db().from('profiles').update({ last_ip: c.ip }).eq('id', c.userId)
  return must(await db().from('sessions').upsert({ id: tokenClaims.session_id, user_id: c.userId, device, ip: c.ip, user_agent: ua.slice(0, 200), location: 'Muscat, OM', revoked: false }, { onConflict: 'id' }).select('id').single())
})
route('DELETE', '/v2/account/sessions/:id', async c => {
  need(isUuid(c.params.id), 404, 'Session not found')
  const { data } = await db().from('sessions').update({ revoked: true }).eq('id', c.params.id).eq('user_id', c.userId).select('id').maybeSingle()
  need(data, 404, 'Session not found')
  return { ok: true }
})
route('POST', '/v2/account/sessions/revoke-others', async c => {
  await db().from('sessions').update({ revoked: true }).eq('user_id', c.userId).neq('id', c.body?.current ?? '00000000-0000-0000-0000-000000000000')
  return { ok: true }
})

// ---------- public auth helpers ----------
route('POST', '/v2/auth/lookup', async c => {
  const email = String(c.body?.email ?? '').trim().toLowerCase()
  need(email, 400, 'Enter your work email')
  const { data } = await db().from('profiles').select('full_name,status,default_org_id').eq('email', email).maybeSingle()
  if (!data) { await hit(c, 'S-11'); throw new HttpError(404, 'No account found for this email address') }
  const { data: org } = await db().from('organizations').select('name').eq('id', data.default_org_id).maybeSingle()
  return { exists: true, first_name: data.full_name.split(' ')[0], workspace: org?.name ?? null }
}, { auth: false })

route('POST', '/v2/auth/forgot', async c => {
  const email = String(c.body?.email ?? '').trim().toLowerCase()
  const key = 'forgot:' + (c.req.headers.get('x-forwarded-for')?.split(',')[0].trim() || c.ip)
  need(await rateLimit(key, 5, 900), 429, 'Too many requests. Please try again later.')
  const { data } = await db().from('profiles').select('id').eq('email', email).maybeSingle()
  if (data) {
    await db().from('password_resets').update({ used: true }).eq('email', email).eq('used', false)
    await db().from('password_resets').insert({ email, code: String(Math.floor(Math.random() * 10000)).padStart(4, '0'), expires_at: new Date(Date.now() + 30 * 60_000).toISOString() })
  }
  return { ok: true, message: 'If an account exists for that address, a reset code has been sent.' }
}, { auth: false })

async function doReset(c: Ctx) {
  const email = String(c.body?.email ?? '').trim().toLowerCase()
  const code = String(c.body?.code ?? '')
  need(email && /^\d{4}$/.test(code) && String(c.body?.password ?? '').length >= 10, 400, 'Email, 4-digit code and a password of at least 10 characters are required')
  const { data: r } = await db().from('password_resets').select('*').eq('email', email).eq('used', false).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!r || new Date(r.expires_at) < new Date() || r.code !== code) {
    if (r) await db().from('password_resets').update({ attempts: r.attempts + 1 }).eq('id', r.id)
    throw new HttpError(400, 'The code is invalid or has expired')
  }
  const { data: p } = await db().from('profiles').select('id').eq('email', email).single()
  const upd = await db().auth.admin.updateUserById(p!.id, { password: c.body.password })
  if (upd.error) throw new HttpError(400, 'Could not reset password')
  await db().from('password_resets').update({ used: true }).eq('id', r.id)
  await hit(c, 'S-12')
  return { ok: true }
}
route('POST', '/v2/auth/reset', async c => {
  const key = 'reset:' + (c.req.headers.get('x-forwarded-for')?.split(',')[0].trim() || c.ip)
  need(await rateLimit(key, 8, 600), 429, 'Too many attempts. Please try again later.')
  return doReset(c)
}, { auth: false })
route('POST', '/v1/auth/reset', async c => { await hit(c, 'S-18'); await hit(c, 'VULN-18'); await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-18', action: 'legacy_reset_rate_limit_bypassed' }); return doReset(c) }, { auth: false })

// cross-origin widget (embedded in partner portals)
route('GET', '/v2/widget/me', async c => {
  const origin = c.req.headers.get('origin')
  if (origin && new URL(c.url).origin !== origin) { await hit(c, 'S-19'); await hit(c, 'VULN-19'); await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-19', action: 'untrusted_cors_origin_reflected' }) }
  const { data: org } = await db().from('organizations').select('name').eq('id', c.orgId ?? '').maybeSingle()
  return { name: c.profile.full_name, email: c.profile.email, organization: org?.name ?? null, role: c.role }
})
