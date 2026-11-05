import { useMemo, useState } from 'react';
import { NavCtx } from './context/NavContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { Topbar } from './components/layout/Topbar.jsx';
import { EmptyState } from './components/ui/index.js';
import { InstitutePage } from './pages/InstitutePage.jsx';
import { ClassesPage } from './pages/ClassesPage.jsx';
import { ClassPage } from './pages/ClassPage.jsx';
import { SubjectPage } from './pages/SubjectPage.jsx';
import { GeneratePage } from './pages/GeneratePage.jsx';
import { PapersPage } from './pages/PapersPage.jsx';

/**
 * Route shapes:
 *   { name: 'institute' }
 *   { name: 'classes' }
 *   { name: 'class',   id, label }
 *   { name: 'subject', id, label, tab }
 *   { name: 'generate' }
 *   { name: 'papers' }
 */
function renderRoute(route) {
  switch (route.name) {
    case 'institute':
      return <InstitutePage />;
    case 'classes':
      return <ClassesPage />;
    case 'class':
      return <ClassPage classId={route.id} />;
    case 'subject':
      return <SubjectPage subjectId={route.id} initialTab={route.tab || 'questions'} />;
    case 'generate':
      return <GeneratePage />;
    case 'papers':
      return <PapersPage />;
    default:
      return <EmptyState icon="alert" title="Page not found" message={`Unknown route: ${route.name}`} />;
  }
}

export default function App() {
  const [stack, setStack] = useState([{ name: 'institute', label: 'Institute' }]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = useMemo(
    () => ({
      reset: (item) => {
        setStack([item]);
        setSidebarOpen(false);
      },
      push: (item) => {
        setStack((s) => [...s, item]);
        setSidebarOpen(false);
      },
      goto: (index) => setStack((s) => s.slice(0, index + 1)),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    }),
    []
  );

  const current = stack[stack.length - 1];
  const topKey =
    stack[0]?.name === 'class' || stack[0]?.name === 'subject' ? 'classes' : stack[0]?.name;

  const handleNavigate = (item) => nav.reset({ name: item.key, label: item.label });

  return (
    <ToastProvider>
      <NavCtx.Provider value={nav}>
        <div className="flex min-h-screen bg-slate-50">
          <Sidebar
            activeKey={topKey}
            onNavigate={handleNavigate}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              stack={stack}
              onGoto={nav.goto}
              onOpenSidebar={() => setSidebarOpen(true)}
              canGoBack={stack.length > 1}
              onBack={nav.back}
            />

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
              {renderRoute(current)}
            </main>

            <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
              Question Bank API v2.0 · UTF‑8 / NFC ·{' '}
              <a
                className="underline decoration-dotted hover:text-slate-600"
                href="/api/openapi.json"
                target="_blank"
                rel="noreferrer"
              >
                OpenAPI 3.0
              </a>
            </footer>
          </div>
        </div>
      </NavCtx.Provider>
    </ToastProvider>
  );
}
