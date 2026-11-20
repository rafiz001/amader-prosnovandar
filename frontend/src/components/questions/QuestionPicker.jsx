import { useState } from 'react';
import { useResource } from '../../hooks/useResource.js';
import { API } from '../../lib/api.js';
import { DIFFICULTIES, KIND_LABEL, KINDS } from '../../lib/constants.js';
import { bnNum } from '../../lib/utils.js';
import { Icon } from '../Icon.jsx';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBlock,
  Input,
  LoadingBlock,
  Select,
} from '../ui/index.js';
import { QuestionPickerRow } from './QuestionPickerRow.jsx';

const EMPTY_FILTERS = {
  q: '',
  kind: '',
  difficulty: '',
  lang: '',
  chapter_id: '',
  type_id: '',
};

const PAGE_SIZES = [10, 20, 50, 100];

function pageWindow(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(totalPages - 1, current + 1);
  if (from > 2) pages.push('gap-start');
  for (let p = from; p <= to; p += 1) pages.push(p);
  if (to < totalPages - 1) pages.push('gap-end');
  pages.push(totalPages);
  return pages;
}

export function QuestionPicker({ subjectId, selected, onToggle, onClear }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState({ limit: 20, offset: 0 });

  const { data, loading, error, reload } = useResource(
    () => API.questions.list(subjectId, { ...filters, ...page }),
    [
      subjectId,
      filters.q,
      filters.kind,
      filters.difficulty,
      filters.lang,
      filters.chapter_id,
      filters.type_id,
      page.limit,
      page.offset,
    ],
    { skip: !subjectId }
  );

  const { data: chapters } = useResource(
    () => API.chapters.list(subjectId),
    [subjectId],
    { skip: !subjectId }
  );
  const { data: types } = useResource(
    () => API.types.list(subjectId),
    [subjectId],
    { skip: !subjectId }
  );

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const start = total === 0 ? 0 : page.offset + 1;
  const end = Math.min(total, page.offset + items.length);
  const totalPages = Math.max(1, Math.ceil(total / page.limit));
  const currentPage = Math.floor(page.offset / page.limit) + 1;
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const selectedIds = new Set(selected.map((q) => q.id));
  const totalMarks = selected.reduce((sum, q) => sum + Number(q.marks || 0), 0);

  const updateFilter = (key) => (e) => {
    const value = e.target.value;
    setFilters((f) => ({ ...f, [key]: value }));
    setPage((p) => ({ ...p, offset: 0 }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage((p) => ({ ...p, offset: 0 }));
  };

  const gotoPage = (n) => setPage((p) => ({ ...p, offset: (n - 1) * p.limit }));

  if (!subjectId) {
    return (
      <Card>
        <CardHeader
          title="প্রশ্ন বাছাই করুন"
          subtitle="প্রশ্নপত্রে যোগ করতে একটি প্রশ্নে ক্লিক করুন"
          icon="list"
        />
        <EmptyState
          icon="book"
          title="প্রথমে একটি বিষয় বাছুন"
          message="উপরে একটি শ্রেণি ও বিষয় বাছুন, তারপর প্রশ্ন দেখে পছন্দেরগুলো নির্বাচন করুন।"
        />
      </Card>
    );
  }

  const showInitialLoading = loading && !data;

  return (
    <Card>
      <CardHeader
        title="প্রশ্ন বাছাই করুন"
        subtitle={
          showInitialLoading
            ? 'লোড হচ্ছে…'
            : `মোট ${bnNum(total)}টি প্রশ্ন আপনার ছাঁকনির সাথে মেলে`
        }
        icon="list"
      />

      <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Icon name="check" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              {bnNum(selected.length)}টি প্রশ্ন নির্বাচিত
            </p>
            <p className="text-xs text-indigo-600">
              নির্বাচন বা বাতিল করতে প্রশ্নে ক্লিক করুন
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && <Badge tone="violet">{bnNum(totalMarks)} নম্বর</Badge>}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon="x"
            onClick={onClear}
            disabled={selected.length === 0}
          >
            মুছুন
          </Button>
        </div>
      </div>

      <div className="grid gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={filters.q}
            onChange={updateFilter('q')}
            placeholder="লেখা বা গণিত খুঁজুন…"
            className="pl-9"
          />
        </div>
        <Select value={filters.chapter_id} onChange={updateFilter('chapter_id')}>
          <option value="">সব অধ্যায়</option>
          <option value="none">কোনো অধ্যায় নেই</option>
          {(chapters || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={filters.type_id} onChange={updateFilter('type_id')}>
          <option value="">সব ধরন</option>
          {(types || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({KIND_LABEL[t.kind] || t.kind})
            </option>
          ))}
        </Select>
        <Select value={filters.kind} onChange={updateFilter('kind')}>
          <option value="">সব প্রকার</option>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
        <Select value={filters.difficulty} onChange={updateFilter('difficulty')}>
          <option value="">যেকোনো কঠিনতা</option>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-2 sm:col-span-2">
          <div className="flex-1">
            <Input
              value={filters.lang}
              onChange={updateFilter('lang')}
              placeholder="ভাষা কোড"
            />
          </div>
          {activeFilterCount > 0 && (
            <Button type="button" size="sm" variant="ghost" icon="x" onClick={clearFilters}>
              ছাঁকনি মুছুন
            </Button>
          )}
        </div>
      </div>

      {showInitialLoading ? (
        <LoadingBlock label="প্রশ্ন লোড হচ্ছে…" />
      ) : error ? (
        <ErrorBlock error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="list"
          title={activeFilterCount > 0 ? 'মিলে যাওয়া প্রশ্ন নেই' : 'এই বিষয়ে কোনো প্রশ্ন নেই'}
          message={
            activeFilterCount > 0
              ? 'আরও প্রশ্ন দেখতে কিছু ছাঁকনি মুছে দেখুন।'
              : 'আগে এই বিষয়ে প্রশ্ন যোগ করুন, তারপর এখানে ফিরে বাছাই করুন।'
          }
        />
      ) : (
        <ul className={`space-y-2 p-4 transition sm:p-5 ${loading ? 'opacity-60' : ''}`}>
          {items.map((q) => (
            <QuestionPickerRow
              key={q.id}
              q={q}
              selected={selectedIds.has(q.id)}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:px-5">
          <span>
            দেখানো হচ্ছে{' '}
            <span className="font-medium text-slate-700">
              {bnNum(start)}–{bnNum(end)}
            </span>{' '}
            / মোট <span className="font-medium text-slate-700">{bnNum(total)}</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Select
              value={page.limit}
              onChange={(e) =>
                setPage({ limit: Number(e.target.value), offset: 0 })
              }
              className="h-8 w-auto py-0 text-xs"
              aria-label="প্রতি পৃষ্ঠায় প্রশ্ন"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {bnNum(size)} / পৃষ্ঠা
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon="chevronLeft"
              disabled={page.offset === 0}
              onClick={() => gotoPage(currentPage - 1)}
            >
              আগের
            </Button>
            {pageWindow(currentPage, totalPages).map((p) =>
              typeof p === 'number' ? (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={p === currentPage ? 'primary' : 'secondary'}
                  onClick={() => gotoPage(p)}
                  aria-current={p === currentPage ? 'page' : undefined}
                >
                  {bnNum(p)}
                </Button>
              ) : (
                <span key={p} className="px-1 text-slate-400">
                  …
                </span>
              )
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconRight="chevronRight"
              disabled={page.offset + page.limit >= total}
              onClick={() => gotoPage(currentPage + 1)}
            >
              পরের
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
