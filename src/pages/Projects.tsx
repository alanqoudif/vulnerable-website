import { FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Avatar, Badge, Button, Card, Empty, ErrorState, Field, Loading, Modal, PageHeader, Table, Td, Tabs, useAction, useToast } from '../lib/ui'
import { ago, date, money } from '../lib/format'

const FLOW = ['Draft', 'Active', 'Review', 'Approved', 'Archived']

export function Projects() {
  const { isManager } = useAuth()
  const { data, error, loading, reload } = useApi<any[]>('/v2/projects')
  const customers = useApi<any[]>(isManager ? '/v2/customers' : null)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('All')
  const { busy, run } = useAction()
  const [f, setF] = useState<any>({ name: '', description: '', customer_id: '', due_date: '', budget: '' })

  async function create(e: FormEvent) {
    e.preventDefault()
    const r = await run(() => api('/v2/projects', { method: 'POST', body: f }), 'Project created')
    if (r) { setOpen(false); setF({ name: '', description: '', customer_id: '', due_date: '', budget: '' }); reload() }
  }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const rows = (data ?? []).filter(p => filter === 'All' || p.status === filter)
  return (
    <>
      <PageHeader title="Projects" subtitle="Track delivery from draft to approval." actions={isManager && <Button onClick={() => setOpen(true)}>New project</Button>} />
      <Tabs tabs={['All', ...FLOW].map(s => ({ id: s, label: s }))} value={filter} onChange={setFilter} />
      <Card>
        {rows.length === 0 ? <Empty title="No projects here" text="Projects in this state will appear here." /> : (
          <Table head={['Project', 'Customer', 'Owner', 'Status', 'Due', 'Budget']}>
            {rows.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td><Link to={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-brand-700">{p.name}</Link><p className="text-xs text-slate-400">{p.code}</p></Td>
                <Td>{p.customer?.name ?? '-'}</Td>
                <Td><span className="inline-flex items-center gap-2"><Avatar name={p.owner?.full_name} size="h-6 w-6 text-[10px]" />{p.owner?.full_name}</span></Td>
                <Td><Badge>{p.status}</Badge></Td><Td>{date(p.due_date)}</Td><Td>{money(p.budget)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <form onSubmit={create} className="space-y-4">
          <Field label="Name"><input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Description"><textarea rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Customer"><select value={f.customer_id} onChange={e => setF({ ...f, customer_id: e.target.value })}><option value="">No customer</option>{customers.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Due date"><input type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></Field><Field label="Budget (OMR)"><input type="number" min="0" value={f.budget} onChange={e => setF({ ...f, budget: e.target.value })} /></Field></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>Create project</Button></div>
        </form>
      </Modal>
    </>
  )
}

export function ProjectDetail() {
  const { id } = useParams()
  const { isManager, me } = useAuth()
  const { data: p, error, loading, reload } = useApi<any>(`/v2/projects/${id}`)
  const { busy, run } = useAction()
  const toast = useToast()
  const [tab, setTab] = useState('overview')
  const [task, setTask] = useState('')
  if (loading) return <Loading />
  if (error || !p) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />
  const idx = FLOW.indexOf(p.status)
  const next = FLOW[idx + 1]
  const canMove = next && (isManager || p.owner_id === me?.user.id)
  const move = async () => { if (await run(() => api(`/v2/projects/${p.id}/transition`, { method: 'POST', body: { to: next } }), `Moved to ${next}`)) reload() }
  const archive = async () => { if (await run(() => api(`/v2/projects/${p.id}/archive`, { method: 'POST' }), 'Project archived')) reload() }
  const addTask = async (e: FormEvent) => { e.preventDefault(); if (await run(() => api('/v2/tasks', { method: 'POST', body: { title: task, project_id: p.id } }), 'Task added')) { setTask(''); reload() } }
  const setStatus = async (tid: string, status: string) => { try { await api(`/v2/tasks/${tid}`, { method: 'PATCH', body: { status } }); reload() } catch (e: any) { toast(e.message, 'err') } }
  return (
    <>
      <p className="mb-2 text-sm"><Link to="/projects" className="text-slate-500 hover:text-slate-800">Projects</Link> <span className="text-slate-300">/</span> {p.code}</p>
      <PageHeader title={p.name} subtitle={p.description} actions={<><Badge>{p.status}</Badge>{canMove && <Button onClick={move} disabled={busy}>Move to {next}</Button>}{isManager && p.status !== 'Archived' && <Button variant="secondary" onClick={archive} disabled={busy}>Archive project</Button>}</>} />
      <div className="mb-6 flex items-center gap-1" aria-label="Workflow">
        {FLOW.map((s, i) => <div key={s} className="flex-1"><div className={`h-1.5 rounded-full ${i <= idx ? 'bg-brand-600' : 'bg-slate-200'}`} /><p className={`mt-1 text-center text-[11px] ${i === idx ? 'font-semibold text-brand-700' : 'text-slate-400'}`}>{s}</p></div>)}
      </div>
      <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'tasks', label: `Tasks (${p.tasks.length})` }, { id: 'docs', label: `Documents (${p.documents.length})` }, { id: 'activity', label: 'Activity' }]} value={tab} onChange={setTab} />
      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Details" className="lg:col-span-2"><dl className="grid grid-cols-2 gap-4 p-5 text-sm">
            <div><dt className="text-xs text-slate-400">Owner</dt><dd>{p.owner?.full_name}</dd></div><div><dt className="text-xs text-slate-400">Customer</dt><dd>{p.customer?.name ?? '-'}</dd></div>
            <div><dt className="text-xs text-slate-400">Start</dt><dd>{date(p.start_date)}</dd></div><div><dt className="text-xs text-slate-400">Due</dt><dd>{date(p.due_date)}</dd></div>
            <div><dt className="text-xs text-slate-400">Budget</dt><dd>{money(p.budget)}</dd></div></dl></Card>
          <Card title="Team"><ul className="divide-y divide-slate-100">{p.members.map((m: any) => <li key={m.user.id} className="flex items-center gap-3 px-5 py-3"><Avatar name={m.user.full_name} /><div><p className="text-sm font-medium">{m.user.full_name}</p><p className="text-xs text-slate-400 capitalize">{m.role}</p></div></li>)}</ul></Card>
        </div>
      )}
      {tab === 'tasks' && (
        <Card>
          <form onSubmit={addTask} className="flex gap-2 border-b border-slate-100 p-4"><input required placeholder="Add a task…" value={task} onChange={e => setTask(e.target.value)} /><Button disabled={busy}>Add</Button></form>
          {p.tasks.length === 0 ? <Empty title="No tasks yet" icon="check" /> : <ul className="divide-y divide-slate-100">{p.tasks.map((t: any) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className={`truncate text-sm font-medium ${t.status === 'done' ? 'text-slate-400 line-through' : ''}`}>{t.title}</p><p className="text-xs text-slate-400">{t.assignee?.full_name} · due {date(t.due_date)}</p></div>
              <select aria-label="Task status" className="!w-auto !py-1 text-xs" value={t.status} onChange={e => setStatus(t.id, e.target.value)}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></li>))}</ul>}
        </Card>
      )}
      {tab === 'docs' && <Card>{p.documents.length === 0 ? <Empty title="No documents" icon="doc" /> : <ul className="divide-y divide-slate-100">{p.documents.map((d: any) => <li key={d.id}><Link to={`/documents/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"><span className="text-sm font-medium">{d.title}</span><Badge>{d.status}</Badge></Link></li>)}</ul>}</Card>}
      {tab === 'activity' && <Card>{p.activity.length === 0 ? <Empty title="No activity recorded" /> : <ul className="divide-y divide-slate-100">{p.activity.map((a: any, i: number) => <li key={i} className="px-5 py-3 text-sm"><span className="font-medium">{a.actor?.full_name}</span> <span className="text-slate-500">{a.action.replace(/[._]/g, ' ')}</span> <span className="text-xs text-slate-400">· {ago(a.created_at)}</span></li>)}</ul>}</Card>}
    </>
  )
}

export function Tasks() {
  const [mine, setMine] = useState(true)
  const { data, error, loading, reload } = useApi<any[]>(`/v2/tasks${mine ? '?mine=1' : ''}`, [mine])
  const toast = useToast()
  const set = async (id: string, status: string) => { try { await api(`/v2/tasks/${id}`, { method: 'PATCH', body: { status } }); reload() } catch (e: any) { toast(e.message, 'err') } }
  return (
    <>
      <PageHeader title="Tasks" subtitle="Everything assigned across your projects." actions={<div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">{[true, false].map(v => <button key={String(v)} onClick={() => setMine(v)} className={`rounded-md px-3 py-1 ${mine === v ? 'bg-brand-600 text-white' : 'text-slate-600'}`}>{v ? 'Mine' : 'Everyone'}</button>)}</div>} />
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card>{!data?.length ? <Empty title="No tasks" icon="check" text="Nothing to show for this filter." /> : (
          <Table head={['Task', 'Project', 'Assignee', 'Priority', 'Due', 'Status']}>
            {data.map(t => <tr key={t.id}><Td className="font-medium">{t.title}</Td><Td>{t.project ? <Link to={`/projects/${t.project.id}`} className="text-brand-700">{t.project.name}</Link> : '-'}</Td><Td>{t.assignee?.full_name}</Td><Td><Badge tone={t.priority}>{t.priority}</Badge></Td><Td>{date(t.due_date)}</Td>
              <Td><select aria-label="Status" className="!w-auto !py-1 text-xs" value={t.status} onChange={e => set(t.id, e.target.value)}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></Td></tr>)}
          </Table>)}</Card>
      )}
    </>
  )
}
