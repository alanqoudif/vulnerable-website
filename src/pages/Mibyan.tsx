import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Avatar, Badge, Button, Card, Empty, ErrorState, Field, Icon, Loading, Modal, PageHeader, Spinner, Table, Td, Tabs, useAction, useToast, cx } from '../lib/ui'
import { ago, bytes, dateTime, num } from '../lib/format'

function Bubble({ role, content, attachment }: { role: string; content: string; attachment?: any }) {
  const user = role === 'user'
  return (
    <div className={cx('flex gap-3', user && 'flex-row-reverse')}>
      {user ? null : <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Icon name="spark" className="h-4 w-4" /></span>}
      <div className={cx('max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed', user ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800')}>
        {attachment && <p className="mb-1.5 inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-xs"><Icon name="clip" className="h-3 w-3" />{attachment.name}</p>}
        {attachment && <br />}{content}
      </div>
    </div>
  )
}

export function Chat() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const list = useApi<any[]>('/v2/ai/conversations')
  const models = useApi<any[]>('/v2/ai/models')
  const conv = useApi<any>(id ? `/v2/ai/conversations/${id}` : null, [id])
  const [model, setModel] = useState('mibyan-4.1')
  const [text, setText] = useState('')
  const [pending, setPending] = useState<{ role: string; content: string }[]>([])
  const [sending, setSending] = useState(false)
  const [attach, setAttach] = useState<any>(null)
  const [listOpen, setListOpen] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [conv.data, pending])
  useEffect(() => { if (conv.data?.model) setModel(conv.data.model) }, [conv.data?.model])
  useEffect(() => { setPending([]); setListOpen(false) }, [id])

  async function pickFile(f?: File) {
    if (!f) return
    if (f.size > 500_000) return toast('Attachments are limited to 500 KB', 'err')
    const buf = new Uint8Array(await f.arrayBuffer())
    let bin = ''; buf.forEach(b => (bin += String.fromCharCode(b)))
    try { setAttach(await api('/v2/files', { method: 'POST', body: { bucket: 'documents', name: f.name, mime_type: f.type || 'text/plain', content_base64: btoa(bin), visibility: 'private' } })) } catch (e: any) { toast(e.message, 'err') }
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true); setText('')
    try {
      let cid = id
      if (!cid) { const c = await api<any>('/v2/ai/conversations', { method: 'POST', body: { model, title: 'New conversation' } }); cid = c.id }
      else if (conv.data && conv.data.model !== model && conv.data.mine) await api(`/v2/ai/conversations/${cid}`, { method: 'PATCH', body: { model } })
      setPending([{ role: 'user', content }])
      await api(`/v2/ai/conversations/${cid}/messages`, { method: 'POST', body: { content, attachment_file_id: attach?.id } })
      setAttach(null)
      if (!id) nav(`/mibyan/chat/${cid}`); else await conv.reload()
      void list.reload()
    } catch (e: any) { toast(e.message, 'err'); setText(content) } finally { setSending(false); setPending([]) }
  }

  const msgs = conv.data?.messages ?? []
  const readOnly = !!id && conv.data && !conv.data.mine
  return (
    <>
      <PageHeader title="AI Chat" subtitle="Ask Mibyan to draft, summarize, analyze or code." actions={<><Button variant="secondary" className="lg:hidden" onClick={() => setListOpen(o => !o)}>Chats</Button><Button variant="secondary" onClick={() => nav('/mibyan/chat')}>New chat</Button></>} />
      <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
        <Card className={cx('max-h-[70vh] overflow-y-auto', !listOpen && 'hidden lg:block')}>
          {list.loading ? <Loading /> : !list.data?.length ? <Empty icon="chat" title="No conversations" /> : <ul className="divide-y divide-slate-100">{list.data.map(c => (
            <li key={c.id}><Link to={`/mibyan/chat/${c.id}`} className={cx('block px-4 py-3 hover:bg-slate-50', c.id === id && 'bg-brand-50')}><p className="truncate text-sm font-medium">{c.title}</p><p className="text-xs text-slate-400">{c.mine ? 'You' : c.owner?.full_name} · {ago(c.updated_at)}</p></Link></li>))}</ul>}
        </Card>
        <Card className="flex h-[70vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
            <p className="truncate text-sm font-medium">{conv.data?.title ?? 'New conversation'}</p>
            <select aria-label="Model" className="!w-auto !py-1 text-xs" value={model} onChange={e => setModel(e.target.value)} disabled={readOnly}>{(models.data ?? [{ id: 'mibyan-4.1', name: 'Mibyan 4.1' }]).filter(m => m.status !== 'deprecated').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {id && conv.loading && !conv.data ? <Loading /> : id && conv.error ? <ErrorState message={conv.error} onRetry={conv.reload} /> : (msgs.length + pending.length === 0 ? <Empty icon="spark" title="How can Mibyan help today?" text="Try: “Summarize our statement of work” or “Draft a tender intro”." /> : <>
              {msgs.map((m: any) => <Bubble key={m.id} role={m.role} content={m.content} attachment={m.attachment} />)}
              {pending.map((m, i) => <Bubble key={i} {...m} />)}
              {sending && <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner className="h-4 w-4" /> Mibyan is thinking…</div>}
            </>)}
            <div ref={end} />
          </div>
          {readOnly ? <p className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-500">You’re viewing a conversation owned by {conv.data.owner?.full_name}.</p> : (
            <form onSubmit={send} className="border-t border-slate-100 p-3">
              {attach && <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs"><Icon name="clip" className="h-3 w-3" />{attach.name}<button type="button" onClick={() => setAttach(null)} aria-label="Remove attachment"><Icon name="x" className="h-3 w-3" /></button></p>}
              <div className="flex items-end gap-2">
                <input ref={fileRef} type="file" hidden onChange={e => void pickFile(e.target.files?.[0])} accept=".txt,.md,.csv,.pdf,.docx" />
                <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()} aria-label="Attach file"><Icon name="clip" /></Button>
                <textarea rows={1} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(e as any) } }} placeholder="Message Mibyan…" className="resize-none" />
                <Button disabled={sending || !text.trim()} aria-label="Send"><Icon name="send" className="h-4 w-4" /></Button>
              </div>
            </form>)}
        </Card>
      </div>
    </>
  )
}

export function Conversations() {
  const { data, error, loading, reload } = useApi<any[]>('/v2/ai/conversations')
  const { busy, run } = useAction()
  const [tab, setTab] = useState('mine')
  const [rename, setRename] = useState<any>(null)
  const [share, setShare] = useState<any>(null)
  const toast = useToast()
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const rows = (data ?? []).filter(c => (tab === 'mine' ? c.mine : !c.mine))
  const link = (t: string) => `${location.origin}/share/${t}`
  const del = async (c: any) => { if (confirm(`Delete “${c.title}”?`) && (await run(() => api(`/v2/ai/conversations/${c.id}`, { method: 'DELETE' }), 'Conversation deleted'))) reload() }
  const doRename = async (e: FormEvent) => { e.preventDefault(); if (await run(() => api(`/v2/ai/conversations/${rename.id}`, { method: 'PATCH', body: { title: rename.title } }), 'Renamed')) { setRename(null); reload() } }
  const toggleShare = async (c: any, enabled: boolean) => { const r = await run(() => api<any>(`/v2/ai/conversations/${c.id}/share`, { method: 'POST', body: { enabled } }), enabled ? 'Sharing enabled' : 'Sharing disabled'); if (r) { setShare(enabled ? r : null); reload() } }
  return (
    <>
      <PageHeader title="Conversations" subtitle="Your Mibyan history and conversations shared with the team." actions={<Link to="/mibyan/chat"><Button>New chat</Button></Link>} />
      <Tabs tabs={[{ id: 'mine', label: 'My conversations' }, { id: 'team', label: 'Shared with team' }]} value={tab} onChange={setTab} />
      <Card>{rows.length === 0 ? <Empty icon="chat" title="Nothing here yet" /> : (
        <Table head={['Title', 'Model', tab === 'mine' ? 'Visibility' : 'Owner', 'Updated', '']}>
          {rows.map(c => <tr key={c.id} className="hover:bg-slate-50"><Td><Link to={`/mibyan/chat/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">{c.title}</Link></Td><Td>{c.model}</Td>
            <Td>{tab === 'mine' ? <Badge tone={c.visibility === 'shared' ? 'Shared' : 'Draft'}>{c.visibility === 'shared' ? 'Shared link' : 'Private'}</Badge> : c.owner?.full_name}</Td><Td>{ago(c.updated_at)}</Td>
            <Td className="text-right">{c.mine ? <span className="inline-flex gap-1"><Button small variant="ghost" onClick={() => setRename({ id: c.id, title: c.title })} aria-label="Rename"><Icon name="edit" className="h-4 w-4" /></Button><Button small variant="ghost" onClick={() => c.visibility === 'shared' ? setShare(c) : toggleShare(c, true)} aria-label="Share"><Icon name="share" className="h-4 w-4" /></Button><Button small variant="ghost" onClick={() => del(c)} aria-label="Delete"><Icon name="trash" className="h-4 w-4" /></Button></span> : c.share_token && <Button small variant="ghost" onClick={() => navigator.clipboard?.writeText(link(c.share_token)).then(() => toast('Link copied'))}>Copy link</Button>}</Td></tr>)}
        </Table>)}</Card>
      <Modal open={!!rename} onClose={() => setRename(null)} title="Rename conversation"><form onSubmit={doRename} className="space-y-4"><input autoFocus value={rename?.title ?? ''} onChange={e => setRename({ ...rename, title: e.target.value })} required /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setRename(null)}>Cancel</Button><Button disabled={busy}>Save</Button></div></form></Modal>
      <Modal open={!!share} onClose={() => setShare(null)} title="Share conversation">
        {share && <div className="space-y-4"><p className="text-sm text-slate-600">Anyone with this link can read the conversation.</p><input readOnly value={link(share.share_token)} onFocus={e => e.target.select()} /><div className="flex justify-between"><Button variant="danger" onClick={() => toggleShare(share, false)} disabled={busy}>Stop sharing</Button><Button onClick={() => navigator.clipboard?.writeText(link(share.share_token)).then(() => toast('Link copied'))}>Copy link</Button></div></div>}
      </Modal>
    </>
  )
}

export function SharedConversation() {
  const { token } = useParams()
  const { data, error, loading } = useApi<any>(`/v2/ai/shared/${token}`)
  return (
    <div className="min-h-full bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white"><span className="h-2.5 w-2.5 rounded-full bg-white" /></span>Nuqta Workspace · Mibyan</p>
        {loading ? <Loading /> : error ? <Card><Empty icon="chat" title="Conversation unavailable" text={error} /></Card> : (
          <Card title={data.title} action={<span className="text-xs text-slate-400">{data.shared_by} · {data.organization}</span>}>
            <div className="space-y-4 p-5">{data.messages.map((m: any) => <Bubble key={m.id} role={m.role} content={m.content} />)}</div>
            {data.meta.citations.length > 0 && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Sources: {data.meta.citations.map((c: any) => c.title).join(', ')}</p>}
          </Card>)}
        <p className="mt-6 text-center text-xs text-slate-400">Shared conversation · read-only</p>
      </div>
    </div>
  )
}

export function Knowledge() {
  const { isManager } = useAuth()
  const { data, error, loading, reload } = useApi<any[]>('/v2/knowledge/bases')
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<any>({ name: '', description: '', visibility: 'org' })
  const { busy, run } = useAction()
  async function create(e: FormEvent) { e.preventDefault(); if (await run(() => api('/v2/knowledge/bases', { method: 'POST', body: f }), 'Collection created')) { setOpen(false); setF({ name: '', description: '', visibility: 'org' }); reload() } }
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <>
      <PageHeader title="Knowledge" subtitle="Reference collections Mibyan can draw on." actions={isManager && <Button onClick={() => setOpen(true)}>New collection</Button>} />
      {!data?.length ? <Card><Empty icon="book" title="No collections" text="Create a collection and upload reference documents." /></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.map(k => (
          <Link key={k.id} to={`/mibyan/knowledge/${k.id}`}><Card className="h-full p-5 transition hover:border-brand-500/50 hover:shadow"><div className="flex items-start justify-between"><span className="rounded-lg bg-brand-50 p-2 text-brand-600"><Icon name="book" /></span>{k.visibility === 'restricted' && <Badge tone="Review">Managers only</Badge>}</div>
            <p className="mt-3 font-medium text-slate-900">{k.name}</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{k.description}</p><p className="mt-3 text-xs text-slate-400">{k.docs?.[0]?.count ?? 0} documents · {k.owner?.full_name}</p></Card></Link>))}</div>)}
      <Modal open={open} onClose={() => setOpen(false)} title="New collection"><form onSubmit={create} className="space-y-4">
        <Field label="Name"><input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Description"><textarea rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Access"><select value={f.visibility} onChange={e => setF({ ...f, visibility: e.target.value })}><option value="org">Everyone in the organization</option><option value="restricted">Managers and administrators</option></select></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>Create</Button></div></form></Modal>
    </>
  )
}

export function KnowledgeDetail() {
  const { id } = useParams()
  const { data: k, error, loading, reload } = useApi<any>(`/v2/knowledge/bases/${id}`)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const { busy, run } = useAction()
  async function upload(e: FormEvent) {
    e.preventDefault(); if (!file) return
    const buf = new Uint8Array(await file.arrayBuffer()); let bin = ''; buf.forEach(b => (bin += String.fromCharCode(b)))
    if (await run(() => api(`/v2/knowledge/bases/${id}/documents`, { method: 'POST', body: { name: file.name, mime_type: file.type || 'text/plain', content_base64: btoa(bin) } }), 'Document uploaded')) { setOpen(false); setFile(null); reload() }
  }
  const advance = async (d: any) => { if (await run(() => api(`/v2/knowledge/documents/${d.id}/advance`, { method: 'POST' }))) reload() }
  const openDoc = async (d: any) => { const r = await run(() => api<any>(`/v2/knowledge/documents/${d.id}`)); if (r) setView(r) }
  if (loading) return <Loading />
  if (error || !k) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />
  return (
    <>
      <p className="mb-2 text-sm"><Link to="/mibyan/knowledge" className="text-slate-500 hover:text-slate-800">Knowledge</Link></p>
      <PageHeader title={k.name} subtitle={k.description} actions={<Button onClick={() => setOpen(true)}><Icon name="upload" className="h-4 w-4" />Upload</Button>} />
      <Card>{k.documents.length === 0 ? <Empty icon="doc" title="No documents" text="Upload PDFs, DOCX or text files." /> : (
        <Table head={['Document', 'Size', 'Tokens', 'Status', 'Uploaded', '']}>
          {k.documents.map((d: any) => <tr key={d.id}><Td><button onClick={() => openDoc(d)} className="text-left font-medium text-slate-900 hover:text-brand-700">{d.title}</button></Td><Td>{bytes(d.file?.size_bytes)}</Td><Td>{num(d.token_count)}</Td><Td><Badge>{d.status}</Badge></Td><Td>{ago(d.created_at)}</Td><Td className="text-right">{d.status !== 'Available' && <Button small variant="secondary" onClick={() => advance(d)} disabled={busy}>{d.status === 'Uploaded' ? 'Start processing' : 'Finish'}</Button>}</Td></tr>)}
        </Table>)}</Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Upload document"><form onSubmit={upload} className="space-y-4"><Field label="File" hint="PDF, DOCX or text. Up to 1 MB."><input type="file" required accept=".pdf,.docx,.txt,.md,.csv" onChange={e => setFile(e.target.files?.[0] ?? null)} /></Field><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !file}>Upload</Button></div></form></Modal>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.title ?? ''} wide>{view && <div className="space-y-3 text-sm"><p className="text-slate-500">{view.collection.name} · {view.status} · {num(view.token_count)} tokens</p><p>{view.summary}</p>{view.preview ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{view.preview}</pre> : <p className="text-xs text-slate-400">Preview is not available for this file type.</p>}</div>}</Modal>
    </>
  )
}

export function Models() {
  const { data, error, loading, reload } = useApi<any[]>('/v2/ai/models')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <>
      <PageHeader title="Models" subtitle="Mibyan models available to your organization." />
      <div className="grid gap-4 sm:grid-cols-2">{data?.map(m => (
        <Card key={m.id} className="p-5"><div className="flex items-start justify-between"><div><p className="font-semibold text-slate-900">{m.name}</p><p className="font-mono text-xs text-slate-400">{m.id}</p></div><Badge tone={m.status}>{m.status}</Badge></div>
          <p className="mt-3 text-sm text-slate-600">{m.description}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-slate-400">Tier</dt><dd className="font-medium capitalize">{m.tier}</dd></div><div><dt className="text-slate-400">Context</dt><dd className="font-medium">{num(m.context_window)}</dd></div><div><dt className="text-slate-400">Per 1K tokens</dt><dd className="font-medium">${m.price_per_1k}</dd></div></dl></Card>))}</div>
    </>
  )
}
