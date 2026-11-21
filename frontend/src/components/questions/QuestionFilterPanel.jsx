import { useResource } from '../../hooks/useResource.js';
import { API } from '../../lib/api.js';
import { DIFFICULTIES, KINDS, LANG_LABEL } from '../../lib/constants.js';
import { Icon } from '../Icon.jsx';
import { Button, Card, CardHeader, Field, Input, Select } from '../ui/index.js';

export function QuestionFilterPanel({ subjectId, filters, onChange, onReset }) {
  const disabled = !subjectId;
  const activeCount = Object.values(filters).filter(Boolean).length;

  const { data: chapters } = useResource(
    () => API.chapters.list(subjectId),
    [subjectId],
    { skip: disabled }
  );
  const { data: types } = useResource(
    () => API.types.list(subjectId),
    [subjectId],
    { skip: disabled }
  );

  return (
    <Card>
      <CardHeader
        title="ছাঁকনি"
        icon="filter"
        actions={
          activeCount > 0 && (
            <Button type="button" size="sm" variant="ghost" icon="x" onClick={onReset}>
              মুছুন
            </Button>
          )
        }
      />
      <div className="space-y-3 p-3 sm:p-4">
        {disabled && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
            ছাঁকনি ব্যবহার করতে আগে উপরে একটি বিষয় বাছুন।
          </p>
        )}

        <Field label="খুঁজুন">
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={filters.q}
              onChange={(e) => onChange('q', e.target.value)}
              placeholder="লেখা বা গণিত…"
              className="pl-9"
              disabled={disabled}
            />
          </div>
        </Field>

        <Field label="অধ্যায়">
          <Select
            value={filters.chapter_id}
            onChange={(e) => onChange('chapter_id', e.target.value)}
            disabled={disabled}
          >
            <option value="">সব অধ্যায়</option>
            <option value="none">কোনো অধ্যায় নেই</option>
            {(chapters || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="ধরন">
          <Select
            value={filters.type_id}
            onChange={(e) => onChange('type_id', e.target.value)}
            disabled={disabled}
          >
            <option value="">সব ধরন</option>
            {(types || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="প্রকার">
          <Select
            value={filters.kind}
            onChange={(e) => onChange('kind', e.target.value)}
            disabled={disabled}
          >
            <option value="">সব প্রকার</option>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="কঠিনতা">
          <Select
            value={filters.difficulty}
            onChange={(e) => onChange('difficulty', e.target.value)}
            disabled={disabled}
          >
            <option value="">যেকোনো কঠিনতা</option>
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="ভাষা">
          <Select
            value={filters.lang}
            onChange={(e) => onChange('lang', e.target.value)}
            disabled={disabled}
          >
            <option value="">সব ভাষা</option>
            {Object.entries(LANG_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Card>
  );
}
