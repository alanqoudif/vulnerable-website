import { FormEvent, useEffect, useRef, useState } from 'react'
import { api, useApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Avatar, Badge, Button, Card, Empty, ErrorState, Field, Loading, PageHeader, useAction, useToast } from '../lib/ui'
import { ago, date, roleLabel } from '../lib/format'

export function Profile() {
  const { me, refresh, activeOrg } = useAuth()
  const [f, setF] = useState({ full_name: me?.user.full_name ?? '', title: me?.user.title ?? '', phone: me?.user.phone ?? '' })
  const { busy, run } = useAction()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  useEffect(() => { if (me?.user.avatar_path) setAvatar(supabase.storage.from('avatars').getPublicUrl(me.user.avatar_path).data.publicUrl) }, [me?.user.avatar_path])
  const save = async (e: FormEvent) => { e.preventDefault(); if (await run(() => api('/v2/account/profile', { method: 'PATCH', body: f }), 'Profile updated')) void refresh() }
  async function upload(file?: File) {
    if (!file || !me) return
    if (file.size > 1_000_000) return toast('Image must be under 1 MB', 'err')
    const path = `${me.user.id}/avatar-${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) return toast('Upload failed', 'err')
    if (await run(() => api('/v2/account/profile', { method: 'PATCH', body: { avatar_path: path } }), 'Photo updated')) void refresh()
  }
  return (
    <>
      <PageHeader title="Profile" subtitle="Your personal details." />
      <Card className="max-w-2xl"><form onSubmit={save} className="space-y-4 p-5">
        <div className="flex items-center gap-4">{avatar ? <img src={avatar} alt="" className="h-16 w-16 rounded-full object-cover" /> : <Avatar name={me?.user.full_name} size="h-16 w-16 text-lg" />}
          <div><input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void upload(e.target.files?.[0])} /><Button type="button" variant="secondary" small onClick={() => fileRef.current?.click()}>Change photo</Button><p className="mt-1 text-xs text-slate-400">{me?.user.email} · {roleLabel(activeOrg?.role)} at {activeOrg?.name}</p></div></div>
        <Field label="Full name"><input required value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Job title"><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Phone"><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
        <div className="flex justify-end"><Button disabled={busy}>Save changes</Button></div>
      </form></Card>
    </>
  )
}

export function Security() {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const { busy, run } = useAction()
  const toast = useToast()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pw !== pw2) return toast('Passwords do not match', 'err')
    if (await run(() => api('/v2/account/password', { method: 'POST', body: { password: pw } }), 'Password updated')) { setPw(''); setPw2('') }
  }
  return (
    <>
      <PageHeader title="Security" subtitle="Protect your account." />
      <Card title="Change password" className="max-w-xl"><form onSubmit={submit} className="space-y-4 p-5">
        <Field label="New password" hint="At least 10 characters."><input type="password" minLength={10} required value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><input type="password" minLength={10} required value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" /></Field>
        <div className="flex justify-end"><Button disabled={busy}>Update password</Button></div></form></Card>
      <Card title="Two-step verification" className="mt-6 max-w-xl"><div className="flex items-center justify-between p-5"><div><p className="text-sm font-medium">Authenticator app</p><p className="text-xs text-slate-500">Add a second step when signing in.</p></div><Badge tone="Draft">Not enabled</Badge></div></Card>
    </>
  )
}

export function Sessions() {
  const { data, error, loading, reload } = useApi<any[]>('/v2/account/sessions')
  const { busy, run } = useAction()
  const current = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nq_sid') : null
  const revoke = async (id: string) => { if (await run(() => api(`/v2/account/sessions/${id}`, { method: 'DELETE' }), 'Session signed out')) reload() }
  const others = async () => { if (await run(() => api('/v2/account/sessions/revoke-others', { method: 'POST', body: { current } }), 'Other sessions signed out')) reload() }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <>
      <PageHeader title="Sessions" subtitle="Devices signed in to your account." actions={<Button variant="secondary" onClick={others} disabled={busy}>Sign out other devices</Button>} />
      <Card>{!data?.length ? <Empty icon="device" title="No sessions" /> : <ul className="divide-y divide-slate-100">{data.map(s => (
        <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-4"><div><p className="text-sm font-medium">{s.device} {s.id === current && <Badge tone="Active">This device</Badge>}</p><p className="text-xs text-slate-500">{s.location} · {s.ip} · active {ago(s.last_seen_at)} · since {date(s.created_at)}</p></div>
          {s.revoked ? <Badge tone="Revoked">Signed out</Badge> : s.id !== current && <Button small variant="secondary" onClick={() => revoke(s.id)} disabled={busy}>Sign out</Button>}</li>))}</ul>}</Card>
    </>
  )
}

export function ReportIssue() {
  const list = useApi<any[]>('/v2/reports')
  const blank = { title: '', component: '', severity: 'Medium', description: '', steps: '', evidence: '', impact: '', remediation: '' }
  const [f, setF] = useState(blank)
  const [open, setOpen] = useState<any>(null)
  const { busy, run } = useAction()
  const submit = async (e: FormEvent) => { e.preventDefault(); if (await run(() => api('/v2/reports', { method: 'POST', body: f }), 'Report submitted')) { setF(blank); list.reload() } }
  const view = async (id: string) => { const r = await run(() => api<any>(`/v2/reports/${id}`)); if (r) setOpen(r) }
  const set = (k: keyof typeof blank) => (e: any) => setF({ ...f, [k]: e.target.value })
  return (
    <>
      <PageHeader title="Report Security Issue" subtitle="Describe a security concern you found in this workspace." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3"><form onSubmit={submit} className="space-y-4 p-5">
          <Field label="Title"><input required value={f.title} onChange={set('title')} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Affected component"><input value={f.component} onChange={set('component')} placeholder="e.g. /api/v2/…" /></Field><Field label="Severity"><select value={f.severity} onChange={set('severity')}>{['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}</select></Field></div>
          <Field label="Description"><textarea required rows={3} value={f.description} onChange={set('description')} /></Field>
          <Field label="Steps to reproduce"><textarea rows={4} value={f.steps} onChange={set('steps')} /></Field>
          <Field label="Evidence"><textarea rows={3} value={f.evidence} onChange={set('evidence')} placeholder="Requests, responses, screenshots (as text)" /></Field>
          <Field label="Impact"><textarea rows={2} value={f.impact} onChange={set('impact')} /></Field>
          <Field label="Recommended remediation"><textarea rows={2} value={f.remediation} onChange={set('remediation')} /></Field>
          <div className="flex justify-end"><Button disabled={busy}>Submit report</Button></div></form></Card>
        <Card title="My reports" className="lg:col-span-2 self-start">{list.loading ? <Loading /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data?.length ? <Empty icon="flag" title="No reports yet" /> : <ul className="divide-y divide-slate-100">{list.data.map(r => <li key={r.id}><button onClick={() => view(r.id)} className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left hover:bg-slate-50"><span className="min-w-0"><span className="block truncate text-sm font-medium">{r.title}</span><span className="text-xs text-slate-400">{r.severity} · {ago(r.created_at)}</span></span><span className="flex items-center gap-2"><Badge>{r.status}</Badge>{r.score !== null && <span className="text-xs font-semibold text-brand-700">{r.score}</span>}</span></button></li>)}</ul>}</Card>
      </div>
      {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && setOpen(null)}><div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 sm:max-w-2xl sm:rounded-2xl"><div className="mb-4 flex items-start justify-between"><div><h3 className="font-semibold">{open.title}</h3><p className="text-xs text-slate-400">{open.component} · {open.severity}</p></div><Badge>{open.status}</Badge></div>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{open.description}</p>
        <h4 className="mb-2 mt-5 text-sm font-semibold">Reviewer comments</h4>{open.comments.length === 0 ? <p className="text-sm text-slate-400">No comments yet.</p> : open.comments.map((c: any) => <div key={c.id} className="mb-2 rounded-lg bg-slate-50 p-3 text-sm">{c.body}<p className="mt-1 text-xs text-slate-400">{ago(c.created_at)}</p></div>)}
        <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => setOpen(null)}>Close</Button></div></div></div>}
    </>
  )
}
