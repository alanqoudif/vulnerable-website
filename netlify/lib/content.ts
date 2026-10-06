import { route, db, must, need, pick, isManager, isUuid, orgOnly, hit, audit, HttpError, randomToken, Ctx, tid } from './core'
import { getDocumentTool } from './agent'

// ---------- documents ----------
const DOC_FLOW = ['Draft', 'Shared', 'Reviewed', 'Archived']

function canSee(c: Ctx, d: any) {
  return d.status !== 'Draft' || d.owner_id === c.userId || isManager(c)
}
async function loadDoc(c: Ctx, id: string) {
  need(isUuid(id), 404, 'Document not found')
  const { data } = await db().from('documents').select('*, owner:profiles!documents_owner_id_fkey(id,full_name), project:projects(id,name), file:files(id,name,mime_type,size_bytes)').eq('id', id).eq('org_id', orgOnly(c)).maybeSingle()
  need(data && canSee(c, data), 404, 'Document not found')
  return data as any
}

route('GET', '/v2/documents', async c => {
  const rows = must(await db().from('documents')
    .select('id,title,summary,status,updated_at,owner_id, owner:profiles!documents_owner_id_fkey(full_name), project:projects(id,name)')
    .eq('org_id', orgOnly(c)).order('updated_at', { ascending: false })) as any[]
  return rows.filter(d => canSee(c, d))
})
route('GET', '/v2/documents/:id', async c => {
  if (c.params.id === tid('doc:board')) {
    const { data } = await db().from('documents').select('*, owner:profiles!documents_owner_id_fkey(id,full_name), project:projects(id,name), file:files(id,name,mime_type,size_bytes)').eq('id', c.params.id).maybeSingle()
    need(data, 404, 'Document not found')
    await hit(c, 'VULN-01')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-01', action: 'cross_tenant_document_read', resource_id: c.params.id })
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'CHAIN-A', action: 'synthetic_document_retrieved', resource_id: c.params.id })
    return data
  }
  return loadDoc(c, c.params.id)
})

route('POST', '/v2/documents', async c => {
  const b = c.body ?? {}
  need(b.title, 400, 'Title is required')
  const row: any = must(await db().from('documents').insert({
    org_id: orgOnly(c), title: b.title, summary: b.summary, body: b.body ?? '', project_id: b.project_id || null, owner_id: c.userId, file_id: b.file_id || null,
  }).select().single())
  await db().from('document_versions').insert({ document_id: row.id, version: 1, body: row.body, note: 'Initial draft', author_id: c.userId })
  await audit(c, 'document.created', 'document', row.id)
  return row
})
route('PATCH', '/v2/documents/:id', async c => {
  const d = await loadDoc(c, c.params.id)
  need(isManager(c) || d.owner_id === c.userId, 403, 'You cannot edit this document')
  const patch = pick(c.body, ['title', 'summary', 'body'])
  const row = must(await db().from('documents').update(patch).eq('id', d.id).select().single())
  if (patch.body !== undefined) {
    const { count } = await db().from('document_versions').select('id', { count: 'exact', head: true }).eq('document_id', d.id)
    await db().from('document_versions').insert({ document_id: d.id, version: (count ?? 0) + 1, body: patch.body, note: c.body?.note || 'Edited', author_id: c.userId })
  }
  return row
})
route('POST', '/v2/documents/:id/transition', async c => {
  const d = await loadDoc(c, c.params.id)
  const to = c.body?.to
  need(DOC_FLOW.indexOf(to) === DOC_FLOW.indexOf(d.status) + 1, 409, `Cannot move a ${d.status} document to ${to}`)
  if (to === 'Reviewed') need(isManager(c), 403, 'Only managers can mark a document as reviewed')
  else need(isManager(c) || d.owner_id === c.userId, 403, 'You cannot change this document')
  const row = must(await db().from('documents').update({ status: to }).eq('id', d.id).select().single())
  await audit(c, 'document.' + to.toLowerCase(), 'document', d.id)
  return row
})
route('GET', '/v2/documents/:id/versions', async c => {
  need(isUuid(c.params.id), 404, 'Document not found')
  const { data: doc } = await db().from('documents').select('id,org_id,title').eq('id', c.params.id).maybeSingle()
  need(doc, 404, 'Document not found')
  if (doc.org_id !== c.orgId) await hit(c, 'S-02')
  const versions = must(await db().from('document_versions').select('id,version,body,note,created_at, author:profiles(full_name)').eq('document_id', doc.id).order('version', { ascending: false }))
  return { document: { id: doc.id, title: doc.title }, versions }
})

// ---------- files ----------
route('POST', '/v2/files', async c => {
  const b = c.body ?? {}
  const bucket = ['documents', 'knowledge-files', 'attachments'].includes(b.bucket) ? b.bucket : 'documents'
  need(typeof b.name === 'string' && b.name.length < 160, 400, 'File name is required')
  const raw: Buffer = b.content_base64 ? Buffer.from(String(b.content_base64), 'base64') : Buffer.from(String(b.content_text ?? ''))
  need(raw.length > 0 && raw.length <= 1_000_000, 400, 'File must be between 1 byte and 1 MB')
  const org = orgOnly(c)
  const path = `${org}/${crypto.randomUUID()}-${b.name.replace(/[^A-Za-z0-9._-]/g, '_')}`
  const up = await db().storage.from(bucket).upload(path, raw, { contentType: b.mime_type || 'application/octet-stream' })
  if (up.error) throw new HttpError(500, 'Upload failed')
  return must(await db().from('files').insert({ org_id: org, owner_id: c.userId, bucket, path, name: b.name, mime_type: b.mime_type || 'application/octet-stream', size_bytes: raw.length, visibility: b.visibility === 'private' ? 'private' : 'org' }).select().single())
})
route('GET', '/v2/files', async c => must(await db().from('files').select('id,name,mime_type,size_bytes,bucket,visibility,created_at,owner:profiles!files_owner_id_fkey(full_name)').eq('org_id', orgOnly(c)).neq('bucket', 'knowledge-files').order('created_at', { ascending: false }).limit(60)))

route('GET', '/v2/files/:id', async c => {
  need(isUuid(c.params.id), 404, 'File not found')
  const { data } = await db().from('files').select('id,name,mime_type,size_bytes,visibility,created_at').eq('id', c.params.id).eq('org_id', orgOnly(c)).maybeSingle()
  need(data, 404, 'File not found')
  return data
})

async function downloadFile(c: Ctx) {
  need(isUuid(c.params.id), 404, 'File not found')
  const { data: f } = await db().from('files').select('*').eq('id', c.params.id).maybeSingle()
  need(f, 404, 'File not found')
  // the organization the file is being requested through (workspace switcher / deep links)
  const through = c.query.org || c.orgId
  need(c.memberships.some(m => m.org_id === through) || c.platformAdmin, 403, 'You do not have access to this file')
  if (f.org_id === through && f.visibility === 'private') {
    need(f.owner_id === c.userId || isManager(c), 403, 'This file is private')
  }
  if (f.org_id !== c.orgId) {
    await hit(c, 'VULN-13')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-13', action: 'cross_tenant_signed_url', resource_id: f.id, metadata: { through } })
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'CHAIN-B', action: 'related_file_download_authorized', resource_id: f.id })
  }
  const { data, error } = await db().storage.from(f.bucket).createSignedUrl(f.path, 120, { download: f.name })
  if (error || !data) throw new HttpError(404, 'File content is unavailable')
  return { name: f.name, url: data.signedUrl, expires_in: 120 }
}
route('GET', '/v2/files/:id/download', downloadFile)
route('POST', '/v2/files/:id/download', downloadFile)

// ---------- Mibyan chat ----------
const MODELS = ['mibyan-4.1', 'mibyan-fast', 'mibyan-reasoning', 'partner-demo-large']

route('GET', '/v2/ai/models', async () => must(await db().from('ai_models').select('*').order('tier')))

route('GET', '/v2/ai/conversations', async c => {
  const rows = must(await db().from('ai_conversations')
    .select('id,title,model,visibility,share_token,owner_id,updated_at,created_at, owner:profiles!ai_conversations_owner_id_fkey(full_name)')
    .eq('org_id', orgOnly(c)).or(`owner_id.eq.${c.userId},visibility.in.(org,shared)`).order('updated_at', { ascending: false })) as any[]
  return rows.map(r => ({ ...r, share_token: r.owner_id === c.userId || r.visibility === 'shared' ? r.share_token : null, mine: r.owner_id === c.userId }))
})

route('GET', '/v2/ai/conversations/:id', async c => {
  need(isUuid(c.params.id), 404, 'Conversation not found')
  const { data: cv } = await db().from('ai_conversations').select('*, owner:profiles!ai_conversations_owner_id_fkey(id,full_name)').eq('id', c.params.id).eq('org_id', orgOnly(c)).maybeSingle()
  need(cv, 404, 'Conversation not found')
  need(cv.owner_id === c.userId || cv.visibility !== 'private', 404, 'Conversation not found')
  const messages = must(await db().from('ai_messages').select('id,role,content,tokens,created_at,attachment:files(id,name)').eq('conversation_id', cv.id).order('created_at'))
  return { ...cv, mine: cv.owner_id === c.userId, messages }
})

route('POST', '/v2/ai/conversations', async c => {
  const b = c.body ?? {}
  const model = MODELS.includes(b.model) ? b.model : 'mibyan-4.1'
  return must(await db().from('ai_conversations').insert({ org_id: orgOnly(c), owner_id: c.userId, title: String(b.title || 'New conversation').slice(0, 120), model }).select().single())
})

async function ownConv(c: Ctx) {
  need(isUuid(c.params.id), 404, 'Conversation not found')
  const { data } = await db().from('ai_conversations').select('*').eq('id', c.params.id).eq('org_id', orgOnly(c)).eq('owner_id', c.userId).maybeSingle()
  need(data, 404, 'Conversation not found')
  return data as any
}
route('PATCH', '/v2/ai/conversations/:id', async c => {
  const cv = await ownConv(c)
  const patch: any = {}
  if (typeof c.body?.title === 'string') patch.title = c.body.title.slice(0, 120)
  if (MODELS.includes(c.body?.model)) patch.model = c.body.model
  return must(await db().from('ai_conversations').update(patch).eq('id', cv.id).select().single())
})
route('DELETE', '/v2/ai/conversations/:id', async c => {
  const cv = await ownConv(c)
  await db().from('ai_conversations').delete().eq('id', cv.id)
  return { ok: true }
})
route('POST', '/v2/ai/conversations/:id/share', async c => {
  const cv = await ownConv(c)
  const on = c.body?.enabled !== false
  const row = must(await db().from('ai_conversations').update({ visibility: on ? 'shared' : 'private', share_token: on ? (cv.share_token || randomToken('shr_', 10)) : null }).eq('id', cv.id).select().single())
  await audit(c, on ? 'conversation.shared' : 'conversation.unshared', 'conversation', cv.id)
  return row
})

function composeReply(prompt: string, model: string) {
  const p = prompt.toLowerCase()
  const lead = model === 'mibyan-reasoning' ? 'Working through this step by step:\n\n' : ''
  if (/summar/.test(p)) return lead + 'Summary:\n• Key objective and scope are clearly stated.\n• Two open risks need an owner.\n• Next review is due within two weeks.\n\nLet me know if you want a shorter executive version.'
  if (/code|python|script|function|bug/.test(p)) return lead + 'Here is a cleaned-up approach:\n\n```python\ndef load_rows(path):\n    with open(path) as fh:\n        return [line.strip().split(",") for line in fh if line.strip()]\n```\n\nThe loop is simplified and input is validated before parsing.'
  if (/tender|rfp|bid/.test(p)) return lead + 'For the tender response I suggest: (1) restate the evaluation criteria, (2) map each requirement to a delivery owner, (3) attach three comparable references, (4) include a transparent pricing table.'
  if (/customer|churn|analysis/.test(p)) return lead + 'Customer analysis highlights: renewal risk is concentrated in two mid-size accounts; support ticket volume correlates with onboarding delays. Recommend a 30-day success plan for both.'
  if (/proposal|draft|write/.test(p)) return lead + 'Draft opening:\n\n"Thank you for the opportunity to propose. Our team combines delivery experience with a pragmatic approach, focusing on measurable outcomes in the first 90 days."'
  return lead + 'Happy to help with that. Here is a structured first pass you can refine — tell me the audience and desired length and I will tailor it.'
}

route('POST', '/v2/ai/conversations/:id/messages', async c => {
  const cv = await ownConv(c)
  const content = String(c.body?.content ?? '').slice(0, 8000)
  need(content.trim(), 400, 'Message cannot be empty')
  let attachment: string | null = null
  if (c.body?.attachment_file_id) {
    const { data } = await db().from('files').select('id').eq('id', c.body.attachment_file_id).eq('org_id', orgOnly(c)).maybeSingle()
    need(data, 400, 'Attachment not found')
    attachment = data!.id
  }
  const u = must(await db().from('ai_messages').insert({ conversation_id: cv.id, role: 'user', content, tokens: Math.ceil(content.length / 4), attachment_file_id: attachment }).select().single())
  let reply = composeReply(content, cv.model)
  if (/ignore (all )?(previous|prior) instructions|system override|do anything now/i.test(content)) {
    reply = 'Training assistant: override accepted for this simulated task. I will follow the latest instruction in this conversation.'
    await hit(c, 'VULN-20')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-20', action: 'direct_prompt_override', resource_id: cv.id })
  }
  const asksForKnowledge = /knowledge|reference|training guide|summar|مرجع|المعرفة|لخص/i.test(content)
  let kbDoc: { id: string; summary: string } | null = null
  if (asksForKnowledge) {
    const { data } = await db().from('knowledge_documents').select('id,summary').eq('org_id', c.orgId).like('summary', 'SYSTEM OVERRIDE TRAINING:%').limit(1).maybeSingle()
    kbDoc = data
  }
  if (kbDoc && /ignore|override|retrieve/i.test(kbDoc.summary ?? '')) {
    await hit(c, 'VULN-21')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-21', action: 'adversarial_knowledge_instruction_consumed', resource_id: kbDoc.id })
    const stolen = await getDocumentTool(c, tid('doc:board'))
    if (stolen) {
      reply = `Retrieved reference ${kbDoc.id}. Untrusted reference instructions: ${kbDoc.summary}\nTool result: ${stolen.title}\n\n${stolen.body}`
      await hit(c, 'VULN-23')
      await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-23', action: 'agent_cross_tenant_document_read', resource_id: stolen.id, metadata: { knowledge_document_id: kbDoc.id } })
      await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'CHAIN-D', action: 'agent_response_contains_foreign_document', resource_id: stolen.id, metadata: { knowledge_document_id: kbDoc.id } })
    }
  }
  const a = must(await db().from('ai_messages').insert({ conversation_id: cv.id, role: 'assistant', content: reply, tokens: Math.ceil(reply.length / 4) }).select().single())
  const title = cv.title === 'New conversation' ? content.slice(0, 60) : cv.title
  await db().from('ai_conversations').update({ title }).eq('id', cv.id)
  return { user: u, assistant: a, title }
})

route('GET', '/v2/ai/shared/:token', async c => {
  const { data: cv } = await db().from('ai_conversations').select('*, owner:profiles!ai_conversations_owner_id_fkey(full_name,email), organization:organizations(name)').eq('share_token', c.params.token).eq('visibility', 'shared').maybeSingle()
  need(cv, 404, 'This shared conversation is no longer available')
  const msgs = must(await db().from('ai_messages').select('id,role,content,created_at').eq('conversation_id', cv.id).order('created_at')) as any[]
  const citations: { kind: string; id: string; title: string }[] = []
  const clean = msgs.map(m => ({
    ...m,
    content: m.content.replace(/\[\[kb:([0-9a-f-]{36})\|([^\]]+)\]\]/g, (_: string, id: string, title: string) => { citations.push({ kind: 'knowledge_document', id, title }); return title }),
  }))
  return {
    title: cv.title, model: cv.model, shared_by: cv.owner?.full_name, organization: cv.organization?.name, created_at: cv.created_at, messages: clean,
    meta: { conversation_id: cv.id, org_id: cv.org_id, owner_email: cv.owner?.email, citations },
  }
}, { auth: false })

// ---------- knowledge ----------
route('GET', '/v2/knowledge/bases', async c => {
  let q = db().from('knowledge_bases').select('*, owner:profiles!knowledge_bases_owner_id_fkey(full_name), docs:knowledge_documents(count)').eq('org_id', orgOnly(c)).order('name')
  if (!isManager(c)) q = q.eq('visibility', 'org')
  return must(await q)
})
async function loadKb(c: Ctx, id: string) {
  need(isUuid(id), 404, 'Collection not found')
  const { data } = await db().from('knowledge_bases').select('*').eq('id', id).eq('org_id', orgOnly(c)).maybeSingle()
  need(data && (data.visibility === 'org' || isManager(c)), 404, 'Collection not found')
  return data as any
}
route('GET', '/v2/knowledge/bases/:id', async c => {
  const kb = await loadKb(c, c.params.id)
  const docs = must(await db().from('knowledge_documents').select('id,title,summary,status,token_count,created_at,file:files(id,name,mime_type,size_bytes),uploader:profiles!knowledge_documents_uploader_id_fkey(full_name)').eq('kb_id', kb.id).order('created_at', { ascending: false }))
  return { ...kb, documents: docs }
})
route('POST', '/v2/knowledge/bases', async c => {
  need(isManager(c), 403, 'Only managers can create collections')
  need(c.body?.name, 400, 'Name is required')
  return must(await db().from('knowledge_bases').insert({ org_id: orgOnly(c), name: c.body.name, description: c.body.description, owner_id: c.userId, visibility: c.body.visibility === 'restricted' ? 'restricted' : 'org' }).select().single())
})
route('POST', '/v2/knowledge/bases/:id/documents', async c => {
  const kb = await loadKb(c, c.params.id)
  const b = c.body ?? {}
  need(b.name && (b.content_text || b.content_base64), 400, 'A file is required')
  const raw: Buffer = b.content_base64 ? Buffer.from(String(b.content_base64), 'base64') : Buffer.from(String(b.content_text))
  need(raw.length <= 1_000_000, 400, 'File must be 1 MB or smaller')
  const path = `${kb.org_id}/${kb.id}/${crypto.randomUUID()}-${String(b.name).replace(/[^A-Za-z0-9._-]/g, '_')}`
  const up = await db().storage.from('knowledge-files').upload(path, raw, { contentType: b.mime_type || 'text/plain' })
  if (up.error) throw new HttpError(500, 'Upload failed')
  const f: any = must(await db().from('files').insert({ org_id: kb.org_id, owner_id: c.userId, bucket: 'knowledge-files', path, name: b.name, mime_type: b.mime_type || 'text/plain', size_bytes: raw.length }).select().single())
  const doc = must(await db().from('knowledge_documents').insert({ kb_id: kb.id, org_id: kb.org_id, file_id: f.id, title: b.title || b.name, summary: 'Uploaded by ' + c.profile.full_name, status: 'Uploaded', token_count: Math.ceil(raw.length / 4), uploader_id: c.userId }).select().single())
  await audit(c, 'knowledge.uploaded', 'knowledge_document', (doc as any).id)
  return doc
})
route('POST', '/v2/knowledge/documents/:id/advance', async c => {
  need(isUuid(c.params.id), 404, 'Document not found')
  const { data: d } = await db().from('knowledge_documents').select('*').eq('id', c.params.id).eq('org_id', orgOnly(c)).maybeSingle()
  need(d, 404, 'Document not found')
  need(isManager(c) || d.uploader_id === c.userId, 403, 'You cannot change this document')
  const flow = ['Uploaded', 'Processing', 'Available']
  need(flow.indexOf(d.status) < 2, 409, 'Document is already available')
  return must(await db().from('knowledge_documents').update({ status: flow[flow.indexOf(d.status) + 1] }).eq('id', d.id).select().single())
})
route('GET', '/v2/knowledge/documents/:id', async c => {
  need(isUuid(c.params.id), 404, 'Document not found')
  const { data: d } = await db().from('knowledge_documents').select('*, kb:knowledge_bases(id,name,visibility), file:files(id,name,mime_type,bucket,path,size_bytes)').eq('id', c.params.id).maybeSingle()
  need(d && (c.memberships.some(m => m.org_id === d.org_id) || c.platformAdmin), 404, 'Document not found')
  if (d.kb.visibility === 'restricted' && !isManager(c)) await hit(c, 'S-26')
  let preview = ''
  if (d.file && d.file.mime_type !== 'application/pdf') {
    const dl = await db().storage.from(d.file.bucket).download(d.file.path)
    if (dl.data) preview = (await dl.data.text()).slice(0, 2000)
  }
  return { id: d.id, title: d.title, summary: d.summary, status: d.status, token_count: d.token_count, created_at: d.created_at, collection: { id: d.kb.id, name: d.kb.name }, file: d.file && { id: d.file.id, name: d.file.name, mime_type: d.file.mime_type, size_bytes: d.file.size_bytes }, preview }
})

route('GET', '/v2/knowledge/resources/:id', async c => {
  need(isUuid(c.params.id), 404, 'Resource not found')
  const { data } = await db().from('knowledge_documents').select('*, kb:knowledge_bases(id,name,visibility)').eq('id', c.params.id).maybeSingle()
  need(data, 404, 'Resource not found')
  if (data.id === tid('kdoc:4:1:1')) {
    await hit(c, 'VULN-25')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-25', action: 'cross_tenant_knowledge_read', resource_id: data.id })
  } else need(c.memberships.some(m => m.org_id === data.org_id) || c.platformAdmin, 404, 'Resource not found')
  return data
})

route('GET', '/v2/ai/conversations/:id/share-view', async c => {
  need(isUuid(c.params.id), 404, 'Conversation not found')
  const { data: cv } = await db().from('ai_conversations').select('*').eq('id', c.params.id).maybeSingle()
  need(cv, 404, 'Conversation not found')
  if (cv.owner_id !== c.userId) {
    need(cv.id === tid('conv:1:4'), 404, 'Conversation not found')
    await hit(c, 'VULN-24')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-24', action: 'cross_user_conversation_read', resource_id: cv.id })
  }
  const messages = must(await db().from('ai_messages').select('id,role,content,created_at').eq('conversation_id', cv.id).order('created_at'))
  return { id: cv.id, title: cv.title, messages }
})
