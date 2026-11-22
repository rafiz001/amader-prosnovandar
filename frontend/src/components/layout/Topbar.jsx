import { Icon } from '../Icon.jsx';
import { Breadcrumbs } from './Breadcrumbs.jsx';

export function Topbar({ stack, onGoto, onOpenSidebar, canGoBack, onBack }) {
  return (
    <header className="sticky top-0 z-20 flex h-11 items-center gap-2 border-b border-slate-200 bg-white/85 px-2 backdrop-blur sm:px-3 print:hidden">
      <button
        onClick={onOpenSidebar}
        className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 lg:hidden"
        aria-label="মেনু খুলুন"
      >
        <Icon name="menu" className="h-4 w-4" />
      </button>

      {canGoBack && (
        <button
          onClick={onBack}
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100"
          aria-label="পেছনে"
        >
          <Icon name="arrowLeft" className="h-4 w-4" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <Breadcrumbs stack={stack} onGoto={onGoto} />
      </div>
    </header>
  );
}
