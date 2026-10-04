import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Badge, Button, Card, Empty, ErrorState, Field, Icon, Loading, PageHeader, Stat, Table, Td, Tabs, useAction, useToast } from '../lib/ui'
import { ago, dateTime } from '../lib/format'

const STATUSES = ['Submitted', 'Under Review', 'Valid', 'Duplicate', 'Informational', 'Needs More Evidence', 'Resolved', 'Retested']
const ZERO = '00000000-0000-0000-0000-000000000000'

export default function Instructor() {
  const { me, signOut } = useAuth()
  const [tab, setTab] = useState('overview')
  if (me && !me.isInstructor) return <Navigate to="/" replace />
  return (
    <div className="min-h-full bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <p className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white"><Icon name="shield" className="h-4 w-4" /></span>Instructor console</p>
        <div className="flex items-center gap-3 text-sm text-slate-500">{me?.user.full_name}<Button small variant="secondary" onClick={() => void signOut()}>Sign out</Button></div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['trainees', 'Trainees'], ['scenarios', 'Scenarios'], ['catalogue', 'Range catalogue'], ['findings', 'Submitted findings'], ['outbox', 'Mail outbox'], ['notes', 'Notes'], ['reset', 'Environment']].map(([id, label]) => ({ id, label }))} />
        {tab === 'overview' && <Overview />}{tab === 'trainees' && <Trainees />}{tab === 'scenarios' && <Scenarios />}{tab === 'catalogue' && <Catalogue />}{tab === 'findings' && <Findings />}{tab === 'outbox' && <Outbox />}{tab === 'notes' && <Notes />}{tab === 'reset' && <Reset />}
      </div>
    </div>
  )
}

function Overview() {
  const { data, error, loading, reload } = useApi<any>('/instructor/overview')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <>
      <PageHeader title="Training overview" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5"><Stat label="Trainees" value={data.trainees} /><Stat label="Scenarios" value={data.scenarios} /><Stat label="Discovered" value={`${data.discoveredScenarios} / ${data.scenarios}`} /><Stat label="Findings" value={data.reports} /><Stat label="Total score" value={data.totalScore} /></div>
      <Card title="Findings by status" className="mt-6"><div className="flex flex-wrap gap-3 p-5">{STATUSES.map(s => <div key={s} className="rounded-lg bg-slate-50 px-4 py-2 text-sm"><Badge>{s}</Badge> <span className="ml-2 font-semibold">{data.reportsByStatus[s] ?? 0}</span></div>)}</div></Card>
    </>
  )
}

function Trainees() {
  const { data, error, loading, reload } = useApi<any[]>('/instructor/trainees')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return <><PageHeader title="Trainees" /><Card><Table head={['Trainee', 'Organization', 'Scenarios touched', 'Findings', 'Score', 'Last activity']}>{data?.map(t => <tr key={t.id}><Td><span className="font-medium">{t.full_name}</span><p className="text-xs text-slate-400">{t.email}</p></Td><Td>{t.organization}</Td><Td>{t.discovered}</Td><Td>{t.reports}</Td><Td>{t.score}</Td><Td>{ago(t.last_activity)}</Td></tr>)}</Table></Card></>
}

function Scenarios() {
  const { data, error, loading, reload } = useApi<any[]>('/instructor/scenarios')
  const [open, setOpen] = useState<string | null>(null)
  const [q, setQ] = useState('')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const rows = (data ?? []).filter(s => !q || JSON.stringify(s).toLowerCase().includes(q.toLowerCase()))
  const F = ({ l, v }: { l: string; v: any }) => <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{l}</dt><dd className="mt-0.5 text-sm text-slate-700">{v || '-'}</dd></div>
  return (
    <>
      <PageHeader title="Scenario progress" subtitle="Confidential — do not display to trainees." actions={<input className="!w-56" placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)} />} />
      <div className="space-y-2">{rows.map(s => (
        <Card key={s.id}>
          <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left" onClick={() => setOpen(open === s.id ? null : s.id)}>
            <span className="font-mono text-xs text-slate-400">{s.id}</span><span className="min-w-0 flex-1 font-medium">{s.title}</span><span className="text-xs text-slate-500">{s.category}</span><Badge tone={s.severity}>{s.severity}</Badge><Badge tone={s.difficulty === 'Hard' ? 'High' : s.difficulty === 'Medium' ? 'Medium' : 'Low'}>{s.difficulty}</Badge>{s.chain && <Badge tone="Shared">{s.chain}</Badge>}<Badge tone={s.discovered ? 'Valid' : 'Draft'}>{s.discovered ? `Discovered · ${s.discovered_by.length}` : 'Not discovered'}</Badge>
          </button>
          {open === s.id && <dl className="grid gap-4 border-t border-slate-100 p-5 sm:grid-cols-2">
            <F l="Affected feature" v={s.feature} /><F l="Prerequisites" v={s.prerequisites} /><F l="Expected secure behaviour" v={s.expected_secure} /><F l="Intentionally flawed behaviour" v={s.flawed_behavior} /><F l="Investigation path" v={s.investigation_path} /><F l="Expected evidence" v={s.expected_evidence} /><F l="Business impact" v={s.business_impact} /><F l="Remediation" v={s.remediation} /><F l="Chain membership" v={s.chain} /><F l="First seen" v={s.first_seen ? dateTime(s.first_seen) : null} /></dl>}
        </Card>))}</div>
    </>
  )
}

function Catalogue() {
  const { data, error, loading, reload } = useApi<any[]>('/instructor/catalogue')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const rows = (data ?? []).filter(v => v.id.startsWith('VULN-') || v.id.startsWith('CHAIN-'))
  const F = ({ label, value }: { label: string; value: any }) => <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{value || '—'}</dd></div>
  return <><PageHeader title="Real range catalogue" subtitle="Instructor-only implementation evidence and learner progress." actions={<Button variant="secondary" onClick={reload}>Refresh</Button>} />
    <div className="space-y-3">{rows.map(v => <Card key={v.id}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3"><span className="font-mono text-xs">{v.id}</span><span className="flex-1 text-sm font-medium">{v.category}</span><Badge tone={v.triggered ? 'High' : 'Draft'}>{v.triggered ? 'Triggered' : 'Not triggered'}</Badge><Badge tone={v.reported ? 'Shared' : 'Draft'}>{v.reported ? 'Reported' : 'Not reported'}</Badge><Badge tone={v.validated ? 'Valid' : 'Draft'}>{v.validated ? 'Validated' : 'Not validated'}</Badge><Badge tone={v.reset ? 'Active' : 'Medium'}>{v.reset ? 'Reset' : 'Modified'}</Badge></div>
      <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"><F label="Affected endpoint" value={v.endpoint} /><F label="Affected table / bucket" value={v.affected_resource} /><F label="Required account / role" value={v.required_role} /><F label="Secure expected behavior" value={v.secure_behavior} /><F label="Actual vulnerable behavior" value={v.actual_behavior} /><F label="Exact root cause" value={v.root_cause} /><F label="Expected evidence" value={v.expected_evidence} /><F label="Business impact" value={v.business_impact} /><F label="Remediation" value={v.remediation} /><F label="Chain membership" value={(v.chain_membership ?? []).join(', ')} /><F label="Reset dependencies" value={(v.reset_dependencies ?? []).join(', ')} /></dl>
    </Card>)}</div></>
}

function Findings() {
  const { data, error, loading, reload } = useApi<any[]>('/instructor/reports')
  const scen = useApi<any[]>('/instructor/scenarios')
  const [sel, setSel] = useState<any>(null)
  const [comment, setComment] = useState('')
  const { busy, run } = useAction()
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const cur = sel && data?.find(r => r.id === sel)
  const patch = async (b: any) => { if (await run(() => api(`/instructor/reports/${cur.id}`, { method: 'PATCH', body: b }), 'Updated')) reload() }
  const post = async () => { if (comment.trim() && (await run(() => api(`/instructor/reports/${cur.id}/comments`, { method: 'POST', body: { body: comment } }), 'Comment added'))) { setComment(''); reload() } }
  return (
    <>
      <PageHeader title="Submitted findings" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2 self-start">{!data?.length ? <Empty icon="flag" title="No findings submitted" /> : <ul className="divide-y divide-slate-100">{data.map(r => <li key={r.id}><button onClick={() => setSel(r.id)} className={`w-full px-5 py-3 text-left hover:bg-slate-50 ${sel === r.id ? 'bg-brand-50' : ''}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{r.title}</span><Badge>{r.status}</Badge></div><p className="text-xs text-slate-400">{r.trainee?.full_name} · {r.severity} · {ago(r.created_at)}{r.score !== null ? ` · ${r.score} pts` : ''}</p></button></li>)}</ul>}</Card>
        <div className="lg:col-span-3">{!cur ? <Card><Empty icon="flag" title="Select a finding to review" /></Card> : (
          <Card title={cur.title}><div className="space-y-4 p-5 text-sm">
            <p className="text-xs text-slate-400">{cur.trainee?.full_name} · {cur.component} · reported severity {cur.severity}</p>
            {(['description', 'steps', 'evidence', 'impact', 'remediation'] as const).map(k => cur[k] && <div key={k}><p className="text-xs font-medium uppercase text-slate-400">{k}</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{cur[k]}</p></div>)}
            <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
              <Field label="Status"><select value={cur.status} onChange={e => patch({ status: e.target.value })} disabled={busy}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Score (0–100)"><input type="number" min={0} max={100} defaultValue={cur.score ?? ''} onBlur={e => e.target.value !== '' && patch({ score: e.target.value })} /></Field>
              <Field label="Matches scenario"><select value={cur.scenario_id ?? ''} onChange={e => patch({ scenario_id: e.target.value || null })}><option value="">Unassigned</option>{scen.data?.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select></Field></div>
            <div className="flex flex-wrap gap-2"><Button small variant="secondary" onClick={() => patch({ status: 'Valid' })}>Accept</Button><Button small variant="secondary" onClick={() => patch({ status: 'Informational' })}>Informational</Button><Button small variant="secondary" onClick={() => patch({ status: 'Needs More Evidence' })}>Request evidence</Button><Button small variant="danger" onClick={() => patch({ status: 'Duplicate' })}>Reject as duplicate</Button></div>
            <div className="border-t border-slate-100 pt-4"><p className="mb-2 text-xs font-medium uppercase text-slate-400">Comments</p>{cur.comments.map((c: any) => <div key={c.id} className="mb-2 rounded-lg bg-slate-50 p-3">{c.body}<p className="mt-1 text-xs text-slate-400">{ago(c.created_at)}</p></div>)}<textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment or request more evidence…" /><div className="mt-2 flex justify-end"><Button small onClick={post} disabled={busy}>Comment</Button></div></div>
          </div></Card>)}</div>
      </div>
    </>
  )
}

function Outbox() {
  const { data, error, loading, reload } = useApi<any[]>('/instructor/outbox')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return <><PageHeader title="Mail outbox" subtitle="Simulated email: reset codes issued by the sign-in flow." actions={<Button variant="secondary" onClick={reload}>Refresh</Button>} /><Card>{!data?.length ? <Empty icon="mail" title="No messages sent" /> : <Table head={['Recipient', 'Code', 'State', 'Attempts', 'Sent']}>{data.map(m => <tr key={m.id}><Td>{m.email}</Td><Td className="font-mono">{m.code}</Td><Td><Badge tone={m.used ? 'Draft' : 'Active'}>{m.used ? 'Used' : 'Active'}</Badge></Td><Td>{m.attempts}</Td><Td>{ago(m.created_at)}</Td></tr>)}</Table>}</Card></>
}

function Notes() {
  const { data, error, loading, reload } = useApi<any[]>('/instructor/notes')
  const [body, setBody] = useState('')
  const { busy, run } = useAction()
  const add = async () => { if (body.trim() && (await run(() => api('/instructor/notes', { method: 'POST', body: { body } }), 'Note saved'))) { setBody(''); reload() } }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return <><PageHeader title="Instructor notes" /><Card className="mb-4 p-4"><textarea rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="Private note…" /><div className="mt-2 flex justify-end"><Button onClick={add} disabled={busy}>Save note</Button></div></Card><div className="space-y-2">{data?.map(n => <Card key={n.id} className="p-4 text-sm">{n.body}<p className="mt-1 text-xs text-slate-400">{ago(n.created_at)}</p></Card>)}{!data?.length && <Card><Empty title="No notes" /></Card>}</div></>
}

function Reset() {
  const [confirm, setConfirm] = useState('')
  const { busy, run } = useAction()
  const toast = useToast()
  const go = async () => { const r = await run(() => api<any>('/instructor/reset', { method: 'POST', body: { confirm } })); if (r) { toast(`Environment restored (${r.files_restored} files)`); setConfirm('') } }
  return (
    <>
      <PageHeader title="Reset training environment" subtitle="Restores users, roles, projects, files, memberships, invoices, invitations, sessions, API keys, conversations, knowledge and scenario progress from deterministic seed data. Instructor configuration, notes and submitted findings are kept." />
      <Card className="max-w-lg p-5"><Field label="Type RESET to confirm"><input value={confirm} onChange={e => setConfirm(e.target.value)} /></Field><Button variant="danger" className="mt-4" disabled={confirm !== 'RESET' || busy} onClick={go}>{busy ? 'Resetting…' : 'Reset environment'}</Button></Card>
    </>
  )
}
