import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

type Challenge = {
  id: number
  title: string
  hint: string
  firefox: string
}

const challenges: Challenge[] = [
  { id: 1, title: 'What is missing from the list?', hint: 'Compare the customer list response with one customer detail response. Look for internal fields returned only by the detail route.', firefox: 'Open Developer Tools → Network → XHR. Reload Customers, open one synthetic customer, and compare the Response tabs.' },
  { id: 2, title: 'The team directory', hint: 'Compare the full directory request with the ordinary member list. Check the returned fields and whether the employee role is allowed to call it.', firefox: 'Open Network → XHR on the Team page. Filter for “directory” or “member” and inspect response fields and status.' },
  { id: 3, title: 'Request origin', hint: 'The widget endpoint reflects an arbitrary Origin and allows credentials. Compare this with /api/v2/me; a secure server uses an explicit trusted-origin allow-list.', firefox: 'Use Network → XHR and filter for “widget”. The app does not automatically call this endpoint, so it may not appear on page load. Firefox cannot set the forbidden Origin request header from page JavaScript; inspect the recorded training evidence or use the instructor-approved request capture. Compare Access-Control-Allow-Origin and Access-Control-Allow-Credentials with /api/v2/me.' },
  { id: 4, title: 'Search with no results', hint: 'On the selected empty-results view, the query is inserted into an HTML sink. Compare the same query with a neighboring search view that renders it as text. Use only the lab’s harmless proof.', firefox: 'Open Network → XHR to inspect the search response. Use Inspector to review the empty-results text. Do not paste executable markup.' },
  { id: 5, title: 'A saved message', hint: 'The selected message feed renders persisted content differently from safe text fields. Confirm persistence after reload and compare the browser rendering.', firefox: 'Open Network → XHR while sending and reopening the synthetic message. Use Inspector to compare its rendered node with a plain text field.' },
  { id: 6, title: 'Two account recovery routes', hint: 'Compare the current v2 recovery route with the older v1 route. The legacy path omits the rate limiter. Stop as soon as you confirm a difference.', firefox: 'Open Network → XHR while using the recovery form. Compare route versions and responses. Do not continue repeated submissions after a clear difference.' },
  { id: 7, title: 'An older version of project data', hint: 'The selected legacy project route skips the tenant check. The v2 route returns not found for the same foreign synthetic project.', firefox: 'In Network → XHR, capture a normal project ID, then compare only the referenced v1 and v2 reads under Org 2.' },
  { id: 8, title: 'A project from another organization', hint: 'Use a project identifier already visible in training data. Compare its detail read across Org 1 and Org 2; do not guess IDs.', firefox: 'Capture a project request under each training account in Network → XHR and compare the response for the same observed ID.' },
  { id: 9, title: 'A document with a known identifier', hint: 'A selected document read can return another organization’s synthetic document when its known ID is supplied. Compare with a document your organization owns.', firefox: 'Capture an allowed document ID in Network → XHR. Compare the read while signed in to the other training account; do not enumerate IDs.' },
  { id: 10, title: 'A knowledge resource', hint: 'A knowledge resource detail lookup omits the owning organization check. Compare list visibility with a single-resource read.', firefox: 'In Network → XHR, capture the knowledge list and detail responses. Compare the same observed synthetic resource across accounts.' },
  { id: 11, title: 'A private conversation', hint: 'The selected share-view route checks authentication but not conversation ownership or a valid share grant.', firefox: 'Inspect the share-view request in Network → XHR. Compare what the owner sees with the second training account; use only an assigned synthetic conversation.' },
  { id: 12, title: 'File metadata versus download', hint: 'Metadata and download use different authorization paths. The selected download path can issue a signed URL for a foreign synthetic file.', firefox: 'In Network, compare the file metadata request with its download request. Never copy a temporary signed URL into your report.' },
  { id: 13, title: 'Storage attachments', hint: 'The attachment storage policy misses tenant isolation. Compare an observed synthetic attachment under both training organizations.', firefox: 'Capture a normal attachment read in Network. Repeat with the other account using only its observed synthetic path.' },
  { id: 14, title: 'Project comments', hint: 'The direct comments table read is broader than the application’s project-comment endpoint. Compare row access across organizations.', firefox: 'Compare the app endpoint and the instructor-approved direct read. Use Network for app requests; do not attempt database access beyond the exercise instructions.' },
  { id: 15, title: 'An administrative action as an employee', hint: 'The archive endpoint checks authentication and tenant membership but misses the manager role gate. Verify the synthetic project state after the request.', firefox: 'Compare the captured manager action with the same assigned training project as an employee in Network → XHR. Stop if its state changes.' },
  { id: 16, title: 'Account properties', hint: 'The selected profile update accepts a role property and writes it to organization membership. The server should allow-list profile fields and keep role changes separate.', firefox: 'Inspect the normal profile update in Network → XHR. Only use the instructor-assigned low-privilege check and have the instructor verify any role change.' },
  { id: 17, title: 'Inviting a new member', hint: 'One invitation acceptance route trusts a submitted role instead of the role stored on the invitation. Compare with the secure completion route.', firefox: 'Capture the instructor-prepared invite acceptance in Network. Verify the resulting synthetic membership with the instructor.' },
  { id: 18, title: 'Invoice state transitions', hint: 'The selected status endpoint validates the state name but not the allowed transition order. Compare it with the ordered transition route.', firefox: 'Use Network → XHR to inspect the assigned synthetic invoice status change. Confirm the resulting state with a later read and stop.' },
  { id: 19, title: 'Repeating an approval request', hint: 'The selected approval operation lacks an idempotency guard and can create duplicate synthetic audit effects when replayed.', firefox: 'Capture one normal approval request. Repeat it only as the challenge allows and stop at the first duplicate effect.' },
  { id: 20, title: 'A session that remains active', hint: 'Changing a password does not revoke the old session in the selected flow; explicit session revocation does. Use two training sessions only.', firefox: 'Compare one non-sensitive request in two training sessions before and after the instructor-directed password change. Never expose tokens.' },
  { id: 21, title: 'Role context', hint: 'A client-derived role claim is trusted by a selected action. The server should derive authorization from trusted membership data.', firefox: 'Compare the normal account context and the instructor-assigned synthetic setting result in Network. Do not send tokens to external JWT sites.' },
  { id: 22, title: 'Instructions inside a conversation', hint: 'The deterministic training assistant follows a selected user override phrase and stores the changed response. Compare with an ordinary request.', firefox: 'Save both exchanges. In Network → XHR, inspect the conversation message response and confirm both messages remain in history.' },
  { id: 23, title: 'Instructions inside a knowledge source', hint: 'A seeded adversarial knowledge note is treated as an instruction by the deterministic training flow. Compare a request that retrieves it with a neutral request.', firefox: 'Save both assistant exchanges and inspect the conversation history. Network → XHR shows the message response. This lab uses a deterministic simulation, not a live external model.' },
  { id: 24, title: 'Assistant tool authorization', hint: 'The document tool checks that the user is authenticated but omits the document organization predicate. Compare it with the ordinary document route.', firefox: 'Capture the normal document read and assistant tool interaction in Network → XHR. Use only synthetic identifiers already shown in the app.' },
  { id: 25, title: 'Connect knowledge, tool, and result', hint: 'The seeded knowledge instruction can select a vulnerable document tool; that tool can fetch a foreign synthetic board document and persist it in the conversation.', firefox: 'Save and reopen the conversation. Inspect the message and tool-related XHR evidence. Never copy tokens or temporary download links.' },
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

type Grade = { correct: boolean; feedback: string; missing_points: string[]; runtime_evidence: boolean; evidence_count: number }
type SavedAnswer = { text: string; grade?: Grade }

export default function TrainingCoach({ path }: { path: string }) {
  const { me } = useAuth()
  const items = useMemo(() => challengesForPath(path), [path])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [grading, setGrading] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)
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
  const answer = answers[selectedItem.id] ?? { text: '' }
  const grade = async () => {
    setGrading(true); setGradeError(null)
    try {
      const result = await api<Grade>('/v2/training/answers/grade', { method: 'POST', body: { challenge_id: selectedItem.id, answer: answer.text } })
      save({ ...answers, [selectedItem.id]: { ...answer, grade: result } })
    } catch (error: any) { setGradeError(error?.message ?? 'تعذّر تقييم الإجابة') }
    finally { setGrading(false) }
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
      <textarea id={`answer-${selectedItem.id}`} rows={4} maxLength={2000} value={answer.text} onChange={e => save({ ...answers, [selectedItem.id]: { ...answer, text: e.target.value, grade: undefined } })} placeholder="Describe the observed behavior, evidence, and expected secure behavior…" className="mt-1 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm leading-6" />
      <button disabled={!answer.text.trim() || grading} onClick={() => void grade()} className="mt-3 w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{grading ? 'جارٍ تقييم الإجابة…' : 'قيّم إجابتي بالذكاء الاصطناعي'}</button>
      {gradeError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-900">{gradeError}</p>}
      {answer.grade && <div role="status" className={`mt-3 rounded-xl p-3 text-sm leading-6 ${answer.grade.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}>
        <strong>{answer.grade.correct ? 'الإجابة صحيحة حسب التقييم' : 'الإجابة تحتاج إلى مراجعة'}</strong>
        <p className="mt-1">{answer.grade.feedback}</p>
        {answer.grade.missing_points.length > 0 && <ul className="mt-2 list-inside list-disc">{answer.grade.missing_points.map((point, index) => <li key={index}>{point}</li>)}</ul>}
        <p className="mt-2 border-t border-current/10 pt-2 text-xs">{answer.grade.runtime_evidence ? `رُصد تنفيذ فعلي لهذا التحدي (${answer.grade.evidence_count} حدث/أحداث).` : 'لم يُرصد تنفيذ فعلي لهذا التحدي بعد. صحة الشرح وحدها لا تثبت تنفيذ الأثر.'}</p>
      </div>}
      <p className="mt-3 text-[11px] leading-5 text-slate-500">يراجع الذكاء الاصطناعي دقة شرحك، بينما يأتي إثبات التنفيذ الفعلي من سجل الخادم. لا تُرسل مفاتيح أو رموز جلسات في إجابتك.</p>
    </section>}
  </>
}
