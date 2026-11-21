import { NAV_ITEMS } from '../../lib/constants.js';
import { cn } from '../../lib/utils.js';
import { Icon } from '../Icon.jsx';
import { Brand } from './Brand.jsx';

export function Sidebar({ activeKey, onNavigate, open, onClose }) {
  return (
    <>
      {/* mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden print:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-slate-200 bg-white transition-transform duration-200 print:hidden',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-center border-b border-slate-200 px-1">
          <div className="group relative">
            <Brand compact />
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 opacity-0 shadow-pop transition-opacity group-hover:opacity-100">
              <span className="block text-xs font-semibold text-white">প্রশ্নব্যাংক</span>
              <span className="block text-[10px] text-slate-300">অ্যাডমিন · সংস্করণ ২.০</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="মেনু বন্ধ করুন"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3">
          {NAV_ITEMS.map((item) => {
            const active = activeKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item)}
                aria-label={item.label}
                className={cn(
                  'group relative mx-auto grid h-10 w-10 place-items-center rounded-lg transition',
                  active
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded-lg transition',
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  )}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-left opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="block text-xs font-semibold text-white">{item.label}</span>
                  <span className="block text-[10px] text-slate-300">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
