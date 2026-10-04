import { FormEvent, ReactNode, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Badge, Bars, Button, Card, Empty, ErrorState, Field, Loading, Modal, PageHeader, Stat, Table, Td, useAction, useToast, cx } from '../lib/ui'
import { ago, date, dateTime, money, num } from '../lib/format'

function DevLayout({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const { isManager } = useAuth()
  const links = [['/developer', 'Overview'], ['/developer/api-keys', 'API keys'], ['/developer/usage', 'Usage'], ...(isManager ? [['/developer/logs', 'Logs']] : []), ['/developer/models', 'Models'], ['/developer/docs', 'Docs']]
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">{links.map(([to, l]) => <NavLink key={to} to={to} end className={({ isActive }) => cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{l}</NavLink>)}</nav>
      {children}
    </>
  )
}

export function DevOverview() {
  const u = useApi<any>('/v2/developer/usage?days=14')
  const k = useApi<any[]>('/v2/developer/keys')
  return (
    <DevLayout title="API Platform" subtitle="Build with Mibyan models using training keys." actions={<Link to="/developer/api-keys"><Button>Create API key</Button></Link>}>
      {u.loading ? <Loading /> : u.error ? <ErrorState message={u.error} onRetry={u.reload} /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat label="Requests (14d)" value={num(u.data.totals.requests)} /><Stat label="Spend (14d)" value={'$' + u.data.totals.cost.toFixed(2)} /><Stat label="Active keys" value={k.data?.filter(x => x.status === 'Active').length ?? '-'} /><Stat label="Models in use" value={u.data.models.length} /></div>
          <Card title="Requests per day"><div className="p-5">{u.data.daily.length ? <Bars label="Requests per day" data={u.data.daily.map((d: any) => ({ label: date(d.day), value: d.requests }))} /> : <Empty icon="chart" title="No usage yet" />}</div></Card>
          <Card title="Quick start"><pre className="overflow-x-auto p-5 text-xs leading-relaxed text-slate-700">{`curl -X POST ${location.origin}/api/v2/chat/completions \\
  -H "Authorization: Bearer mb_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"mibyan-fast","messages":[{"role":"user","content":"Hello"}]}'`}</pre></Card>
        </div>)}
    </DevLayout>
  )
}

export function ApiKeys() {
  const { data, error, loading, reload } = useApi<any[]>('/v2/developer/keys')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['chat'])
  const [secret, setSecret] = useState<string | null>(null)
  const { busy, run } = useAction()
  const toast = useToast()
  async function create(e: FormEvent) {
    e.preventDefault()
    const r = await run(() => api<any>('/v2/developer/keys', { method: 'POST', body: { name, scopes } }))
    if (r) { setOpen(false); setName(''); setSecret(r.secret); reload() }
  }
  const act = async (id: string, what: 'activate' | 'revoke') => { if (what === 'revoke' && !confirm('Revoke this key? Applications using it will stop working.')) return; if (await run(() => api(`/v2/developer/keys/${id}/${what}`, { method: 'POST' }), what === 'revoke' ? 'Key revoked' : 'Key activated')) reload() }
  return (
    <DevLayout title="API keys" subtitle="Keys authenticate requests to the Mibyan gateway." actions={<Button onClick={() => setOpen(true)}>Create key</Button>}>
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card>{!data?.length ? <Empty icon="key" title="No API keys" text="Create a key to call the API." /> : (
          <Table head={['Name', 'Key', 'Scopes', 'Status', 'Last used', 'Created', '']}>
            {data.map(k => <tr key={k.id}><Td><span className="font-medium">{k.name}</span><p className="text-xs text-slate-400">{k.owner?.full_name}</p></Td><Td className="font-mono text-xs">{k.prefix}…</Td><Td>{k.scopes.join(', ')}</Td><Td><Badge>{k.status}</Badge></Td><Td>{ago(k.last_used_at)}</Td><Td>{date(k.created_at)}</Td>
              <Td className="text-right whitespace-nowrap">{k.status === 'Created' && <Button small variant="secondary" onClick={() => act(k.id, 'activate')} disabled={busy}>Activate</Button>} {k.status !== 'Revoked' && <Button small variant="ghost" onClick={() => act(k.id, 'revoke')} disabled={busy}>Revoke</Button>}</Td></tr>)}
          </Table>)}</Card>)}
      <Modal open={open} onClose={() => setOpen(false)} title="Create API key"><form onSubmit={create} className="space-y-4">
        <Field label="Name"><input required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Staging gateway" /></Field>
        <Field label="Scopes"><div className="flex gap-4 text-sm">{['chat', 'knowledge', 'embeddings'].map(s => <label key={s} className="!mb-0 flex items-center gap-1.5 !text-sm !font-normal"><input type="checkbox" checked={scopes.includes(s)} onChange={e => setScopes(e.target.checked ? [...scopes, s] : scopes.filter(x => x !== s))} />{s}</label>)}</div></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>Create</Button></div></form></Modal>
      <Modal open={!!secret} onClose={() => setSecret(null)} title="Your new API key"><div className="space-y-4"><p className="text-sm text-slate-600">Copy this key now — it won’t be shown again. New keys must be activated before use.</p><input readOnly value={secret ?? ''} onFocus={e => e.target.select()} className="font-mono text-xs" /><div className="flex justify-end"><Button onClick={() => navigator.clipboard?.writeText(secret ?? '').then(() => toast('Copied'))}>Copy key</Button></div></div></Modal>
    </DevLayout>
  )
}

export function Usage() {
  const [days, setDays] = useState(14)
  const { data, error, loading, reload } = useApi<any>(`/v2/developer/usage?days=${days}`, [days])
  return (
    <DevLayout title="Usage" subtitle="Requests, tokens and spend across your organization." actions={<select aria-label="Range" className="!w-auto" value={days} onChange={e => setDays(+e.target.value)}><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></select>}>
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4"><Stat label="Requests" value={num(data.totals.requests)} /><Stat label="Spend" value={'$' + data.totals.cost.toFixed(2)} /></div>
          <Card title="Daily requests"><div className="p-5">{data.daily.length ? <Bars label="Daily requests" data={data.daily.map((d: any) => ({ label: date(d.day), value: d.requests }))} /> : <Empty icon="chart" title="No usage in this period" />}</div></Card>
          <Card title="By model"><Table head={['Model', 'Requests', 'Tokens', 'Cost']}>{data.models.map((m: any) => <tr key={m.model}><Td className="font-mono text-xs">{m.model}</Td><Td>{num(m.requests)}</Td><Td>{num(m.tokens)}</Td><Td>${m.cost.toFixed(2)}</Td></tr>)}</Table></Card>
        </div>)}
    </DevLayout>
  )
}

export function Logs() {
  const { isManager } = useAuth()
  const { data, error, loading, reload } = useApi<any[]>(isManager ? '/v2/developer/logs' : null)
  return (
    <DevLayout title="Request logs" subtitle="Most recent 100 requests.">
      {!isManager ? <Card><Empty icon="shield" title="Logs are restricted" text="Request logs are available to managers and administrators." /></Card> : loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card>{!data?.length ? <Empty title="No requests logged" /> : <Table head={['Time', 'Request', 'Status', 'Latency', 'Model', 'Key']}>{data.map(l => <tr key={l.id}><Td className="whitespace-nowrap">{dateTime(l.created_at)}</Td><Td className="font-mono text-xs">{l.method} {l.path}</Td><Td><Badge tone={l.status_code < 300 ? 'Active' : l.status_code < 500 ? 'Review' : 'Revoked'}>{String(l.status_code)}</Badge></Td><Td>{l.latency_ms} ms</Td><Td className="font-mono text-xs">{l.model}</Td><Td className="font-mono text-xs">{l.key?.prefix}…</Td></tr>)}</Table>}</Card>)}
    </DevLayout>
  )
}

export function DevModels() {
  const { data, error, loading, reload } = useApi<any[]>('/v2/ai/models')
  return (
    <DevLayout title="Models" subtitle="Model identifiers for API requests.">
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : <Card><Table head={['Model ID', 'Name', 'Tier', 'Context', 'Price / 1K', 'Status']}>{data?.map(m => <tr key={m.id}><Td className="font-mono text-xs">{m.id}</Td><Td>{m.name}</Td><Td className="capitalize">{m.tier}</Td><Td>{num(m.context_window)}</Td><Td>${m.price_per_1k}</Td><Td><Badge tone={m.status}>{m.status}</Badge></Td></tr>)}</Table></Card>}
    </DevLayout>
  )
}

export function DevDocs() {
  const { data, error, loading, reload } = useApi<any>('/v2/developer/docs')
  return (
    <DevLayout title="Documentation" subtitle="Reference for the Mibyan gateway.">
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="space-y-6">
          <Card title="Authentication"><div className="space-y-2 p-5 text-sm text-slate-600"><p>Send your key in the <code className="rounded bg-slate-100 px-1">Authorization</code> header:</p><pre className="rounded-lg bg-slate-50 p-3 text-xs">{data.auth}</pre><p className="text-xs text-slate-400">{data.notes}</p></div></Card>
          {data.endpoints.map((e: any) => <Card key={e.path} title={<span><span className="mr-2 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs text-brand-700">{e.method}</span><span className="font-mono text-sm">{e.path}</span></span>}><div className="p-5 text-sm text-slate-600"><p>{e.description}</p>{e.body && <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(e.body, null, 2)}</pre>}</div></Card>)}
        </div>)}
    </DevLayout>
  )
}
