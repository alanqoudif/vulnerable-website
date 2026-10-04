import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, Field, Spinner, Loading } from '../lib/ui'

function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4 py-10">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow"><span className="h-4 w-4 rounded-full bg-white" /></span>
        <span className="text-lg font-semibold tracking-tight text-slate-900">Nuqta Workspace</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-6 text-xs text-slate-400">© 2026 Nuqta Technology · Privacy · Terms</p>
    </div>
  )
}
const Err = ({ msg }: { msg: string | null }) => msg ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</p> : null

export function Login() {
  const { session, ready } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [step, setStep] = useState<'email' | 'password'>('email')
  const [hello, setHello] = useState<{ first_name: string; workspace: string | null } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (ready && session) return <Navigate to={(loc.state as any)?.from ?? '/'} replace />

  async function next(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      if (step === 'email') {
        const r = await fetch('/api/v2/auth/lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error)
        setHello(j); setStep('password')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw })
        if (error) throw new Error('Incorrect email or password')
        nav((loc.state as any)?.from ?? '/', { replace: true })
      }
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <AuthLayout title={step === 'email' ? 'Sign in to your workspace' : `Welcome back, ${hello?.first_name}`} subtitle={step === 'email' ? 'Use your work email to continue.' : hello?.workspace ?? email}>
      <form onSubmit={next} className="space-y-4">
        {step === 'email' ? (
          <Field label="Work email"><input type="email" required autoFocus autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
        ) : (
          <Field label="Password"><input type="password" required autoFocus autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
        )}
        <Err msg={err} />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4 !text-white" /> : step === 'email' ? 'Continue' : 'Sign in'}</Button>
        <div className="flex items-center justify-between text-sm">
          {step === 'password' ? <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => { setStep('email'); setPw(''); setErr(null) }}>Use a different email</button> : <span />}
          <Link to="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>
        </div>
      </form>
    </AuthLayout>
  )
}

export function Forgot() {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const post = async (path: string, body: unknown) => {
    const r = await fetch('/api' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error ?? 'Request failed')
    return j
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      if (step === 'request') { await post('/v2/auth/forgot', { email }); setStep('reset') }
      else { await post('/v2/auth/reset', { email, code, password: pw }); setStep('done') }
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  if (step === 'done') return <AuthLayout title="Password updated" subtitle="You can now sign in with your new password."><Link to="/login"><Button className="w-full">Back to sign in</Button></Link></AuthLayout>
  return (
    <AuthLayout title="Reset your password" subtitle={step === 'request' ? 'We’ll email you a 4-digit verification code.' : 'Enter the code we sent and choose a new password.'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Work email"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} readOnly={step === 'reset'} /></Field>
        {step === 'reset' && (<>
          <Field label="Verification code"><input inputMode="numeric" pattern="\d{4}" maxLength={4} required value={code} onChange={e => setCode(e.target.value)} placeholder="0000" /></Field>
          <Field label="New password" hint="At least 10 characters."><input type="password" minLength={10} required value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></Field>
        </>)}
        <Err msg={err} />
        <Button type="submit" className="w-full" disabled={busy}>{step === 'request' ? 'Send code' : 'Update password'}</Button>
        <Link to="/login" className="block text-center text-sm text-slate-500 hover:text-slate-800">Back to sign in</Link>
      </form>
    </AuthLayout>
  )
}

export function AcceptInvite() {
  const { token } = useParams()
  const nav = useNavigate()
  const [info, setInfo] = useState<{ email: string; organization: string } | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'bad' | 'done'>('loading')
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    fetch(`/api/v2/invitations/lookup/${token}`).then(async r => { if (!r.ok) throw 0; setInfo(await r.json()); setState('ok') }).catch(() => setState('bad'))
  }, [token])
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null)
    try { await api('/v2/invitations/accept', { method: 'POST', body: { token, full_name: name, password: pw } }); setState('done') } catch (e: any) { setErr(e.message) }
  }
  if (state === 'loading') return <AuthLayout title="Checking invitation…"><Loading /></AuthLayout>
  if (state === 'bad') return <AuthLayout title="Invitation unavailable" subtitle="This invitation link is invalid or has expired. Ask your administrator for a new one."><Link to="/login"><Button variant="secondary" className="w-full">Go to sign in</Button></Link></AuthLayout>
  if (state === 'done') return <AuthLayout title="You’re all set" subtitle="Your account has been created."><Button className="w-full" onClick={() => nav('/login')}>Sign in</Button></AuthLayout>
  return (
    <AuthLayout title={`Join ${info?.organization}`} subtitle={`Create your account for ${info?.email}.`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><input required value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Password" hint="At least 10 characters."><input type="password" minLength={10} required value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <Err msg={err} />
        <Button type="submit" className="w-full">Create account</Button>
      </form>
    </AuthLayout>
  )
}
