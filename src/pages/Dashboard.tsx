import { Link } from 'react-router-dom'
import { useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Badge, Bars, Card, Empty, ErrorState, Loading, PageHeader, Stat } from '../lib/ui'
import { ago, date, money, num } from '../lib/format'

const label = (a: string) => a.replace('.', ' · ').replace(/_/g, ' ')

export default function Dashboard() {
  const { me, activeOrg } = useAuth()
  const { data: d, error, loading, reload } = useApi<any>('/v2/dashboard')
  if (loading) return <Loading />
  if (error || !d) return <ErrorState message={error ?? 'No data'} onRetry={reload} />
  return (
    <>
      <PageHeader title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${me?.user.full_name.split(' ')[0]}`} subtitle={`Here’s what’s happening at ${activeOrg?.name}.`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active projects" value={d.stats.activeProjects} />
        <Stat label="Open tasks" value={d.stats.openTasks} />
        <Stat label="API requests (14d)" value={num(d.stats.apiRequests14d)} />
        <Stat label="Outstanding" value={money(d.stats.outstanding)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Mibyan API activity" className="lg:col-span-2" action={<span className="text-xs text-slate-400">{num(d.stats.mibyanTokens14d)} tokens · 14 days</span>}>
          <div className="p-5">{d.usageSeries.length ? <Bars label="Requests per day" data={d.usageSeries.map((x: any) => ({ label: date(x.day), value: x.requests }))} /> : <Empty title="No API usage yet" text="Create an API key to start sending requests." icon="chart" />}</div>
        </Card>
        <Card title="My tasks" action={<Link to="/tasks" className="text-xs text-brand-600">View all</Link>}>
          {d.myTasks.length === 0 ? <Empty title="You’re all caught up" icon="check" /> : <ul className="divide-y divide-slate-100">{d.myTasks.map((t: any) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{t.title}</p><p className="truncate text-xs text-slate-500">{t.project?.name} · due {date(t.due_date)}</p></div><Badge tone={t.priority}>{t.priority}</Badge></li>))}</ul>}
        </Card>
        <Card title="Active projects" action={<Link to="/projects" className="text-xs text-brand-600">All projects</Link>}>
          {d.projects.length === 0 ? <Empty title="No projects yet" /> : <ul className="divide-y divide-slate-100">{d.projects.map((p: any) => (
            <li key={p.id}><Link to={`/projects/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="text-xs text-slate-500">{p.owner?.full_name}</p></div><Badge>{p.status}</Badge></Link></li>))}</ul>}
        </Card>
        <Card title="Recent documents" action={<Link to="/documents" className="text-xs text-brand-600">All documents</Link>}>
          {d.recentDocuments.length === 0 ? <Empty title="No shared documents" icon="doc" /> : <ul className="divide-y divide-slate-100">{d.recentDocuments.map((x: any) => (
            <li key={x.id}><Link to={`/documents/${x.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"><p className="truncate text-sm font-medium">{x.title}</p><span className="shrink-0 text-xs text-slate-400">{ago(x.updated_at)}</span></Link></li>))}</ul>}
        </Card>
        <Card title="Recent Mibyan conversations" action={<Link to="/mibyan/conversations" className="text-xs text-brand-600">All</Link>}>
          {d.conversations.length === 0 ? <Empty title="No conversations yet" icon="chat" action={<Link to="/mibyan/chat" className="text-sm text-brand-600">Start a chat</Link>} /> : <ul className="divide-y divide-slate-100">{d.conversations.map((x: any) => (
            <li key={x.id}><Link to={`/mibyan/chat/${x.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"><p className="truncate text-sm font-medium">{x.title}</p><span className="shrink-0 text-xs text-slate-400">{ago(x.updated_at)}</span></Link></li>))}</ul>}
        </Card>
        <Card title="Team activity">
          {d.activity.length === 0 ? <Empty title="No activity yet" /> : <ul className="divide-y divide-slate-100">{d.activity.map((a: any) => (
            <li key={a.id} className="px-5 py-3"><p className="text-sm"><span className="font-medium">{a.actor?.full_name ?? 'Someone'}</span> <span className="text-slate-500">{label(a.action)}</span></p><p className="text-xs text-slate-400">{ago(a.created_at)}</p></li>))}</ul>}
        </Card>
        <Card title="Invoices" className="lg:col-span-3" action={<Link to="/finance/invoices" className="text-xs text-brand-600">All invoices</Link>}>
          {d.invoices.length === 0 ? <Empty title="No invoices" icon="invoice" /> : <div className="grid divide-y divide-slate-100 sm:grid-cols-5 sm:divide-x sm:divide-y-0">{d.invoices.map((i: any) => (
            <Link key={i.id} to={`/finance/invoices/${i.id}`} className="p-4 hover:bg-slate-50"><p className="text-xs text-slate-400">{i.number}</p><p className="mt-0.5 text-sm font-semibold">{money(i.total, i.currency)}</p><div className="mt-1"><Badge>{i.status}</Badge></div></Link>))}</div>}
        </Card>
      </div>
    </>
  )
}
