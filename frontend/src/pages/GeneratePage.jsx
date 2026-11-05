import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API } from '../lib/api.js';
import { DIFFICULTIES, KINDS } from '../lib/constants.js';
import { cn } from '../lib/utils.js';
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui/index.js';
import { PaperView } from '../components/paper/PaperView.jsx';

export function GeneratePage() {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { data: classes } = useResource(() => API.classes.list(), []);

  const [form, setForm] = useState({
    title: 'Question Paper',
    class_id: '',
    subject_id: '',
    question_ids_text: '',
    enable_random: true,
    random_mode: 'count',
    count: 10,
    by_type_json: '{\n  "MCQ": 5,\n  "Plain": 2\n}',
    by_chapter_json: '{\n  "1": 5\n}',
    kinds: [],
    difficulty: [],
    allow_fewer: false,
    shuffle_questions: false,
    shuffle_options: false,
    include_answers: false,
    save: false,
    duration_minutes: '',
  });

  /* subjects for the selected class */
  const { data: classSubjects } = useResource(
    () => (form.class_id ? API.subjects.list(form.class_id) : Promise.resolve([])),
    [form.class_id]
  );

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));

  const toggleIn = (key, value) =>
    setForm((f) => {
      const next = new Set(f[key]);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...f, [key]: [...next] };
    });

  const handleGenerate = async (e) => {
    e?.preventDefault?.();
    if (!form.class_id && !form.subject_id) {
      return toast.error('Choose a class or a subject');
    }

    const payload = {
      title: form.title.trim() || 'Question Paper',
      shuffle_questions: form.shuffle_questions,
      shuffle_options: form.shuffle_options,
      include_answers: form.include_answers,
      save: form.save,
    };

    if (form.class_id) payload.class_id = Number(form.class_id);
    if (form.subject_id) payload.subject_id = Number(form.subject_id);

    /* hand-picked */
    if (form.question_ids_text.trim()) {
      const ids = form.question_ids_text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s));
      if (ids.some((n) => !Number.isInteger(n) || n < 1)) {
        return toast.error('Question IDs must be positive integers');
      }
      payload.question_ids = ids;
    }

    /* random */
    if (form.enable_random) {
      const random = { allow_fewer: form.allow_fewer };

      if (form.random_mode === 'count') {
        const n = Number(form.count);
        if (!Number.isInteger(n) || n < 1) {
          return toast.error('Count must be at least 1');
        }
        random.count = n;
      } else if (form.random_mode === 'by_type') {
        try {
          const parsed = JSON.parse(form.by_type_json);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error();
          }
          random.by_type = parsed;
        } catch {
          return toast.error('By-type must be a JSON object, e.g. {"MCQ": 5}');
        }
      } else if (form.random_mode === 'by_chapter') {
        try {
          const parsed = JSON.parse(form.by_chapter_json);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error();
          }
          random.by_chapter = parsed;
        } catch {
          return toast.error('By-chapter must be a JSON object, e.g. {"1": 5}');
        }
      }

      if (form.kinds.length > 0) random.kinds = form.kinds;
      if (form.difficulty.length > 0) random.difficulty = form.difficulty;

      payload.random = random;
    }

    if (!payload.question_ids && !payload.random) {
      return toast.error('Add hand-picked questions or enable random picking');
    }

    if (form.duration_minutes) {
      payload.meta = { duration_minutes: Number(form.duration_minutes) };
    }

    setGenerating(true);
    try {
      const paper = await API.generate(payload);
      setResult(paper);
      toast.success(payload.save ? 'Paper generated and saved' : 'Paper generated');
    } catch (err) {
      if (err.status === 422) {
        toast.error(
          'Not enough questions match those filters. Try “Allow fewer” or adjust the filters.'
        );
      } else {
        toast.error(err.message);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (result) {
    return (
      <>
        <PageHeader
          title="Generated paper"
          subtitle="Review the paper, then print or save it"
          icon="sparkles"
          actions={
            <Button icon="refresh" onClick={() => setResult(null)}>
              New paper
            </Button>
          }
        />
        <PaperView paper={result} onBack={() => setResult(null)} backLabel="Back to form" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Generate paper"
        subtitle="Hand-pick questions, pick randomly, or both"
        icon="sparkles"
      />

      <form onSubmit={handleGenerate} className="space-y-4">
        <Card>
          <CardHeader title="Scope" icon="layers" />
          <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
            <Field label="Title" required>
              <Input value={form.title} onChange={set('title')} />
            </Field>
            <Field label="Class" hint="Used as scope for random picking">
              <Select
                value={form.class_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    class_id: e.target.value,
                    subject_id: '',
                  }))
                }
              >
                <option value="">— None —</option>
                {(classes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" hint="Optional — narrows the scope">
              <Select
                value={form.subject_id}
                onChange={set('subject_id')}
                disabled={!form.class_id}
              >
                <option value="">— None —</option>
                {(classSubjects || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Hand-picked questions"
            subtitle="Comma-separated IDs, kept in this order and placed first"
            icon="list"
          />
          <div className="p-4 sm:p-5">
            <Input
              value={form.question_ids_text}
              onChange={set('question_ids_text')}
              placeholder="12, 15, 23"
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Random picking"
            subtitle="Picks never repeat a question"
            icon="shuffle"
            actions={
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.enable_random}
                  onChange={(e) => setForm((f) => ({ ...f, enable_random: e.target.checked }))}
                  className="h-4 w-4 accent-indigo-600"
                />
                Enable
              </label>
            }
          />
          {form.enable_random && (
            <div className="space-y-4 p-4 sm:p-5">
              <Field label="Pick by">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { value: 'count', label: 'Total count' },
                    { value: 'by_type', label: 'By type' },
                    { value: 'by_chapter', label: 'By chapter' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, random_mode: opt.value }))}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-medium transition',
                        form.random_mode === opt.value
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>

              {form.random_mode === 'count' && (
                <Field label="Number of questions" required>
                  <Input type="number" min="1" value={form.count} onChange={set('count')} />
                </Field>
              )}

              {form.random_mode === 'by_type' && (
                <Field
                  label="Counts per type (JSON)"
                  hint='Keys: type id, type name or kind — e.g. {"MCQ": 5, "Plain": 2}'
                >
                  <Textarea
                    rows={5}
                    value={form.by_type_json}
                    onChange={set('by_type_json')}
                    className="font-mono text-xs"
                  />
                </Field>
              )}

              {form.random_mode === 'by_chapter' && (
                <Field
                  label="Counts per chapter (JSON)"
                  hint='Keys: chapter id or "none" — e.g. {"1": 5, "2": 3}'
                >
                  <Textarea
                    rows={5}
                    value={form.by_chapter_json}
                    onChange={set('by_chapter_json')}
                    className="font-mono text-xs"
                  />
                </Field>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Only these kinds">
                  <div className="flex flex-wrap gap-2 pt-1">
                    {KINDS.map((k) => (
                      <label
                        key={k.value}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.kinds.includes(k.value)}
                          onChange={() => toggleIn('kinds', k.value)}
                          className="h-3.5 w-3.5 accent-indigo-600"
                        />
                        {k.label}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Only these difficulties">
                  <div className="flex flex-wrap gap-2 pt-1">
                    {DIFFICULTIES.map((d) => (
                      <label
                        key={d.value}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.difficulty.includes(d.value)}
                          onChange={() => toggleIn('difficulty', d.value)}
                          className="h-3.5 w-3.5 accent-indigo-600"
                        />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.allow_fewer}
                  onChange={(e) => setForm((f) => ({ ...f, allow_fewer: e.target.checked }))}
                  className="h-4 w-4 accent-indigo-600"
                />
                Allow fewer questions if the pool is too small
              </label>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Output" icon="file" />
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {[
              ['shuffle_questions', 'Shuffle questions'],
              ['shuffle_options', 'Shuffle MCQ options (correct answer is updated)'],
              ['include_answers', 'Include answers & answer key'],
              ['save', 'Save the paper to “Papers”'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-indigo-600"
                />
                {label}
              </label>
            ))}
            <Field label="Duration (minutes)" className="sm:col-span-2">
              <Input
                type="number"
                min="1"
                value={form.duration_minutes}
                onChange={set('duration_minutes')}
                placeholder="90"
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" icon="sparkles" loading={generating}>
            Generate paper
          </Button>
        </div>
      </form>
    </>
  );
}
