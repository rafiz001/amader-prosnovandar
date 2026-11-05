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
          'fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <Brand />
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>
          {NAV_ITEMS.map((item) => {
            const active = activeKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition',
                  active
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition',
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  )}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span
                    className={cn(
                      'block truncate text-[11px]',
                      active ? 'text-indigo-500' : 'text-slate-400'
                    )}
                  >
                    {item.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Icon name="info" className="h-3.5 w-3.5" /> API
            </p>
            <div className="mt-2 space-y-1.5">
              <a
                href="/api/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-indigo-600"
              >
                OpenAPI spec <Icon name="external" className="h-3.5 w-3.5" />
              </a>
              <a
                href="/health"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-emerald-600"
              >
                Health check <Icon name="external" className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
