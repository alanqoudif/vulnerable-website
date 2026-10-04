import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Avatar, Badge, Button, Card, Empty, ErrorState, Field, Loading, Modal, PageHeader, Table, Td, Tabs, useAction } from '../lib/ui'
import { ago, money, roleLabel } from '../lib/format'

export function Customers() {
  const { isManager } = useAuth()
  const { data, error, loading, reload } = useApi<any[]>('/v2/customers')
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<any>({ name: '', contact_name: '', email: '', phone: '', industry: '' })
  const { busy, run } = useAction()
  async function create(e: FormEvent) { e.preventDefault(); if (await run(() => api('/v2/customers', { method: 'POST', body: f }), 'Customer added')) { setOpen(false); reload() } }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <>
      <PageHeader title="Customers" subtitle="Accounts your team is working with." actions={isManager && <Button onClick={() => setOpen(true)}>Add customer</Button>} />
      <Card>{!data?.length ? <Empty icon="users" title="No customers yet" /> : (
        <Table head={['Customer', 'Contact', 'Industry', 'Status', ...(isManager ? ['Annual value'] : [])]}>
          {data.map(c => <tr key={c.id} className="hover:bg-slate-50"><Td><Link to={`/customers/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">{c.name}</Link></Td><Td>{c.contact_name}<p className="text-xs text-slate-400">{c.email}</p></Td><Td>{c.industry}</Td><Td><Badge>{c.status}</Badge></Td>{isManager && <Td>{money(c.annual_value)}</Td>}</tr>)}
        </Table>)}</Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add customer">
        <form onSubmit={create} className="space-y-4">
          {(['name', 'contact_name', 'email', 'phone', 'industry'] as const).map(k => <Field key={k} label={k.replace('_', ' ').replace(/^./, s => s.toUpperCase())}><input required={k === 'name'} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></Field>)}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>Add customer</Button></div>
        </form>
      </Modal>
    </>
  )
}

export function CustomerDetail() {
  const { id } = useParams()
  const { isManager } = useAuth()
  const { data: c, error, loading, reload } = useApi<any>(`/v2/customers/${id}`)
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState<any>({})
  const { busy, run } = useAction()
  if (loading) return <Loading />
  if (error || !c) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />
  const save = async (e: FormEvent) => { e.preventDefault(); if (await run(() => api(`/v2/customers/${c.id}`, { method: 'PATCH', body: f }), 'Customer updated')) { setEdit(false); reload() } }
  return (
    <>
      <p className="mb-2 text-sm"><Link to="/customers" className="text-slate-500 hover:text-slate-800">Customers</Link></p>
      <PageHeader title={c.name} subtitle={c.industry} actions={<><Badge>{c.status}</Badge><Button variant="secondary" onClick={() => { setF({ contact_name: c.contact_name, email: c.email, phone: c.phone, notes: c.notes ?? '' }); setEdit(true) }}>Edit contact</Button></>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Contact" className="lg:col-span-1"><dl className="space-y-3 p-5 text-sm"><div><dt className="text-xs text-slate-400">Primary contact</dt><dd>{c.contact_name}</dd></div><div><dt className="text-xs text-slate-400">Email</dt><dd>{c.email}</dd></div><div><dt className="text-xs text-slate-400">Phone</dt><dd>{c.phone}</dd></div><div><dt className="text-xs text-slate-400">Account owner</dt><dd>{c.owner?.full_name}</dd></div>{isManager && <div><dt className="text-xs text-slate-400">Annual value</dt><dd>{money(c.annual_value)}</dd></div>}</dl></Card>
        <div className="space-y-6 lg:col-span-2">
          {isManager && <Card title="Notes"><p className="p-5 text-sm text-slate-600">{c.notes || 'No notes.'}</p></Card>}
          <Card title="Projects">{c.projects.length ? <ul className="divide-y divide-slate-100">{c.projects.map((p: any) => <li key={p.id}><Link to={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"><span className="text-sm font-medium">{p.name}</span><Badge>{p.status}</Badge></Link></li>)}</ul> : <Empty title="No projects" />}</Card>
          {isManager && <Card title="Invoices">{c.invoices.length ? <ul className="divide-y divide-slate-100">{c.invoices.map((i: any) => <li key={i.id}><Link to={`/finance/invoices/${i.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"><span className="text-sm font-medium">{i.number}</span><span className="flex items-center gap-3 text-sm">{money(i.total, i.currency)}<Badge>{i.status}</Badge></span></Link></li>)}</ul> : <Empty title="No invoices" />}</Card>}
        </div>
      </div>
      <Modal open={edit} onClose={() => setEdit(false)} title="Edit contact">
        <form onSubmit={save} className="space-y-4">
          <Field label="Contact name"><input value={f.contact_name ?? ''} onChange={e => setF({ ...f, contact_name: e.target.value })} /></Field>
          <Field label="Email"><input value={f.email ?? ''} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><input value={f.phone ?? ''} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Notes"><textarea rows={3} value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEdit(false)}>Cancel</Button><Button disabled={busy}>Save</Button></div>
        </form>
      </Modal>
    </>
  )
}

export function Team() {
  const { data, error, loading, reload } = useApi<any[]>('/v2/members')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <>
      <PageHeader title="Team" subtitle="People in your organization." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map(m => (
          <Card key={m.user_id} className="p-5"><div className="flex items-center gap-3"><Avatar name={m.full_name} size="h-11 w-11 text-sm" /><div className="min-w-0"><p className="truncate font-medium text-slate-900">{m.full_name}</p><p className="truncate text-xs text-slate-500">{m.title}</p></div></div>
            <div className="mt-4 flex items-center justify-between text-xs"><span className="truncate text-slate-500">{m.email}</span><Badge tone={m.role === 'employee' ? 'low' : m.role === 'manager' ? 'Active' : 'Shared'}>{roleLabel(m.role)}</Badge></div></Card>
        ))}
      </div>
    </>
  )
}

const CHANNELS = ['general', 'projects', 'finance', 'support']
export function Messages() {
  const [channel, setChannel] = useState('general')
  const { data, error, loading, reload } = useApi<any[]>(`/v2/messages?channel=${channel}`, [channel])
  const [text, setText] = useState('')
  const { busy, run } = useAction()
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView() }, [data])
  async function send(e: FormEvent) { e.preventDefault(); if (!text.trim()) return; if (await run(() => api('/v2/messages', { method: 'POST', body: { channel, body: text } }))) { setText(''); reload() } }
  return (
    <>
      <PageHeader title="Messages" subtitle="Channel conversations with your team." />
      <Tabs tabs={CHANNELS.map(c => ({ id: c, label: '# ' + c }))} value={channel} onChange={setChannel} />
      <Card className="flex h-[60vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? <Empty icon="mail" title="No messages yet" text="Say hello to your team." /> : data.map(m => (
            <div key={m.id} className="flex gap-3"><Avatar name={m.sender?.full_name} /><div className="min-w-0"><p className="text-sm"><span className="font-medium">{m.sender?.full_name}</span> <span className="text-xs text-slate-400">{ago(m.created_at)}</span></p>
              <div className="prose-msg break-words text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: m.body }} /></div></div>
          ))}
          <div ref={end} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3"><input value={text} onChange={e => setText(e.target.value)} placeholder={`Message #${channel}`} maxLength={2000} /><Button disabled={busy}>Send</Button></form>
      </Card>
    </>
  )
}

export function Search() {
  const [sp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const { data, error, loading } = useApi<any>(`/v2/search?q=${encodeURIComponent(q)}`, [q])
  const total = data ? data.projects.length + data.documents.length + data.customers.length : 0
  return (
    <>
      <PageHeader title="Search" subtitle={q ? `Results for “${q}”` : 'Search your workspace'} />
      {loading ? <Loading /> : error ? <ErrorState message={error} /> : total === 0 ? (
        <Card><div className="px-6 py-14 text-center"><p className="text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: q ? `No results found for <b>${q}</b>` : 'Type something to search.' }} /></div></Card>
      ) : (
        <div className="space-y-6">
          {([['Projects', 'projects', (x: any) => `/projects/${x.id}`, (x: any) => x.name, (x: any) => x.status], ['Documents', 'documents', (x: any) => `/documents/${x.id}`, (x: any) => x.title, (x: any) => x.status], ['Customers', 'customers', (x: any) => `/customers/${x.id}`, (x: any) => x.name, (x: any) => x.industry]] as const).map(([title, key, href, name, meta]) => data[key].length > 0 && (
            <Card key={key} title={title}><ul className="divide-y divide-slate-100">{data[key].map((x: any) => <li key={x.id}><Link to={href(x)} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"><span className="text-sm font-medium">{name(x)}</span><span className="text-xs text-slate-400">{meta(x)}</span></Link></li>)}</ul></Card>
          ))}
        </div>
      )}
    </>
  )
}
