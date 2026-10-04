import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Avatar, Icon, cx } from '../lib/ui'
import { roleLabel } from '../lib/format'

interface Item { to: string; label: string; icon: string; show?: (a: ReturnType<typeof useAuth>) => boolean; end?: boolean }
const groups: { title?: string; items: Item[] }[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: 'home', end: true }] },
  { title: 'Workspace', items: [
    { to: '/projects', label: 'Projects', icon: 'folder' },
    { to: '/tasks', label: 'Tasks', icon: 'check' },
    { to: '/documents', label: 'Documents', icon: 'doc' },
    { to: '/customers', label: 'Customers', icon: 'users' },
    { to: '/team', label: 'Team', icon: 'user' },
    { to: '/messages', label: 'Messages', icon: 'mail' },
  ] },
  { title: 'Mibyan', items: [
    { to: '/mibyan/chat', label: 'AI Chat', icon: 'spark' },
    { to: '/mibyan/conversations', label: 'Conversations', icon: 'chat' },
    { to: '/mibyan/knowledge', label: 'Knowledge', icon: 'book' },
    { to: '/mibyan/models', label: 'Models', icon: 'cube' },
    { to: '/developer', label: 'API Platform', icon: 'code', end: true },
    { to: '/developer/api-keys', label: 'API Keys', icon: 'key' },
    { to: '/developer/usage', label: 'Usage', icon: 'chart' },
  ] },
  { title: 'Finance', items: [
    { to: '/finance/invoices', label: 'Invoices', icon: 'invoice' },
    { to: '/finance/plans', label: 'Plans', icon: 'card' },
  ] },
  { title: 'Organization', items: [
    { to: '/org/members', label: 'Members', icon: 'building', show: a => a.isManager },
    { to: '/org/invitations', label: 'Invitations', icon: 'mail', show: a => a.isManager },
    { to: '/org/settings', label: 'Settings', icon: 'gear' },
    { to: '/org/audit', label: 'Audit Log', icon: 'list', show: a => a.isManager },
  ] },
  { title: 'Account', items: [
    { to: '/account/profile', label: 'Profile', icon: 'user' },
    { to: '/account/security', label: 'Security', icon: 'shield' },
    { to: '/account/sessions', label: 'Sessions', icon: 'device' },
    { to: '/account/report', label: 'Report an issue', icon: 'flag' },
  ] },
]

export default function AppShell() {
  const auth = useAuth()
  const { me, activeOrg, switchOrg, signOut } = auth
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => setOpen(false), [loc.pathname])

  const sidebar = (
    <nav className="flex h-full flex-col overflow-y-auto px-3 pb-4">
      <Link to="/" className="flex items-center gap-2.5 px-2 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><span className="h-3 w-3 rounded-full bg-white" /></span>
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">Nuqta Workspace</span>
      </Link>
      {groups.map((g, i) => {
        const items = g.items.filter(it => !it.show || it.show(auth))
        if (!items.length) return null
        return (
          <div key={i} className="mb-3">
            {g.title && <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</p>}
            {items.map(it => (
              <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100')}>
                <Icon name={it.icon} className="h-[18px] w-[18px]" />{it.label}
              </NavLink>
            ))}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
          <button className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <form className="relative hidden max-w-sm flex-1 sm:block" onSubmit={e => { e.preventDefault(); if (q.trim()) nav('/search?q=' + encodeURIComponent(q)) }}>
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects, documents, customers" className="pl-9" />
          </form>
          <div className="ml-auto flex items-center gap-3">
            {me && me.orgs.length > 1 ? (
              <select aria-label="Organization" value={me.activeOrgId ?? ''} onChange={e => void switchOrg(e.target.value).then(() => nav('/'))} className="!w-auto max-w-[11rem] !py-1.5 text-xs font-medium">
                {me.orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ) : <span className="hidden text-xs font-medium text-slate-500 sm:block">{activeOrg?.name}</span>}
            <div className="flex items-center gap-2">
              <Avatar name={me?.user.full_name} />
              <div className="hidden text-left leading-tight md:block">
                <p className="text-xs font-semibold text-slate-800">{me?.user.full_name}</p>
                <p className="text-[11px] text-slate-500">{me?.isPlatformAdmin ? 'Platform administrator' : roleLabel(me?.role)}</p>
              </div>
            </div>
            <button onClick={() => void signOut()} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Sign out" title="Sign out"><Icon name="logout" className="h-[18px] w-[18px]" /></button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <Outlet key={me?.activeOrgId ?? 'none'} />
          </div>
        </main>
      </div>
    </div>
  )
}
