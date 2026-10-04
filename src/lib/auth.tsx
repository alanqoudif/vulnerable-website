import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { api, store, resetContext } from './api'

export interface Me {
  user: { id: string; email: string; full_name: string; title?: string; phone?: string; avatar_path?: string }
  orgs: { id: string; name: string; slug: string; role: string; plan: string }[]
  activeOrgId: string | null
  role: string | null
  isInstructor: boolean
  isPlatformAdmin: boolean
}

interface AuthState {
  session: Session | null
  me: Me | null
  ready: boolean
  isManager: boolean
  isAdmin: boolean
  activeOrg: Me['orgs'][number] | null
  switchOrg: (id: string) => Promise<void>
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}
const Ctx = createContext<AuthState>(null as any)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    try {
      const m = await api<Me>('/v2/me', { org: store.orgId })
      setMe(m)
      if (!m.activeOrgId) store.orgId = null
      else if (store.orgId !== m.activeOrgId) store.orgId = m.activeOrgId
    } catch {
      // stale org selection: retry with the default workspace
      store.orgId = null
      try { setMe(await api<Me>('/v2/me', { org: null })) } catch { setMe(null) }
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await load()
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s)
      if (evt === 'SIGNED_IN' && s) {
        void (async () => {
          resetContext()
          try {
            if (!sessionStorage.getItem('nq_sid')) {
              const r = await api<{ id: string }>('/v2/account/sessions/register', { method: 'POST', body: {} })
              sessionStorage.setItem('nq_sid', r.id)
            }
          } catch { /* non-critical */ }
          await load()
        })()
      }
      if (evt === 'SIGNED_OUT') { setMe(null); resetContext(); sessionStorage.removeItem('nq_sid') }
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const activeOrg = me?.orgs.find(o => o.id === me.activeOrgId) ?? null
  const value: AuthState = {
    session, me, ready, activeOrg,
    isManager: me?.role === 'manager' || me?.role === 'organization_admin',
    isAdmin: me?.role === 'organization_admin',
    refresh: load,
    switchOrg: async id => { store.orgId = id; resetContext(); await load() },
    signOut: async () => { store.orgId = null; await supabase.auth.signOut() },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
