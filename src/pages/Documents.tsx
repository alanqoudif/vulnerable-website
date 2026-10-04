import { FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Badge, Button, Card, Empty, ErrorState, Field, Loading, Modal, PageHeader, Table, Td, Tabs, useAction } from '../lib/ui'
import { ago, bytes, date, dateTime } from '../lib/format'

const FLOW = ['Draft', 'Shared', 'Reviewed', 'Archived']

export function Documents() {
  const { data, error, loading, reload } = useApi<any[]>('/v2/documents')
  const projects = useApi<any[]>('/v2/projects')
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('All')
  const [f, setF] = useState<any>({ title: '', summary: '', body: '', project_id: '' })
  const { busy, run } = useAction()
  async function create(e: FormEvent) {
    e.preventDefault()
    if (await run(() => api('/v2/documents', { method: 'POST', body: f }), 'Document created')) { setOpen(false); setF({ title: '', summary: '', body: '', project_id: '' }); reload() }
  }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const rows = (data ?? []).filter(d => filter === 'All' || d.status === filter)
  return (
    <>
      <PageHeader title="Documents" subtitle="Drafts, shared material and reviewed deliverables." actions={<Button onClick={() => setOpen(true)}>New document</Button>} />
      <Tabs tabs={['All', ...FLOW].map(s => ({ id: s, label: s }))} value={filter} onChange={setFilter} />
      <Card>{rows.length === 0 ? <Empty icon="doc" title="No documents" text="Create a document to get started." /> : (
        <Table head={['Title', 'Project', 'Owner', 'Status', 'Updated']}>
          {rows.map(d => <tr key={d.id} className="hover:bg-slate-50"><Td><Link to={`/documents/${d.id}`} className="font-medium text-slate-900 hover:text-brand-700">{d.title}</Link><p className="max-w-md truncate text-xs text-slate-400">{d.summary}</p></Td><Td>{d.project?.name ?? '-'}</Td><Td>{d.owner?.full_name}</Td><Td><Badge>{d.status}</Badge></Td><Td>{ago(d.updated_at)}</Td></tr>)}
        </Table>)}</Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New document" wide>
        <form onSubmit={create} className="space-y-4">
          <Field label="Title"><input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Summary"><input value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} /></Field>
          <Field label="Project"><select value={f.project_id} onChange={e => setF({ ...f, project_id: e.target.value })}><option value="">None</option>{projects.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Content"><textarea rows={8} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>Create</Button></div>
        </form>
      </Modal>
    </>
  )
}

export function DocumentDetail() {
  const { id } = useParams()
  const { isManager, me } = useAuth()
  const { data: d, error, loading, reload } = useApi<any>(`/v2/documents/${id}`)
  const versions = useApi<any>(`/v2/documents/${id}/versions`)
  const { busy, run } = useAction()
  const [edit, setEdit] = useState(false)
  const [body, setBody] = useState('')
  if (loading) return <Loading />
  if (error || !d) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />
  const next = FLOW[FLOW.indexOf(d.status) + 1]
  const canEdit = isManager || d.owner_id === me?.user.id
  const canMove = next && (next === 'Reviewed' ? isManager : canEdit)
  const move = async () => { if (await run(() => api(`/v2/documents/${d.id}/transition`, { method: 'POST', body: { to: next } }), `Marked as ${next}`)) { reload(); versions.reload() } }
  const save = async () => { if (await run(() => api(`/v2/documents/${d.id}`, { method: 'PATCH', body: { body, note: 'Edited in workspace' } }), 'Saved')) { setEdit(false); reload(); versions.reload() } }
  const download = async () => { const r = await run(() => api<{ url: string }>(`/v2/files/${d.file.id}/download`)); if (r) window.open(r.url, '_blank') }
  return (
    <>
      <p className="mb-2 text-sm"><Link to="/documents" className="text-slate-500 hover:text-slate-800">Documents</Link></p>
      <PageHeader title={d.title} subtitle={d.summary} actions={<><Badge>{d.status}</Badge>{d.file && <Button variant="secondary" onClick={download}>Download</Button>}{canMove && <Button onClick={move} disabled={busy}>Mark as {next}</Button>}</>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Content" action={canEdit && !edit && <Button small variant="secondary" onClick={() => { setBody(d.body ?? ''); setEdit(true) }}>Edit</Button>}>
          <div className="p-5">{edit ? (<><textarea rows={12} value={body} onChange={e => setBody(e.target.value)} /><div className="mt-3 flex justify-end gap-2"><Button variant="secondary" onClick={() => setEdit(false)}>Cancel</Button><Button onClick={save} disabled={busy}>Save version</Button></div></>) : <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{d.body || 'This document is empty.'}</pre>}</div>
        </Card>
        <div className="space-y-6">
          <Card title="Details"><dl className="space-y-3 p-5 text-sm"><div><dt className="text-xs text-slate-400">Owner</dt><dd>{d.owner?.full_name}</dd></div><div><dt className="text-xs text-slate-400">Project</dt><dd>{d.project ? <Link className="text-brand-700" to={`/projects/${d.project.id}`}>{d.project.name}</Link> : '-'}</dd></div><div><dt className="text-xs text-slate-400">Updated</dt><dd>{dateTime(d.updated_at)}</dd></div>{d.file && <div><dt className="text-xs text-slate-400">Attachment</dt><dd>{d.file.name} · {bytes(d.file.size_bytes)}</dd></div>}</dl></Card>
          <Card title="Version history">
            {versions.loading ? <Loading /> : versions.error ? <p className="p-5 text-sm text-slate-500">{versions.error}</p> : <ul className="divide-y divide-slate-100">{versions.data?.versions.map((v: any) => <li key={v.id} className="px-5 py-3"><p className="text-sm font-medium">v{v.version} <span className="font-normal text-slate-500">· {v.note}</span></p><p className="text-xs text-slate-400">{v.author?.full_name} · {date(v.created_at)}</p></li>)}</ul>}
          </Card>
        </div>
      </div>
    </>
  )
}
