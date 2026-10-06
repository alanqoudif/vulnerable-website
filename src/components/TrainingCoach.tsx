import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'

type Challenge = {
  id: number
  title: string
  hint: string
  firefox: string
  criteria: RegExp[]
}

const challenges: Challenge[] = [
  { id: 1, title: 'What is missing from the list?', hint: 'Compare the customer list response with one customer detail response. Look for internal fields returned only by the detail route.', firefox: 'Open Developer Tools → Network → XHR. Reload Customers, open one synthetic customer, and compare the Response tabs.', criteria: [/internal|private|risk|notes|sensitive/i, /detail|record/i, /list|collection|summary/i] },
  { id: 2, title: 'The team directory', hint: 'Compare the full directory request with the ordinary member list. Check the returned fields and whether the employee role is allowed to call it.', firefox: 'Open Network → XHR on the Team page. Filter for “directory” or “member” and inspect response fields and status.', criteria: [/directory|contact|email|phone/i, /employee|role|permission|manager/i, /list|endpoint|route/i] },
  { id: 3, title: 'Request origin', hint: 'The widget endpoint reflects an arbitrary Origin and allows credentials. Compare this with /api/v2/me; a secure server uses an explicit trusted-origin allow-list.', firefox: 'Use Network → XHR and filter for “widget”. The app does not automatically call this endpoint, so it may not appear on page load. Firefox cannot set the forbidden Origin request header from page JavaScript; inspect the recorded training evidence or use the instructor-approved request capture. Compare Access-Control-Allow-Origin and Access-Control-Allow-Credentials with /api/v2/me.', criteria: [/origin/i, /reflect|echo|arbitrary|untrusted/i, /credential/i, /allow.?list|trusted|explicit/i] },
  { id: 4, title: 'Search with no results', hint: 'On the selected empty-results view, the query is inserted into an HTML sink. Compare the same query with a neighboring search view that renders it as text. Use only the lab’s harmless proof.', firefox: 'Open Network → XHR to inspect the search response. Use Inspector to review the empty-results text. Do not paste executable markup.', criteria: [/query|search|input/i, /html|markup|interpret|render/i, /text|encode|escape|safe/i] },
  { id: 5, title: 'A saved message', hint: 'The selected message feed renders persisted content differently from safe text fields. Confirm persistence after reload and compare the browser rendering.', firefox: 'Open Network → XHR while sending and reopening the synthetic message. Use Inspector to compare its rendered node with a plain text field.', criteria: [/persist|save|reload|stored/i, /message/i, /html|markup|render|execute|interpret/i] },
  { id: 6, title: 'Two account recovery routes', hint: 'Compare the current v2 recovery route with the older v1 route. The legacy path omits the rate limiter. Stop as soon as you confirm a difference.', firefox: 'Open Network → XHR while using the recovery form. Compare route versions and responses. Do not continue repeated submissions after a clear difference.', criteria: [/v1|legacy|older/i, /rate.?limit|throttl/i, /bypass|missing|no limit|unlimited/i] },
  { id: 7, title: 'An older version of project data', hint: 'The selected legacy project route skips the tenant check. The v2 route returns not found for the same foreign synthetic project.', firefox: 'In Network → XHR, capture a normal project ID, then compare only the referenced v1 and v2 reads under Org 2.', criteria: [/v1|legacy|older/i, /cross.?tenant|foreign|other organization/i, /v2|secure|404|denied/i] },
  { id: 8, title: 'A project from another organization', hint: 'Use a project identifier already visible in training data. Compare its detail read across Org 1 and Org 2; do not guess IDs.', firefox: 'Capture a project request under each training account in Network → XHR and compare the response for the same observed ID.', criteria: [/project/i, /other organization|foreign|cross.?tenant/i, /read|detail|access|response/i] },
  { id: 9, title: 'A document with a known identifier', hint: 'A selected document read can return another organization’s synthetic document when its known ID is supplied. Compare with a document your organization owns.', firefox: 'Capture an allowed document ID in Network → XHR. Compare the read while signed in to the other training account; do not enumerate IDs.', criteria: [/document/i, /known|observed|identifier|id/i, /foreign|other organization|cross.?tenant/i] },
  { id: 10, title: 'A knowledge resource', hint: 'A knowledge resource detail lookup omits the owning organization check. Compare list visibility with a single-resource read.', firefox: 'In Network → XHR, capture the knowledge list and detail responses. Compare the same observed synthetic resource across accounts.', criteria: [/knowledge|resource/i, /detail|single|item/i, /organization|tenant|owner|foreign/i] },
  { id: 11, title: 'A private conversation', hint: 'The selected share-view route checks authentication but not conversation ownership or a valid share grant.', firefox: 'Inspect the share-view request in Network → XHR. Compare what the owner sees with the second training account; use only an assigned synthetic conversation.', criteria: [/conversation/i, /private|owner|share/i, /authorization|access|other user|another user/i] },
  { id: 12, title: 'File metadata versus download', hint: 'Metadata and download use different authorization paths. The selected download path can issue a signed URL for a foreign synthetic file.', firefox: 'In Network, compare the file metadata request with its download request. Never copy a temporary signed URL into your report.', criteria: [/metadata|file details/i, /download|signed url/i, /different|separate|authorization|access/i] },
  { id: 13, title: 'Storage attachments', hint: 'The attachment storage policy misses tenant isolation. Compare an observed synthetic attachment under both training organizations.', firefox: 'Capture a normal attachment read in Network. Repeat with the other account using only its observed synthetic path.', criteria: [/attachment|storage|bucket/i, /other organization|foreign|cross.?tenant/i, /policy|permission|access/i] },
  { id: 14, title: 'Project comments', hint: 'The direct comments table read is broader than the application’s project-comment endpoint. Compare row access across organizations.', firefox: 'Compare the app endpoint and the instructor-approved direct read. Use Network for app requests; do not attempt database access beyond the exercise instructions.', criteria: [/comment/i, /direct|table|rls|row/i, /organization|tenant|scoped|unauthorized/i] },
  { id: 15, title: 'An administrative action as an employee', hint: 'The archive endpoint checks authentication and tenant membership but misses the manager role gate. Verify the synthetic project state after the request.', firefox: 'Compare the captured manager action with the same assigned training project as an employee in Network → XHR. Stop if its state changes.', criteria: [/employee|role/i, /archive|administrative|manager/i, /persist|state|status|effect/i] },
  { id: 16, title: 'Account properties', hint: 'The selected profile update accepts a role property and writes it to organization membership. The server should allow-list profile fields and keep role changes separate.', firefox: 'Inspect the normal profile update in Network → XHR. Only use the instructor-assigned low-privilege check and have the instructor verify any role change.', criteria: [/profile|account/i, /role|membership|privilege/i, /allow.?list|server|unauthorized|mass assignment/i] },
  { id: 17, title: 'Inviting a new member', hint: 'One invitation acceptance route trusts a submitted role instead of the role stored on the invitation. Compare with the secure completion route.', firefox: 'Capture the instructor-prepared invite acceptance in Network. Verify the resulting synthetic membership with the instructor.', criteria: [/invitation|invite/i, /submitted|client|provided/i, /stored|assigned|role/i] },
  { id: 18, title: 'Invoice state transitions', hint: 'The selected status endpoint validates the state name but not the allowed transition order. Compare it with the ordered transition route.', firefox: 'Use Network → XHR to inspect the assigned synthetic invoice status change. Confirm the resulting state with a later read and stop.', criteria: [/invoice/i, /transition|workflow|order/i, /invalid|draft.*paid|state|status/i] },
  { id: 19, title: 'Repeating an approval request', hint: 'The selected approval operation lacks an idempotency guard and can create duplicate synthetic audit effects when replayed.', firefox: 'Capture one normal approval request. Repeat it only as the challenge allows and stop at the first duplicate effect.', criteria: [/approval|approve/i, /repeat|replay|duplicate/i, /idempotency|multiple|audit effect/i] },
  { id: 20, title: 'A session that remains active', hint: 'Changing a password does not revoke the old session in the selected flow; explicit session revocation does. Use two training sessions only.', firefox: 'Compare one non-sensitive request in two training sessions before and after the instructor-directed password change. Never expose tokens.', criteria: [/session/i, /password/i, /remain|active|valid|revoke|invalidate/i] },
  { id: 21, title: 'Role context', hint: 'A client-derived role claim is trusted by a selected action. The server should derive authorization from trusted membership data.', firefox: 'Compare the normal account context and the instructor-assigned synthetic setting result in Network. Do not send tokens to external JWT sites.', criteria: [/role|claim|context/i, /client|jwt|token/i, /server|database|membership|trusted/i] },
  { id: 22, title: 'Instructions inside a conversation', hint: 'The deterministic training assistant follows a selected user override phrase and stores the changed response. Compare with an ordinary request.', firefox: 'Save both exchanges. In Network → XHR, inspect the conversation message response and confirm both messages remain in history.', criteria: [/user|message|prompt/i, /override|instruction|change|redirect/i, /persist|history|saved|stored/i] },
  { id: 23, title: 'Instructions inside a knowledge source', hint: 'A seeded adversarial knowledge note is treated as an instruction by the deterministic training flow. Compare a request that retrieves it with a neutral request.', firefox: 'Save both assistant exchanges and inspect the conversation history. Network → XHR shows the message response. This lab uses a deterministic simulation, not a live external model.', criteria: [/knowledge|retrieved|reference|document/i, /instruction|override|untrusted/i, /assistant|behavior|response/i] },
  { id: 24, title: 'Assistant tool authorization', hint: 'The document tool checks that the user is authenticated but omits the document organization predicate. Compare it with the ordinary document route.', firefox: 'Capture the normal document read and assistant tool interaction in Network → XHR. Use only synthetic identifiers already shown in the app.', criteria: [/tool|assistant/i, /document/i, /tenant|organization|authorization|foreign|other organization/i] },
  { id: 25, title: 'Connect knowledge, tool, and result', hint: 'The seeded knowledge instruction can select a vulnerable document tool; that tool can fetch a foreign synthetic board document and persist it in the conversation.', firefox: 'Save and reopen the conversation. Inspect the message and tool-related XHR evidence. Never copy tokens or temporary download links.', criteria: [/knowledge|reference/i, /tool|document/i, /foreign|other organization|board/i, /conversation|persist|saved/i] },
]

function challengesForPath(path: string) {
  const rules: [RegExp, number[]][] = [
    [/^\/customers(?:\/[^/]+)?\/?$/, [1]], [/^\/team\/?$/, [2]], [/^\/developer(?:\/.*)?$/, [3]],
    [/^\/search\/?$/, [4]], [/^\/messages\/?$/, [5]], [/^\/forgot-password$/, [6]], [/^\/account\/profile$/, [16]],
    [/^\/projects\/[^/]+$/, [7, 8, 14, 15]], [/^\/documents\/[^/]+$/, [9, 12]], [/^\/mibyan\/knowledge(?:\/[^/]+)?$/, [10, 23]],
    [/^\/share\/[^/]+$/, [11]], [/^\/documents\/?$/, [13]], [/^\/invite\/[^/]+$/, [17]],
    [/^\/finance\/invoices(?:\/[^/]+)?$/, [18, 19]], [/^\/account\/sessions$/, [20]], [/^\/org\/settings$/, [21]],
    [/^\/mibyan\/chat(?:\/[^/]+)?$/, [22, 24, 25]],
  ]
  return rules.find(([pattern]) => pattern.test(path))?.[1].map(id => challenges[id - 1]) ?? []
}

type SavedAnswer = { text: string; checked: boolean; matched: boolean | null }

export default function TrainingCoach({ path }: { path: string }) {
  const { me } = useAuth()
  const items = useMemo(() => challengesForPath(path), [path])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<number, SavedAnswer>>(() => {
    try { return JSON.parse(localStorage.getItem(`nq_training_answers_${me?.user.id ?? 'trainee'}`) ?? '{}') } catch { return {} }
  })
  useEffect(() => {
    try { setAnswers(JSON.parse(localStorage.getItem(`nq_training_answers_${me?.user.id ?? 'trainee'}`) ?? '{}')) } catch { setAnswers({}) }
  }, [me?.user.id])
  if (!items.length) return null

  const save = (next: Record<number, SavedAnswer>) => {
    setAnswers(next)
    try { localStorage.setItem(`nq_training_answers_${me?.user.id ?? 'trainee'}`, JSON.stringify(next)) } catch { /* local progress is optional */ }
  }
  const selectedItem = items.find(item => item.id === selected) ?? items[0]
  const answer = answers[selectedItem.id] ?? { text: '', checked: false, matched: null }
  const grade = () => {
    const matched = selectedItem.criteria.every(pattern => pattern.test(answer.text))
    save({ ...answers, [selectedItem.id]: { ...answer, matched } })
  }

  return <>
    <button onClick={() => setOpen(v => !v)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-800" aria-expanded={open}>
      <span aria-hidden="true">✦</span> Training help <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{items.length}</span>
    </button>
    {open && <section aria-label="Training challenge helper" className="fixed inset-x-3 bottom-[4.75rem] z-40 max-h-[75vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[min(30rem,calc(100vw-2rem))]">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Training challenge</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedItem.title}</h2><p className="mt-1 text-xs text-slate-500">Challenge {selectedItem.id} · Your notes stay in this browser.</p></div><button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close training help">✕</button></div>
      {items.length > 1 && <label className="mt-4 block text-xs font-medium text-slate-600">Challenge on this page<select className="mt-1" value={selectedItem.id} onChange={e => setSelected(Number(e.target.value))}>{items.map(item => <option key={item.id} value={item.id}>Challenge {item.id}: {item.title}</option>)}</select></label>}
      <details className="mt-4 rounded-xl bg-amber-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-amber-900">Hint</summary><p className="mt-2 text-sm leading-6 text-amber-950">{selectedItem.hint}</p></details>
      <details className="mt-2 rounded-xl bg-blue-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-blue-900">Firefox steps</summary><p className="mt-2 text-sm leading-6 text-blue-950">{selectedItem.firefox}</p></details>
      <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor={`answer-${selectedItem.id}`}>What did you find?</label>
      <textarea id={`answer-${selectedItem.id}`} rows={4} maxLength={2000} value={answer.text} onChange={e => save({ ...answers, [selectedItem.id]: { ...answer, text: e.target.value, matched: null } })} placeholder="Describe the observed behavior, evidence, and expected secure behavior…" className="mt-1 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm leading-6" />
      <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={answer.checked} onChange={e => save({ ...answers, [selectedItem.id]: { ...answer, checked: e.target.checked, matched: null } })} className="mt-1" />I verified this observation in the synthetic training app or its recorded request/response evidence.</label>
      <button disabled={!answer.text.trim() || !answer.checked} onClick={grade} className="mt-3 w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Check my answer</button>
      {answer.matched === true && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-900"><strong>Checklist matched.</strong> Your answer covers the key behavior. Keep your request or response evidence with your notes; this local check does not independently verify a server-side effect.</p>}
      {answer.matched === false && <p role="status" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-900"><strong>Not complete yet.</strong> Add what the request or response showed, the affected feature, and what the server should do securely. Open the hint if you need a clue.</p>}
      <p className="mt-3 text-[11px] leading-5 text-slate-500">This helper checks whether your written explanation covers this challenge's key concepts. It does not send your answer to the server or prove that an effect occurred.</p>
    </section>}
  </>
}
