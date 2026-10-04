import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export const store = {
  get orgId() { try { return localStorage.getItem('nq_org') } catch { return null } },
  set orgId(v: string | null) { try { v ? localStorage.setItem('nq_org', v) : localStorage.removeItem('nq_org') } catch { /* ignore */ } },
}
let ctxToken: { org: string | null; token: string } | null = null

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; org?: string | null } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const org = opts.org ?? store.orgId
  if (org) headers['x-org-id'] = org
  if (token && path !== '/v2/auth/context' && path !== '/v2/me') {
    if (!ctxToken || ctxToken.org !== org) {
      try {
        const r = await fetch('/api/v2/auth/context', { headers })
        if (r.ok) ctxToken = { org, token: (await r.json()).token }
      } catch { /* optional */ }
    }
    if (ctxToken) headers['x-workspace-context'] = ctxToken.token
  }
  const res = await fetch('/api' + path, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-json */ }
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `Request failed (${res.status})`)
  return json as T
}

export function resetContext() { ctxToken = null }

export function useApi<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!path)
  const load = useCallback(async () => {
    if (!path) return
    setLoading(true); setError(null)
    try { setData(await api<T>(path)) } catch (e: any) { setError(e.message) } finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])
  useEffect(() => { void load() }, [load])
  return { data, error, loading, reload: load, setData }
}
