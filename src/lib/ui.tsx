import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { initials } from './format'

const ICONS: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  check: 'M5 13l4 4L19 7',
  doc: 'M7 3h7l5 5v13H7V3zM14 3v5h5M10 13h6M10 17h6',
  users: 'M16 11a4 4 0 10-8 0M4 20a8 8 0 0116 0M18 8a3 3 0 010 6',
  chat: 'M4 5h16v11H9l-5 4V5z',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z',
  book: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM5 17a3 3 0 013-3h11',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  code: 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14',
  key: 'M14 10a4 4 0 11-3.5 6L3 17v-3h3v-2h2l2.5-2.5A4 4 0 0114 10z',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  invoice: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
  card: 'M3 6h18v12H3zM3 10h18',
  building: 'M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14.2 3h-4.4l-.4 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2l.4 2.7h4.4l.4-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  device: 'M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2',
  menu: 'M4 6h16M4 12h16M4 18h16',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  logout: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  share: 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  send: 'M4 12l16-8-6 16-2-7-8-1z',
  clip: 'M20 11l-8.5 8.5a5 5 0 01-7-7L13 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L14 7',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
}

export function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name] ?? ICONS.doc} />
    </svg>
  )
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function Card({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const TONES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700', Active: 'bg-emerald-50 text-emerald-700', Review: 'bg-amber-50 text-amber-700', Approved: 'bg-sky-50 text-sky-700', Archived: 'bg-slate-100 text-slate-500',
  Shared: 'bg-indigo-50 text-indigo-700', Reviewed: 'bg-emerald-50 text-emerald-700', Sent: 'bg-sky-50 text-sky-700', Paid: 'bg-emerald-50 text-emerald-700',
  Created: 'bg-slate-100 text-slate-700', Revoked: 'bg-rose-50 text-rose-700', Uploaded: 'bg-slate-100 text-slate-700', Processing: 'bg-amber-50 text-amber-700', Available: 'bg-emerald-50 text-emerald-700',
  Accepted: 'bg-sky-50 text-sky-700', 'Member Created': 'bg-emerald-50 text-emerald-700',
  todo: 'bg-slate-100 text-slate-700', in_progress: 'bg-amber-50 text-amber-700', done: 'bg-emerald-50 text-emerald-700',
  high: 'bg-rose-50 text-rose-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-50 text-emerald-700', prospect: 'bg-amber-50 text-amber-700', available: 'bg-emerald-50 text-emerald-700', preview: 'bg-violet-50 text-violet-700',
  Submitted: 'bg-slate-100 text-slate-700', 'Under Review': 'bg-amber-50 text-amber-700', Valid: 'bg-emerald-50 text-emerald-700', Duplicate: 'bg-slate-100 text-slate-500', Informational: 'bg-sky-50 text-sky-700',
  'Needs More Evidence': 'bg-orange-50 text-orange-700', Resolved: 'bg-emerald-50 text-emerald-700', Retested: 'bg-indigo-50 text-indigo-700',
  Critical: 'bg-rose-50 text-rose-700', High: 'bg-orange-50 text-orange-700', Medium: 'bg-amber-50 text-amber-700', Low: 'bg-slate-100 text-slate-600',
}
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const key = tone ?? String(children)
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[key] ?? 'bg-slate-100 text-slate-700')}>{typeof children === 'string' ? children.replace('_', ' ') : children}</span>
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; small?: boolean }
export function Button({ variant = 'primary', small, className = '', ...p }: BtnProps) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant]
  return <button {...p} className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50', small ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm', v, className)} />
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div><label>{label}</label>{children}{hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}</div>
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <svg className={cx('animate-spin text-brand-600', className)} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" /><path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"><Spinner />{label}</div>
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-rose-100 bg-rose-50/60 p-6 text-center">
      <p className="text-sm font-medium text-rose-800">We couldn’t load this page</p>
      <p className="mt-1 text-sm text-rose-700/80">{message}</p>
      {onRetry && <Button variant="secondary" small className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  )
}
export function Empty({ title, text, action, icon = 'folder' }: { title: string; text?: string; action?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400"><Icon name={icon} className="h-6 w-6" /></div>
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Avatar({ name, size = 'h-8 w-8 text-xs' }: { name?: string; size?: string }) {
  const hue = [...(name ?? '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', size)} style={{ background: `hsl(${hue} 55% 45%)` }}>{initials(name)}</span>
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><Icon name="x" className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">{head.map(h => <th key={h} className="px-5 py-2.5 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => <td className={cx('px-5 py-3 align-middle', className)}>{children}</td>

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map(t => <button key={t.id} onClick={() => onChange(t.id)} className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{t.label}</button>)}
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <Card className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1.5 text-2xl font-semibold text-slate-900">{value}</p>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</Card>
}

export function Bars({ data, label }: { data: { label: string; value: number }[]; label?: string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div>
      <div className="flex h-32 items-end gap-1.5" role="img" aria-label={label}>
        {data.map(d => <div key={d.label} title={`${d.label}: ${d.value}`} className="flex-1 rounded-t bg-brand-500/80 hover:bg-brand-600" style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }} />)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{data[0]?.label}</span><span>{data.at(-1)?.label}</span></div>
    </div>
  )
}

// ---- toasts ----
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: string }[]>([])
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setItems(i => [...i, { id, msg, kind }])
    setTimeout(() => setItems(i => i.filter(x => x.id !== id)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {items.map(t => <div key={t.id} role="status" className={cx('pointer-events-auto rounded-lg px-4 py-2.5 text-sm shadow-lg', t.kind === 'ok' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white')}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}

export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    setBusy(true)
    try { const r = await fn(); if (ok) toast(ok); return r } catch (e: any) { toast(e.message ?? 'Something went wrong', 'err') } finally { setBusy(false) }
  }
  return { busy, run }
}
