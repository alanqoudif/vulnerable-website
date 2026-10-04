import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHmac, randomBytes, createHash } from 'node:crypto'

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message) }
}

let client: SupabaseClient | null = null
export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new HttpError(500, 'Service is not configured')
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return client
}

export interface Ctx {
  req: Request
  url: URL
  path: string
  params: Record<string, string>
  query: Record<string, string>
  body: any
  ip: string
  userId: string
  profile: any
  orgId: string | null
  role: string | null // membership role in active org (platform admin => organization_admin)
  platformAdmin: boolean
  token: string
  memberships: { org_id: string; role: string }[]
}

export type Handler = (c: Ctx) => Promise<unknown>
export interface Route { method: string; re: RegExp; keys: string[]; handler: Handler; auth: boolean }

export const routes: Route[] = []
export function route(method: string, path: string, handler: Handler, opts: { auth?: boolean } = {}) {
  const keys: string[] = []
  const re = new RegExp('^' + path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '/?$')
  routes.push({ method, re, keys, handler, auth: opts.auth !== false })
}

export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

export const isManager = (c: Ctx) => c.role === 'manager' || c.role === 'organization_admin'
export const isAdmin = (c: Ctx) => c.role === 'organization_admin'

export function need(cond: unknown, status: number, msg: string): asserts cond {
  if (!cond) throw new HttpError(status, msg)
}

export function pick(obj: any, keys: string[]) {
  const out: any = {}
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k]
  return out
}

export function must<T>(res: { data: T | null; error: any }, status = 500): T {
  if (res.error) throw new HttpError(status, res.error.message)
  return res.data as T
}

export function orgOnly(c: Ctx): string {
  if (!c.orgId) throw new HttpError(403, 'No active organization')
  return c.orgId
}

/** Records that a trainee exercised a controlled behaviour (instructor-visible only). */
export async function hit(c: Ctx, scenario: string) {
  try {
    if (c.profile?.is_instructor) return
    const { data } = await db().from('training_progress').select('id,hits').eq('trainee_id', c.userId).eq('scenario_id', scenario).maybeSingle()
    if (data) await db().from('training_progress').update({ hits: data.hits + 1 }).eq('id', data.id)
    else await db().from('training_progress').insert({ trainee_id: c.userId, scenario_id: scenario })
  } catch { /* progress tracking must never break a request */ }
}

export async function audit(c: Ctx, action: string, entityType: string, entityId: string, metadata: any = {}) {
  await db().from('audit_logs').insert({ org_id: c.orgId, actor_id: c.userId, action, entity_type: entityType, entity_id: entityId, metadata, ip: c.ip })
}

export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Date.now()
  const { data } = await db().from('rate_limits').select('*').eq('key', key).maybeSingle()
  if (!data || now - new Date(data.window_start).getTime() > windowSec * 1000) {
    await db().from('rate_limits').upsert({ key, window_start: new Date(now).toISOString(), count: 1 })
    return true
  }
  if (data.count >= max) return false
  await db().from('rate_limits').update({ count: data.count + 1 }).eq('key', key)
  return true
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const randomToken = (prefix: string, bytes = 12) => prefix + randomBytes(bytes).toString('hex')
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ---- workspace context token (application-level claims) ----
const CTX_SECRET = process.env.CONTEXT_SIGNING_SECRET || 'TRAINING_SECRET_demo_12345'
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
export function signContext(claims: Record<string, unknown>) {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64(claims)
  const sig = createHmac('sha256', CTX_SECRET).update(head + '.' + body).digest('base64url')
  return `${head}.${body}.${sig}`
}
export function readContext(token: string | null): { claims: any; unsigned: boolean } | null {
  if (!token) return null
  try {
    const [h, p, s] = token.split('.')
    const head = JSON.parse(Buffer.from(h, 'base64url').toString())
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString())
    if (String(head.alg).toLowerCase() === 'none') return { claims, unsigned: true }
    const expect = createHmac('sha256', CTX_SECRET).update(h + '.' + p).digest('base64url')
    if (s !== expect) return null
    return { claims, unsigned: false }
  } catch { return null }
}

export function clientIp(req: Request) {
  return req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '0.0.0.0'
}

/** Deterministic id used by the seed data (md5 of a namespaced key formatted as uuid). */
export function tid(k: string) {
  const h = createHash('md5').update('nuqta-training:' + k).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
