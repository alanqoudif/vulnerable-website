import { FormEvent, useEffect, useState } from 'react'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Avatar, Badge, Button, Card, Empty, ErrorState, Field, Loading, Modal, PageHeader, Table, Td, useAction, useToast } from '../lib/ui'
import { ago, date, dateTime, roleLabel } from '../lib/format'

export function Members() {
  const { isAdmin, me } = useAuth()
  const { data, error, loading, reload } = useApi<any[]>('/v2/members')
  const { busy, run } = useAction()
  const setRole = async (u: string, role: string) => { if (await run(() => api(`/v2/members/${u}`, { method: 'PATCH', body: { role } }), 'Role updated')) reload() }
  const remove = async (m: any) => { if (confirm(`Remove ${m.full_name} from the organization?`) && (await run(() => api(`/v2/members/${m.user_id}`, { method: 'DELETE' }), 'Member removed'))) reload() }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <>
      <PageHeader title="Members" subtitle="Manage who has access to this organization." />
      <Card><Table head={['Member', 'Title', 'Role', 'Joined', '']}>
        {data?.map(m => <tr key={m.user_id}><Td><span className="flex items-center gap-3"><Avatar name={m.full_name} /><span><span className="block font-medium">{m.full_name}</span><span className="text-xs text-slate-400">{m.email}</span></span></span></Td><Td>{m.title}</Td>
          <Td>{isAdmin && m.user_id !== me?.user.id ? <select aria-label="Role" className="!w-auto !py-1 text-xs" value={m.role} disabled={busy} onChange={e => setRole(m.user_id, e.target.value)}><option value="employee">Employee</option><option value="manager">Manager</option><option value="organization_admin">Administrator</option></select> : <Badge tone={m.role === 'employee' ? 'low' : 'Active'}>{roleLabel(m.role)}</Badge>}</Td><Td>{date(m.joined_at)}</Td>
          <Td className="text-right">{isAdmin && m.user_id !== me?.user.id && <Button small variant="ghost" onClick={() => remove(m)}>Remove</Button>}</Td></tr>)}
      </Table></Card>
    </>
  )
}

export function Invitations() {
  const { isAdmin } = useAuth()
  const { data, error, loading, reload } = useApi<any[]>('/v2/invitations')
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ email: '', role: 'employee' })
  const { busy, run } = useAction()
  const toast = useToast()
  async function create(e: FormEvent) { e.preventDefault(); if (await run(() => api('/v2/invitations', { method: 'POST', body: f }), 'Invitation created')) { setOpen(false); setF({ email: '', role: 'employee' }); reload() } }
  const send = async (id: string) => { if (await run(() => api(`/v2/invitations/${id}/send`, { method: 'POST' }), 'Invitation sent')) reload() }
  const cancel = async (id: string) => { if (confirm('Cancel this invitation?') && (await run(() => api(`/v2/invitations/${id}`, { method: 'DELETE' }), 'Invitation cancelled'))) reload() }
  return (
    <>
      <PageHeader title="Invitations" subtitle="Invite colleagues to join your organization." actions={<Button onClick={() => setOpen(true)}>Invite someone</Button>} />
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card>{!data?.length ? <Empty icon="mail" title="No invitations" /> : <Table head={['Email', 'Role', 'Status', 'Invited by', 'Expires', '']}>
          {data.map(i => <tr key={i.id}><Td className="font-medium">{i.email}</Td><Td>{roleLabel(i.role)}</Td><Td><Badge>{i.status}</Badge></Td><Td>{i.inviter?.full_name}</Td><Td>{date(i.expires_at)}</Td>
            <Td className="text-right whitespace-nowrap">{i.status === 'Created' && <Button small variant="secondary" onClick={() => send(i.id)} disabled={busy}>Send</Button>}{i.status === 'Sent' && <Button small variant="ghost" onClick={() => navigator.clipboard?.writeText(`${location.origin}/invite/${i.token}`).then(() => toast('Invite link copied'))}>Copy link</Button>}{isAdmin && i.status !== 'Member Created' && <Button small variant="ghost" onClick={() => cancel(i.id)}>Cancel</Button>}</Td></tr>)}
        </Table>}</Card>)}
      <Modal open={open} onClose={() => setOpen(false)} title="Invite someone"><form onSubmit={create} className="space-y-4">
        <Field label="Work email"><input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role"><select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="employee">Employee</option>{isAdmin && <option value="manager">Manager</option>}</select></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>Create invitation</Button></div></form></Modal>
    </>
  )
}

export function OrgSettings() {
  const { isAdmin, refresh } = useAuth()
  const { data, error, loading, reload } = useApi<any>('/v2/org')
  const [f, setF] = useState<any>(null)
  const { busy, run } = useAction()
  useEffect(() => { if (data) setF({ name: data.name, billing_email: data.billing_email ?? '', industry: data.industry ?? '' }) }, [data])
  if (loading || !f) return error ? <ErrorState message={error} onRetry={reload} /> : <Loading />
  const save = async (e: FormEvent) => { e.preventDefault(); if (await run(() => api('/v2/org/settings', { method: 'PATCH', body: f }), 'Settings saved')) { reload(); void refresh() } }
  return (
    <>
      <PageHeader title="Organization settings" subtitle="Workspace profile and billing contact." />
      <Card className="max-w-2xl"><form onSubmit={save} className="space-y-4 p-5">
        <Field label="Organization name"><input value={f.name} disabled={!isAdmin} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Industry"><input value={f.industry} disabled={!isAdmin} onChange={e => setF({ ...f, industry: e.target.value })} /></Field>
        <Field label="Billing email"><input type="email" value={f.billing_email} disabled={!isAdmin} onChange={e => setF({ ...f, billing_email: e.target.value })} /></Field>
        <dl className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm"><div><dt className="text-xs text-slate-400">Workspace URL</dt><dd>{data.slug}.nuqta-demo.test</dd></div><div><dt className="text-xs text-slate-400">Plan</dt><dd className="capitalize">{data.plan}</dd></div><div><dt className="text-xs text-slate-400">Created</dt><dd>{date(data.created_at)}</dd></div></dl>
        {isAdmin ? <div className="flex justify-end"><Button disabled={busy}>Save changes</Button></div> : <p className="text-xs text-slate-400">Only administrators can edit these settings.</p>}
      </form></Card>
    </>
  )
}

export function AuditLog() {
  const { data, error, loading, reload } = useApi<any[]>('/v2/audit')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <>
      <PageHeader title="Audit log" subtitle="Security-relevant activity in your organization." />
      <Card>{!data?.length ? <Empty icon="list" title="No events recorded" /> : <Table head={['When', 'Actor', 'Event', 'Object', 'IP']}>{data.map(a => <tr key={a.id}><Td className="whitespace-nowrap">{dateTime(a.created_at)} <span className="text-xs text-slate-400">({ago(a.created_at)})</span></Td><Td>{a.actor?.full_name ?? 'System'}</Td><Td className="font-mono text-xs">{a.action}</Td><Td className="text-xs text-slate-500">{a.entity_type}</Td><Td className="font-mono text-xs">{a.ip}</Td></tr>)}</Table>}</Card>
    </>
  )
}
