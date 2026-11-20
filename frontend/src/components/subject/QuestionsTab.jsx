import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { API } from '../../lib/api.js';
import { DIFFICULTIES, KIND_LABEL, KINDS } from '../../lib/constants.js';
import { bnNum } from '../../lib/utils.js';
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
      toast.success('প্রশ্ন মুছে ফেলা হয়েছে');
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
        title="প্রশ্নসমূহ"
        subtitle={showInitialLoading ? 'লোড হচ্ছে…' : `মোট ${bnNum(total)}`}
        icon="list"
        actions={
          <Button size="sm" icon="plus" onClick={onCreate}>
            নতুন প্রশ্ন
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
            placeholder="লেখা বা গণিত খুঁজুন…"
            className="pl-9"
          />
        </div>
        <Select value={filters.chapter_id} onChange={updateFilter('chapter_id')}>
          <option value="">সব অধ্যায়</option>
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
            <Button size="sm" variant="ghost" icon="x" onClick={clearFilters}>
              মুছুন
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
          title={activeFilterCount > 0 ? 'মিলে যাওয়া প্রশ্ন নেই' : 'এখনো কোনো প্রশ্ন নেই'}
          message={
            activeFilterCount > 0
              ? 'কিছু ছাঁকনি মুছে দেখুন, অথবা নতুন প্রশ্ন যোগ করুন।'
              : 'এই বিষয়ের প্রথম প্রশ্ন যোগ করে শুরু করুন।'
          }
          action={
            <Button size="sm" icon="plus" onClick={onCreate}>
              নতুন প্রশ্ন
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
            দেখানো হচ্ছে{' '}
            <span className="font-medium text-slate-700">
              {bnNum(start)}–{bnNum(end)}
            </span>{' '}
            / মোট <span className="font-medium text-slate-700">{bnNum(total)}</span>
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
              আগের
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconRight="chevronRight"
              disabled={page.offset + page.limit >= total}
              onClick={() => setPage((p) => ({ ...p, offset: p.offset + p.limit }))}
            >
              পরের
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="এই প্রশ্নটি মুছে ফেলবেন?"
        message={
          deleting?.text
            ? `“${String(deleting.text).slice(0, 140)}${
                String(deleting.text).length > 140 ? '…' : ''
              }” স্থায়ীভাবে মুছে যাবে।`
            : 'এই প্রশ্নটি স্থায়ীভাবে মুছে যাবে।'
        }
        confirmLabel="প্রশ্ন মুছুন"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </Card>
  );
}
