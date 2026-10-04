import { FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Badge, Button, Card, Empty, ErrorState, Field, Loading, Modal, PageHeader, Stat, Table, Td, Tabs, useAction } from '../lib/ui'
import { date, money, num } from '../lib/format'

const FLOW = ['Draft', 'Sent', 'Approved', 'Paid']

export function Invoices() {
  const { isManager } = useAuth()
  const { data, error, loading, reload } = useApi<any[]>('/v2/invoices')
  const customers = useApi<any[]>(isManager ? '/v2/customers' : null)
  const [filter, setFilter] = useState('All')
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<any>({ customer_id: '', due_date: '', items: [{ description: '', quantity: 1, unit_price: 0 }] })
  const { busy, run } = useAction()
  async function create(e: FormEvent) { e.preventDefault(); if (await run(() => api('/v2/invoices', { method: 'POST', body: f }), 'Invoice created')) { setOpen(false); reload() } }
  const setItem = (i: number, k: string, v: any) => setF({ ...f, items: f.items.map((it: any, j: number) => (j === i ? { ...it, [k]: v } : it)) })
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const rows = (data ?? []).filter(i => filter === 'All' || i.status === filter)
  const open$ = (data ?? []).filter(i => i.status !== 'Paid').reduce((s, i) => s + Number(i.total), 0)
  return (
    <>
      <PageHeader title="Invoices" subtitle="Billing for customer engagements." actions={isManager && <Button onClick={() => setOpen(true)}>New invoice</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat label="Outstanding" value={money(open$)} /><Stat label="Paid" value={(data ?? []).filter(i => i.status === 'Paid').length} /><Stat label="Awaiting approval" value={(data ?? []).filter(i => i.status === 'Sent').length} /><Stat label="Drafts" value={(data ?? []).filter(i => i.status === 'Draft').length} /></div>
      <Tabs tabs={['All', ...FLOW].map(s => ({ id: s, label: s }))} value={filter} onChange={setFilter} />
      <Card>{rows.length === 0 ? <Empty icon="invoice" title="No invoices" /> : (
        <Table head={['Number', 'Customer', 'Owner', 'Status', 'Due', 'Total']}>{rows.map(i => <tr key={i.id} className="hover:bg-slate-50"><Td><Link to={`/finance/invoices/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700">{i.number}</Link></Td><Td>{i.customer?.name ?? '-'}</Td><Td>{i.owner?.full_name}</Td><Td><Badge>{i.status}</Badge></Td><Td>{date(i.due_date)}</Td><Td className="font-medium">{money(i.total, i.currency)}</Td></tr>)}</Table>)}</Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New invoice" wide><form onSubmit={create} className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><Field label="Customer"><select value={f.customer_id} onChange={e => setF({ ...f, customer_id: e.target.value })}><option value="">Select…</option>{customers.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Due date"><input type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></Field></div>
        <div className="space-y-2">{f.items.map((it: any, i: number) => <div key={i} className="grid grid-cols-[1fr_5rem_6rem] gap-2"><input required placeholder="Description" value={it.description} onChange={e => setItem(i, 'description', e.target.value)} /><input type="number" step="any" placeholder="Qty" value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} /><input type="number" step="any" min="0" placeholder="Price" value={it.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} /></div>)}
          <Button type="button" variant="ghost" small onClick={() => setF({ ...f, items: [...f.items, { description: '', quantity: 1, unit_price: 0 }] })}>+ Add line</Button></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>Create draft</Button></div></form></Modal>
    </>
  )
}

export function InvoiceDetail() {
  const { id } = useParams()
  const { isManager } = useAuth()
  const { data: inv, error, loading, reload } = useApi<any>(`/v2/invoices/${id}`)
  const { busy, run } = useAction()
  const [credit, setCredit] = useState('')
  if (loading) return <Loading />
  if (error || !inv) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />
  const next = FLOW[FLOW.indexOf(inv.status) + 1]
  const move = async () => { if (await run(() => api(`/v2/invoices/${inv.id}/transition`, { method: 'POST', body: { to: next } }), `Invoice marked ${next.toLowerCase()}`)) reload() }
  const applyCredit = async (e: FormEvent) => { e.preventDefault(); if (await run(() => api(`/v2/invoices/${inv.id}/apply-credit`, { method: 'POST', body: { amount: credit } }), 'Credit applied')) { setCredit(''); reload() } }
  return (
    <>
      <p className="mb-2 text-sm"><Link to="/finance/invoices" className="text-slate-500 hover:text-slate-800">Invoices</Link></p>
      <PageHeader title={inv.number} subtitle={inv.customer?.name} actions={<><Badge>{inv.status}</Badge>{next && <Button onClick={move} disabled={busy}>{next === 'Sent' ? 'Send invoice' : next === 'Approved' ? 'Approve' : 'Mark as paid'}</Button>}</>} />
      <div className="mb-6 flex items-center gap-1">{FLOW.map(s => <div key={s} className="flex-1"><div className={`h-1.5 rounded-full ${FLOW.indexOf(s) <= FLOW.indexOf(inv.status) ? 'bg-brand-600' : 'bg-slate-200'}`} /><p className="mt-1 text-center text-[11px] text-slate-400">{s}</p></div>)}</div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Line items" className="lg:col-span-2"><Table head={['Description', 'Qty', 'Unit price', 'Amount']}>{inv.items.map((i: any) => <tr key={i.id}><Td>{i.description}</Td><Td>{num(i.quantity)}</Td><Td>{money(i.unit_price, inv.currency)}</Td><Td className="font-medium">{money(i.amount, inv.currency)}</Td></tr>)}</Table>
          <dl className="space-y-1 border-t border-slate-100 p-5 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{money(inv.subtotal, inv.currency)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">VAT (5%)</dt><dd>{money(inv.tax, inv.currency)}</dd></div>{Number(inv.credit_applied) > 0 && <div className="flex justify-between"><dt className="text-slate-500">Credit applied</dt><dd>-{money(inv.credit_applied, inv.currency)}</dd></div>}<div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold"><dt>Total</dt><dd>{money(inv.total, inv.currency)}</dd></div></dl></Card>
        <div className="space-y-6"><Card title="Details"><dl className="space-y-3 p-5 text-sm"><div><dt className="text-xs text-slate-400">Customer</dt><dd>{inv.customer?.name}</dd></div><div><dt className="text-xs text-slate-400">Owner</dt><dd>{inv.owner?.full_name}</dd></div><div><dt className="text-xs text-slate-400">Issued</dt><dd>{date(inv.issued_at)}</dd></div><div><dt className="text-xs text-slate-400">Due</dt><dd>{date(inv.due_date)}</dd></div></dl></Card>
          {isManager && inv.status === 'Approved' && <Card title="Apply account credit"><form onSubmit={applyCredit} className="space-y-3 p-5"><input type="number" step="0.01" min="0.01" required value={credit} onChange={e => setCredit(e.target.value)} placeholder="Amount" /><Button className="w-full" disabled={busy}>Apply credit</Button></form></Card>}</div>
      </div>
    </>
  )
}

export function Plans() {
  const { data, error, loading, reload } = useApi<any>('/v2/plans')
  if (loading) return <Loading />
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={reload} />
  return (
    <>
      <PageHeader title="Plans" subtitle={`Your organization is on the ${data.plans.find((p: any) => p.id === data.current)?.name} plan · ${data.seats_used} seats in use.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.plans.map((p: any) => (
        <Card key={p.id} className={`p-5 ${p.id === data.current ? 'ring-2 ring-brand-500' : ''}`}><div className="flex items-center justify-between"><p className="font-semibold">{p.name}</p>{p.id === data.current && <Badge tone="Active">Current</Badge>}</div>
          <p className="mt-3 text-3xl font-semibold">${Number(p.price_monthly).toFixed(0)}<span className="text-sm font-normal text-slate-400">/mo</span></p><p className="mt-2 text-sm text-slate-500">{p.description}</p>
          <ul className="mt-4 space-y-1 text-sm text-slate-600"><li>{num(p.seats)} seats</li><li>{num(p.ai_tokens)} Mibyan tokens</li></ul></Card>))}</div>
      {data.credit_balance !== null && <Card className="mt-6 p-5"><p className="text-xs uppercase tracking-wide text-slate-400">Account credit</p><p className="mt-1 text-2xl font-semibold">{money(data.credit_balance)}</p></Card>}
    </>
  )
}
