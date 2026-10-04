import { routes, db, HttpError, Ctx, clientIp } from '../lib/core'
import '../lib/workspace'
import '../lib/content'
import '../lib/platform'
import '../lib/legacy'
import '../lib/training'

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url)
  let path = url.pathname.replace(/^.*?\/api(?=\/|$)/, '') || '/'
  if (path.length > 1) path = path.replace(/\/+$/, '')
  const origin = req.headers.get('origin')
  const isWidget = path === '/v2/widget/me'

  // Cross-origin policy: same-origin only, except the embeddable widget endpoint.
  const cors: Record<string, string> = {}
  if (isWidget && origin) {
    cors['access-control-allow-origin'] = origin
    cors['access-control-allow-credentials'] = 'true'
    cors['access-control-allow-headers'] = 'authorization, content-type, x-org-id'
    cors['vary'] = 'Origin'
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  try {
    const method = req.method
    let matched: { r: (typeof routes)[number]; params: Record<string, string> } | null = null
    let pathExists = false
    for (const r of routes) {
      const m = r.re.exec(path)
      if (!m) continue
      pathExists = true
      if (r.method !== method) continue
      const params: Record<string, string> = {}
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
      matched = { r, params }
      break
    }
    if (!matched) return json({ error: pathExists ? 'Method not allowed' : 'Not found' }, pathExists ? 405 : 404, cors)

    let body: any = undefined
    if (!['GET', 'HEAD'].includes(method)) {
      const text = await req.text()
      if (text) { try { body = JSON.parse(text) } catch { throw new HttpError(400, 'Invalid JSON body') } }
    }
    const query = Object.fromEntries(url.searchParams.entries())
    const ctx: Ctx = {
      req, url, path, params: matched.params, query, body, ip: clientIp(req), userId: '00000000-0000-0000-0000-000000000000',
      profile: null, orgId: null, role: null, platformAdmin: false, token: '', memberships: [],
    }

    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')
    if (matched.r.auth) {
      if (!bearer) throw new HttpError(401, 'Authentication required')
      const { data, error } = await db().auth.getUser(bearer[1])
      if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.')
      const { data: profile } = await db().from('profiles').select('*').eq('id', data.user.id).maybeSingle()
      if (!profile || profile.status !== 'active') throw new HttpError(403, 'Account is not active')
      const { data: mem } = await db().from('organization_members').select('org_id,role').eq('user_id', profile.id).eq('status', 'active')
      ctx.userId = profile.id; ctx.profile = profile; ctx.token = bearer[1]
      ctx.platformAdmin = profile.platform_role === 'platform_admin'
      ctx.memberships = mem ?? []
      const wanted = req.headers.get('x-org-id') || profile.default_org_id || ctx.memberships[0]?.org_id || null
      if (wanted && !path.startsWith('/instructor')) {
        const m = ctx.memberships.find(x => x.org_id === wanted)
        if (m) { ctx.orgId = wanted; ctx.role = m.role }
        else if (ctx.platformAdmin) { ctx.orgId = wanted; ctx.role = 'organization_admin' }
        else if (req.headers.get('x-org-id')) throw new HttpError(403, 'You are not a member of this organization')
        else if (ctx.memberships[0]) { ctx.orgId = ctx.memberships[0].org_id; ctx.role = ctx.memberships[0].role }
      }
    }
    const result = await matched.r.handler(ctx)
    return json(result ?? { ok: true }, 200, cors)
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.extra ?? {}) }, e.status, cors)
    console.error('api error', e?.message)
    return json({ error: 'Something went wrong. Please try again.' }, 500, cors)
  }
}

export default async (req: Request) => handle(req)
export const config = { path: '/api/*' }
