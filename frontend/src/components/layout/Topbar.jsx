import { Icon } from '../Icon.jsx';
import { Breadcrumbs } from './Breadcrumbs.jsx';

export function Topbar({ stack, onGoto, onOpenSidebar, canGoBack, onBack }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onOpenSidebar}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {canGoBack && (
        <button
          onClick={onBack}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label="Back"
        >
          <Icon name="arrowLeft" className="h-5 w-5" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <Breadcrumbs stack={stack} onGoto={onGoto} />
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <a
          href="/api/openapi.json"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <Icon name="file" className="h-3.5 w-3.5" /> API docs
        </a>
      </div>
    </header>
  );
}
