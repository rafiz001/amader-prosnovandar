import { useEffect, useMemo, useState } from 'react';
import { NavCtx } from './context/NavContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { Topbar } from './components/layout/Topbar.jsx';
import { EmptyState } from './components/ui/index.js';
import { buildCrumbs, parseHash, pathFor } from './lib/router.js';
import { InstitutePage } from './pages/InstitutePage.jsx';
import { ClassesPage } from './pages/ClassesPage.jsx';
import { ClassPage } from './pages/ClassPage.jsx';
import { SubjectPage } from './pages/SubjectPage.jsx';
import { GeneratePage } from './pages/GeneratePage.jsx';
import { PapersPage } from './pages/PapersPage.jsx';

/**
 * Hash route shapes:
 *   #/institute
 *   #/classes
 *   #/classes/:id
 *   #/classes/:id/subjects/:id
 *   #/classes/:id/subjects/:id/:tab
 *   #/subjects/:id
 *   #/generate
 *   #/papers
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
      return <EmptyState icon="alert" title="পৃষ্ঠা পাওয়া যায়নি" message={`অজানা পথ: ${route.path}`} />;
  }
}

export default function App() {
  const [route, setRoute] = useState(() => parseHash());
  const [labels, setLabels] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/institute');
    }
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const crumbs = useMemo(() => buildCrumbs(route, labels), [route, labels]);

  const nav = useMemo(() => {
    const go = (path) => {
      if (window.location.hash !== `#${path}`) window.location.hash = path;
    };
    return {
      reset: (item) => go(pathFor(item, route)),
      push: (item) => go(pathFor(item, route)),
      goto: (index) => {
        const target = crumbs[index];
        if (target) go(target.path);
      },
      back: () => {
        if (crumbs.length > 1) go(crumbs[crumbs.length - 2].path);
      },
      setLabel: (label) =>
        setLabels((prev) => (prev[route.path] === label ? prev : { ...prev, [route.path]: label })),
    };
  }, [route, crumbs]);

  const current = route;
  const topKey =
    current.name === 'class' || current.name === 'subject' ? 'classes' : current.name;

  const handleNavigate = (item) => nav.reset({ name: item.key, label: item.label });

  return (
    <ToastProvider>
      <NavCtx.Provider value={nav}>
        <div className="flex min-h-screen bg-slate-50 print:bg-white">
          <Sidebar
            activeKey={topKey}
            onNavigate={handleNavigate}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              stack={crumbs}
              onGoto={nav.goto}
              onOpenSidebar={() => setSidebarOpen(true)}
              canGoBack={crumbs.length > 1}
              onBack={nav.back}
            />

            <main
              className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0 ${
                current.name === 'generate' ? 'max-w-[1600px]' : 'max-w-6xl'
              }`}
            >
              {renderRoute(current)}
            </main>

            <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 sm:px-6 print:hidden">
              প্রশ্নব্যাংক সংস্করণ ২.০ · ইউটিএফ-৮ / এনএফসি
            </footer>
          </div>
        </div>
      </NavCtx.Provider>
    </ToastProvider>
  );
}
