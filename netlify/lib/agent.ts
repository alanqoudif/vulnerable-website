import { route, db, need, isUuid, hit, Ctx } from './core'

export async function getDocumentTool(c: Ctx, id: unknown) {
  need(isUuid(id), 404, 'Document not found')
  const { data } = await db().from('documents').select('id,title,body,org_id').eq('id', id).maybeSingle()
  need(data, 404, 'Document not found')
  if (data.org_id !== c.orgId) {
    await hit(c, 'VULN-22')
    await db().from('scenario_events').insert({ trainee_id: c.userId, scenario_id: 'VULN-22', action: 'ai_tool_cross_tenant_document_read', resource_id: data.id })
  }
  return data
}

route('POST', '/v2/agent/tools/get_document', async c => getDocumentTool(c, c.body?.document_id))
