import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { API } from '../../lib/api.js';
import { DIFFICULTIES, KINDS } from '../../lib/constants.js';
import { Icon } from '../Icon.jsx';
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Input,
  LoadingBlock,
  Select,
} from '../ui/index.js';
import { QuestionRow } from '../questions/QuestionRow.jsx';

export function QuestionsTab({ subjectId, version, onCreate, onEdit, onChanged }) {
  const toast = useToast();
  const [filters, setFilters] = useState({
    q: '',
    kind: '',
    difficulty: '',
    lang: '',
    chapter_id: '',
    type_id: '',
  });
  const [page, setPage] = useState({ limit: 20, offset: 0 });
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const { data, loading, error, reload } = useResource(
    () => API.questions.list(subjectId, { ...filters, ...page }),
    [
      subjectId,
      version,
      filters.q,
      filters.kind,
      filters.difficulty,
      filters.lang,
      filters.chapter_id,
      filters.type_id,
      page.limit,
      page.offset,
    ]
  );

  const { data: chapters } = useResource(() => API.chapters.list(subjectId), [subjectId, version]);
  const { data: types } = useResource(() => API.types.list(subjectId), [subjectId, version]);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const start = total === 0 ? 0 : page.offset + 1;
  const end = Math.min(total, page.offset + items.length);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const updateFilter = (key) => (e) => {
    const value = e.target.value;
    setFilters((f) => ({ ...f, [key]: value }));
    setPage((p) => ({ ...p, offset: 0 }));
  };

  const clearFilters = () => {
    setFilters({
      q: '',
      kind: '',
      difficulty: '',
      lang: '',
      chapter_id: '',
      type_id: '',
    });
    setPage((p) => ({ ...p, offset: 0 }));
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await API.questions.remove(deleting.id);
      toast.success('Question deleted');
      setDeleting(null);
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  const showInitialLoading = loading && !data;

  return (
    <Card>
      <CardHeader
        title="Questions"
        subtitle={showInitialLoading ? 'Loading…' : `${total} total`}
        icon="list"
        actions={
          <Button size="sm" icon="plus" onClick={onCreate}>
            New question
          </Button>
        }
      />

      <div className="grid gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={filters.q}
            onChange={updateFilter('q')}
            placeholder="Search text or math…"
            className="pl-9"
          />
        </div>
        <Select value={filters.chapter_id} onChange={updateFilter('chapter_id')}>
          <option value="">All chapters</option>
          {(chapters || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={filters.type_id} onChange={updateFilter('type_id')}>
          <option value="">All types</option>
          {(types || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.kind})
            </option>
          ))}
        </Select>
        <Select value={filters.kind} onChange={updateFilter('kind')}>
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
        <Select value={filters.difficulty} onChange={updateFilter('difficulty')}>
          <option value="">Any difficulty</option>
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
              placeholder="Language code (bn, ar…)"
            />
          </div>
          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" icon="x" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {showInitialLoading ? (
        <LoadingBlock label="Loading questions…" />
      ) : error ? (
        <ErrorBlock error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="list"
          title={activeFilterCount > 0 ? 'No matching questions' : 'No questions yet'}
          message={
            activeFilterCount > 0
              ? 'Try clearing some filters, or add a new question.'
              : 'Add your first question to start building this subject.'
          }
          action={
            <Button size="sm" icon="plus" onClick={onCreate}>
              New question
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((q) => (
            <QuestionRow
              key={q.id}
              q={q}
              onEdit={onEdit}
              onDelete={(row) => setDeleting(row)}
            />
          ))}
        </ul>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>
            Showing{' '}
            <span className="font-medium text-slate-700">
              {start}–{end}
            </span>{' '}
            of <span className="font-medium text-slate-700">{total}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon="chevronLeft"
              disabled={page.offset === 0}
              onClick={() =>
                setPage((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))
              }
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconRight="chevronRight"
              disabled={page.offset + page.limit >= total}
              onClick={() => setPage((p) => ({ ...p, offset: p.offset + p.limit }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete this question?"
        message={
          deleting?.text
            ? `“${String(deleting.text).slice(0, 140)}${
                String(deleting.text).length > 140 ? '…' : ''
              }” will be permanently removed.`
            : 'This question will be permanently removed.'
        }
        confirmLabel="Delete question"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </Card>
  );
}
