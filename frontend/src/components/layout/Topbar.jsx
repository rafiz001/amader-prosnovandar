import { Icon } from '../Icon.jsx';
import { Breadcrumbs } from './Breadcrumbs.jsx';

export function Topbar({ stack, onGoto, onOpenSidebar, canGoBack, onBack }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6 print:hidden">
      <button
        onClick={onOpenSidebar}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
        aria-label="মেনু খুলুন"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {canGoBack && (
        <button
          onClick={onBack}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label="পেছনে"
        >
          <Icon name="arrowLeft" className="h-5 w-5" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <Breadcrumbs stack={stack} onGoto={onGoto} />
      </div>
    </header>
  );
}
