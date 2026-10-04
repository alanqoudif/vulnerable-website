import { route, db, must, need, pick, isUuid, HttpError, Ctx } from './core'
import { seedStorage, purgeStorage } from './storage'

const ZERO = '00000000-0000-0000-0000-000000000000'
const REPORT_STATUSES = ['Submitted', 'Under Review', 'Valid', 'Duplicate', 'Informational', 'Needs More Evidence', 'Resolved', 'Retested']

// ---------- trainee: security reports ----------
route('GET', '/v2/reports', async c => {
  const rows = must(await db().from('security_reports').select('id,title,component,severity,status,score,created_at,updated_at').eq('trainee_id', c.userId).order('created_at', { ascending: false }))
  return rows
})
route('POST', '/v2/reports', async c => {
  const b = c.body ?? {}
  need(b.title && b.description, 400, 'Title and description are required')
  const sev = ['Low', 'Medium', 'High', 'Critical'].includes(b.severity) ? b.severity : 'Medium'
  return must(await db().from('security_reports').insert({ trainee_id: c.userId, ...pick(b, ['title', 'component', 'description', 'steps', 'evidence', 'impact', 'remediation']), severity: sev }).select().single())
})
route('GET', '/v2/reports/:id', async c => {
  need(isUuid(c.params.id), 404, 'Report not found')
  const { data } = await db().from('security_reports').select('*').eq('id', c.params.id).eq('trainee_id', c.userId).maybeSingle()
  need(data, 404, 'Report not found')
  const comments = must(await db().from('report_comments').select('id,body,created_at').eq('report_id', c.params.id).order('created_at'))
  const { score, ...rest } = data as any
  return { ...rest, score, comments }
})

// ---------- instructor (separate namespace, role-gated) ----------
function instructor(c: Ctx) {
  if (!c.profile?.is_instructor) throw new HttpError(404, 'Not found')
}

route('GET', '/instructor/overview', async c => {
  instructor(c)
  const [trainees, scen, prog, reps] = await Promise.all([
    db().from('profiles').select('id', { count: 'exact', head: true }).eq('is_trainee', true),
    db().from('training_scenarios').select('id', { count: 'exact', head: true }),
    db().from('training_progress').select('scenario_id,trainee_id'),
    db().from('security_reports').select('status,score'),
  ])
  const discovered = new Set((prog.data ?? []).map((p: any) => p.scenario_id))
  const byStatus: Record<string, number> = {}
  ;(reps.data ?? []).forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] ?? 0) + 1 })
  return { trainees: trainees.count ?? 0, scenarios: scen.count ?? 0, discoveredScenarios: discovered.size, reports: reps.data?.length ?? 0, reportsByStatus: byStatus, totalScore: (reps.data ?? []).reduce((s: number, r: any) => s + (r.score ?? 0), 0) }
})

route('GET', '/instructor/trainees', async c => {
  instructor(c)
  const [profiles, prog, reps, mem] = await Promise.all([
    db().from('profiles').select('id,full_name,email,is_trainee,default_org_id').eq('is_trainee', true),
    db().from('training_progress').select('trainee_id,scenario_id,discovered_at'),
    db().from('security_reports').select('trainee_id,status,score'),
    db().from('organizations').select('id,name'),
  ])
  const orgs = new Map((mem.data ?? []).map((o: any) => [o.id, o.name]))
  const list = (profiles.data ?? []).map((p: any) => {
    const pr = (prog.data ?? []).filter((x: any) => x.trainee_id === p.id)
    const rp = (reps.data ?? []).filter((x: any) => x.trainee_id === p.id)
    return { ...p, organization: orgs.get(p.default_org_id), discovered: pr.length, last_activity: pr.map((x: any) => x.discovered_at).sort().at(-1) ?? null, reports: rp.length, score: rp.reduce((s: number, r: any) => s + (r.score ?? 0), 0) }
  })
  const anon = (prog.data ?? []).filter((x: any) => x.trainee_id === ZERO)
  if (anon.length) list.push({ id: ZERO, full_name: 'Unattributed (signed-out activity)', email: '', is_trainee: false, default_org_id: null, organization: '-', discovered: anon.length, last_activity: anon.map((x: any) => x.discovered_at).sort().at(-1), reports: 0, score: 0 })
  return list
})

route('GET', '/instructor/scenarios', async c => {
  instructor(c)
  const [s, p] = await Promise.all([db().from('training_scenarios').select('*').order('id'), db().from('training_progress').select('scenario_id,trainee_id,hits,discovered_at')])
  return (s.data ?? []).map((x: any) => {
    const hits = (p.data ?? []).filter((r: any) => r.scenario_id === x.id)
    return { ...x, discovered: hits.length > 0, discovered_by: hits.map((h: any) => h.trainee_id), first_seen: hits.map((h: any) => h.discovered_at).sort()[0] ?? null }
  })
})

route('POST', '/instructor/progress', async c => {
  instructor(c)
  const { trainee_id, scenario_id, discovered } = c.body ?? {}
  need(isUuid(trainee_id) && scenario_id, 400, 'trainee_id and scenario_id are required')
  if (discovered === false) await db().from('training_progress').delete().eq('trainee_id', trainee_id).eq('scenario_id', scenario_id)
  else await db().from('training_progress').upsert({ trainee_id, scenario_id, discovered: true }, { onConflict: 'trainee_id,scenario_id' })
  return { ok: true }
})

route('GET', '/instructor/reports', async c => {
  instructor(c)
  const reps = must(await db().from('security_reports').select('*').order('created_at', { ascending: false })) as any[]
  const ids = [...new Set(reps.map(r => r.trainee_id))]
  const { data: ps } = await db().from('profiles').select('id,full_name,email').in('id', ids.length ? ids : [ZERO])
  const names = new Map((ps ?? []).map((p: any) => [p.id, p]))
  const { data: cm } = await db().from('report_comments').select('*').in('report_id', reps.length ? reps.map(r => r.id) : [ZERO]).order('created_at')
  return reps.map(r => ({ ...r, trainee: names.get(r.trainee_id) ?? null, comments: (cm ?? []).filter((x: any) => x.report_id === r.id) }))
})
route('PATCH', '/instructor/reports/:id', async c => {
  instructor(c)
  need(isUuid(c.params.id), 404, 'Not found')
  const patch = pick(c.body, ['status', 'score', 'scenario_id'])
  if (patch.status) need(REPORT_STATUSES.includes(patch.status), 400, 'Invalid status')
  if (patch.score !== undefined) { patch.score = Number(patch.score); need(Number.isFinite(patch.score) && patch.score >= 0 && patch.score <= 100, 400, 'Score must be 0-100') }
  return must(await db().from('security_reports').update(patch).eq('id', c.params.id).select().single())
})
route('POST', '/instructor/reports/:id/comments', async c => {
  instructor(c)
  need(c.body?.body, 400, 'Comment is required')
  return must(await db().from('report_comments').insert({ report_id: c.params.id, author_id: c.userId, body: String(c.body.body).slice(0, 4000) }).select().single())
})

route('GET', '/instructor/notes', async c => { instructor(c); return must(await db().from('instructor_notes').select('*').order('created_at', { ascending: false })) })
route('POST', '/instructor/notes', async c => {
  instructor(c)
  need(c.body?.body, 400, 'Note is required')
  return must(await db().from('instructor_notes').insert({ author_id: c.userId, body: c.body.body, trainee_id: c.body.trainee_id || null, scenario_id: c.body.scenario_id || null }).select().single())
})

// the simulated mail outbox: reset codes issued by the sign-in flow
route('GET', '/instructor/outbox', async c => {
  instructor(c)
  return must(await db().from('password_resets').select('id,email,code,used,expires_at,created_at,attempts').order('created_at', { ascending: false }).limit(50))
})

route('POST', '/instructor/reset', async c => {
  instructor(c)
  need(c.body?.confirm === 'RESET', 400, 'Type RESET to confirm')
  await purgeStorage()
  const r = await db().rpc('training_reset')
  if (r.error) throw new HttpError(500, 'Reset failed: ' + r.error.message)
  const uploaded = await seedStorage()
  return { ok: true, files_restored: uploaded, at: new Date().toISOString() }
})

route('POST', '/instructor/seed-storage', async c => { instructor(c); return { ok: true, files: await seedStorage() } })
