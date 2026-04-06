import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authStore } from './stores/auth.ts';
import Layout from './components/Layout.tsx';
// Auth
import LoginPage from './pages/auth/LoginPage.tsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
// Pages
import DashboardPage from './pages/DashboardPage.tsx';
import InboxPage from './pages/InboxPage.tsx';
import AgentsPage from './pages/agents/AgentsPage.tsx';
import AgentDetailPage from './pages/agents/AgentDetailPage.tsx';
import IssuesPage from './pages/issues/IssuesPage.tsx';
import IssueDetailPage from './pages/issues/IssueDetailPage.tsx';
import GoalsPage from './pages/goals/GoalsPage.tsx';
import ProjectsPage from './pages/projects/ProjectsPage.tsx';
import ProjectDetailPage from './pages/projects/ProjectDetailPage.tsx';
import RoutinesPage from './pages/routines/RoutinesPage.tsx';
import ApprovalsPage from './pages/approvals/ApprovalsPage.tsx';
import CostsPage from './pages/costs/CostsPage.tsx';
import ActivityPage from './pages/ActivityPage.tsx';
import SessionsPage from './pages/sessions/SessionsPage.tsx';
import PluginsPage from './pages/plugins/PluginsPage.tsx';
import SettingsPage from './pages/settings/SettingsPage.tsx';
import OrgPage from './pages/org/OrgPage.tsx';
import RecipesPage from './pages/recipes/RecipesPage.tsx';
import PlaybooksPage from './pages/playbooks/PlaybooksPage.tsx';
import ArtifactsPage from './pages/artifacts/ArtifactsPage.tsx';
import NotFoundPage from './pages/NotFoundPage.tsx';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const apiKey = authStore.getApiKey();
  if (!apiKey) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="agents/:id" element={<AgentDetailPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="issues/:id" element={<IssueDetailPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="routines" element={<RoutinesPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="costs" element={<CostsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="plugins" element={<PluginsPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="playbooks" element={<PlaybooksPage />} />
          <Route path="artifacts" element={<ArtifactsPage />} />
          <Route path="org" element={<OrgPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
