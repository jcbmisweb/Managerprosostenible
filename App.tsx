
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { Sidebar } from './components/Sidebar';
import { WaitingRoom } from './components/WaitingRoom';
import { SuspendedAccount } from './components/SuspendedAccount';
import { ProjectAccess } from './components/ProjectAccess';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TeamLockGuard } from './components/TeamLockGuard';
import { Loader2, Ghost } from 'lucide-react';

// Lazy loading all pages to optimize initial bundle size and load speed
const Landing = React.lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Task1_TeamZone = React.lazy(() => import('./pages/Task1_TeamZone').then(m => ({ default: m.Task1_TeamZone })));
const ProjectSetup = React.lazy(() => import('./pages/ProjectSetup').then(m => ({ default: m.ProjectSetup })));
const Task2_Analysis = React.lazy(() => import('./pages/Task2_Analysis').then(m => ({ default: m.Task2_Analysis })));
const ConceptDefinition = React.lazy(() => import('./pages/ConceptDefinition').then(m => ({ default: m.ConceptDefinition })));
const MenuDesign = React.lazy(() => import('./pages/MenuDesign').then(m => ({ default: m.MenuDesign })));
const Task4_MenuPrototype = React.lazy(() => import('./pages/Task4_MenuPrototype').then(m => ({ default: m.Task4_MenuPrototype })));
const Task5_Financials = React.lazy(() => import('./pages/Task5_Financials').then(m => ({ default: m.Task5_Financials })));
const Task6_FinalAssembly = React.lazy(() => import('./pages/Task6_FinalAssembly').then(m => ({ default: m.Task6_FinalAssembly })));
const TeamSync = React.lazy(() => import('./pages/TeamSync').then(m => ({ default: m.TeamSync })));
const FinalMemory = React.lazy(() => import('./pages/FinalMemory').then(m => ({ default: m.FinalMemory })));
const InterimMemory = React.lazy(() => import('./pages/InterimMemory').then(m => ({ default: m.InterimMemory })));
const AcademicGuide = React.lazy(() => import('./pages/AcademicGuide').then(m => ({ default: m.AcademicGuide })));
const CoEvaluation = React.lazy(() => import('./pages/CoEvaluation').then(m => ({ default: m.CoEvaluation })));
const TeacherEvaluation = React.lazy(() => import('./pages/TeacherEvaluation').then(m => ({ default: m.TeacherEvaluation })));
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ProfessorDashboard = React.lazy(() => import('./pages/ProfessorDashboard').then(m => ({ default: m.ProfessorDashboard })));
const StudentDashboard = React.lazy(() => import('./pages/StudentDashboard').then(m => ({ default: m.StudentDashboard })));

// Layout wrapper to conditionally show Sidebar
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { profile, realProfile, impersonateUser } = useAuth();
  const isImpersonating = realProfile?.impersonatingUid != null;

  return (
    <div className="flex bg-gray-50 min-h-screen font-sans text-gray-900">
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <Ghost size={18} />
            </div>
            <p className="text-sm font-bold">
              MODO SUPLANTACIÓN: <span className="underline">{profile?.displayName}</span> ({profile?.email})
            </p>
          </div>
          <button 
            onClick={() => impersonateUser(null)}
            className="bg-white text-blue-600 px-4 py-1 rounded-full text-xs font-bold hover:bg-blue-50 transition-colors"
          >
            Detener Suplantación
          </button>
        </div>
      )}
      {!isLanding && <Sidebar />}
      
      <main className={`flex-1 transition-all duration-300 ${!isLanding ? 'ml-64 print:ml-0 print:w-full' : ''} ${isImpersonating ? 'pt-12' : ''}`}>
        {children}
      </main>
    </div>
  );
};

const AppContent = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { loading: projectLoading } = useProject();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Determine which dashboard to show
  const renderDashboard = () => {
    if (profile?.status === 'suspended') return <SuspendedAccount />;
    
    switch (profile?.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'assistant':
        return <ProfessorDashboard />;
      case 'student':
        return <StudentDashboard />;
      default:
        return <WaitingRoom />;
    }
  };

  return (
    <HashRouter>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-400 font-medium text-sm">Cargando sección...</p>
          </div>
        </div>
      }>
        {!user ? (
          <Login />
        ) : !profile?.projectId && profile?.role !== 'student' ? (
          renderDashboard()
        ) : profile?.status === 'suspended' ? (
          <SuspendedAccount />
        ) : !profile?.classroomId && profile?.role === 'student' ? (
          <StudentDashboard />
        ) : !profile?.projectId && profile?.role === 'student' ? (
          <StudentDashboard />
        ) : projectLoading ? (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Sincronizando proyecto...</p>
            </div>
          </div>
        ) : (
          <AppLayout>
            <TeamLockGuard>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/dashboard" element={renderDashboard()} />
                <Route path="/academic-guide" element={<AcademicGuide />} />
                <Route path="/task-1" element={<Task1_TeamZone />} />
                <Route path="/setup" element={<ProjectSetup />} />
                <Route path="/sync" element={<TeamSync />} />
                <Route path="/task-2" element={<Task2_Analysis />} />
                <Route path="/zone" element={<Navigate to="/task-1" replace />} />
                <Route path="/concept" element={<ConceptDefinition />} />
                <Route path="/menu" element={<MenuDesign />} />
                <Route path="/task-4" element={<Task4_MenuPrototype />} />
                <Route path="/interim-memory" element={<InterimMemory />} />
                <Route path="/financials" element={<Task5_Financials />} />
                <Route path="/task-6" element={<Task6_FinalAssembly />} />
                <Route path="/co-eval" element={<CoEvaluation />} />
                <Route path="/teacher-eval" element={<TeacherEvaluation />} />
                <Route path="/memory" element={<FinalMemory />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </TeamLockGuard>
          </AppLayout>
        )}
      </Suspense>
    </HashRouter>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProjectProvider>
          <AppContent />
        </ProjectProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

