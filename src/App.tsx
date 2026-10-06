import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Loading } from './lib/ui'
import AppShell from './layout/AppShell'
import { Login, Forgot, AcceptInvite } from './pages/Auth'
import Dashboard from './pages/Dashboard'
import { Projects, ProjectDetail, Tasks } from './pages/Projects'
import { Documents, DocumentDetail } from './pages/Documents'
import { Customers, CustomerDetail, Team, Messages, Search } from './pages/Workspace'
import { Chat, Conversations, Knowledge, KnowledgeDetail, Models, SharedConversation } from './pages/Mibyan'
import { DevOverview, ApiKeys, Usage, Logs, DevModels, DevDocs } from './pages/Developer'
import { Invoices, InvoiceDetail, Plans } from './pages/Finance'
import { Members, Invitations, OrgSettings, AuditLog } from './pages/Org'
import { Profile, Security, Sessions, ReportIssue } from './pages/Account'
import { Restricted, NotFound } from './pages/Misc'
import TrainingCoach from './components/TrainingCoach'

const Instructor = lazy(() => import('./pages/Instructor'))
const AdminConsole = lazy(() => import('./pages/AdminConsole'))

function Protected({ children }: { children: JSX.Element }) {
  const { session, ready, me } = useAuth()
  const loc = useLocation()
  if (!ready) return <div className="h-full"><Loading label="Starting workspace…" /></div>
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />
  if (me?.isInstructor && !loc.pathname.startsWith('/instructor')) return <Navigate to="/instructor" replace />
  return children
}

export default function App() {
  const location = useLocation()
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<Forgot />} />
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route path="/share/:token" element={<SharedConversation />} />
        <Route path="/instructor/*" element={<Protected><Instructor /></Protected>} />
        <Route element={<Protected><AppShell /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="team" element={<Team />} />
          <Route path="messages" element={<Messages />} />
          <Route path="search" element={<Search />} />
          <Route path="mibyan/chat" element={<Chat />} />
          <Route path="mibyan/chat/:id" element={<Chat />} />
          <Route path="mibyan/conversations" element={<Conversations />} />
          <Route path="mibyan/knowledge" element={<Knowledge />} />
          <Route path="mibyan/knowledge/:id" element={<KnowledgeDetail />} />
          <Route path="mibyan/models" element={<Models />} />
          <Route path="developer" element={<DevOverview />} />
          <Route path="developer/api-keys" element={<ApiKeys />} />
          <Route path="developer/usage" element={<Usage />} />
          <Route path="developer/logs" element={<Logs />} />
          <Route path="developer/models" element={<DevModels />} />
          <Route path="developer/docs" element={<DevDocs />} />
          <Route path="finance/invoices" element={<Invoices />} />
          <Route path="finance/invoices/:id" element={<InvoiceDetail />} />
          <Route path="finance/plans" element={<Plans />} />
          <Route path="org/members" element={<Members />} />
          <Route path="org/invitations" element={<Invitations />} />
          <Route path="org/settings" element={<OrgSettings />} />
          <Route path="org/audit" element={<AuditLog />} />
          <Route path="account/profile" element={<Profile />} />
          <Route path="account/security" element={<Security />} />
          <Route path="account/sessions" element={<Sessions />} />
          <Route path="account/report" element={<ReportIssue />} />
          <Route path="admin/*" element={<AdminGate />} />
          <Route path="internal/*" element={<Restricted />} />
          <Route path="debug/*" element={<Restricted />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        </Routes>
      </Suspense>
      <TrainingCoach path={location.pathname} />
    </>
  )
}

function AdminGate() {
  const { me } = useAuth()
  return me?.isPlatformAdmin ? <AdminConsole /> : <Restricted />
}
