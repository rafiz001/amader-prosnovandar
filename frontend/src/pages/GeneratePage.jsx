import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API } from '../lib/api.js';
import { num } from '../lib/utils.js';
import { Button, Card, CardHeader, Field, Input, PageHeader, Select } from '../components/ui/index.js';
import { QuestionPicker } from '../components/questions/QuestionPicker.jsx';
import { PaperView } from '../components/paper/PaperView.jsx';

export function GeneratePage() {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState([]);

  const { data: classes } = useResource(() => API.classes.list(), []);

  const [form, setForm] = useState({
    title: 'Question Paper',
    class_id: '',
    subject_id: '',
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

  const changeClass = (e) => {
    const classId = e.target.value;
    setSelected([]);
    setForm((f) => ({ ...f, class_id: classId, subject_id: '' }));
  };

  const changeSubject = (e) => {
    const subjectId = e.target.value;
    setSelected([]);
    setForm((f) => ({ ...f, subject_id: subjectId }));
  };

  const toggleQuestion = (q) =>
    setSelected((list) =>
      list.some((item) => item.id === q.id)
        ? list.filter((item) => item.id !== q.id)
        : [...list, q]
    );

  const totalMarks = selected.reduce((sum, q) => sum + num(q.marks), 0);

  const handleGenerate = async (e) => {
    e?.preventDefault?.();
    if (!form.subject_id) {
      return toast.error('Choose a subject to pick questions from');
    }
    if (selected.length === 0) {
      return toast.error('Select at least one question for the paper');
    }

    const payload = {
      title: form.title.trim() || 'Question Paper',
      subject_id: Number(form.subject_id),
      question_ids: selected.map((q) => q.id),
      shuffle_questions: form.shuffle_questions,
      shuffle_options: form.shuffle_options,
      include_answers: form.include_answers,
      save: form.save,
    };

    if (form.class_id) payload.class_id = Number(form.class_id);
    if (form.duration_minutes) {
      payload.meta = { duration_minutes: Number(form.duration_minutes) };
    }

    setGenerating(true);
    try {
      const paper = await API.generate(payload);
      setResult(paper);
      toast.success(payload.save ? 'Paper generated and saved' : 'Paper generated');
    } catch (err) {
      toast.error(err.message);
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
        subtitle="Pick the questions you want, then build the paper"
        icon="sparkles"
      />

      <form onSubmit={handleGenerate} className="space-y-4">
        <Card>
          <CardHeader title="Scope" icon="layers" />
          <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
            <Field label="Title" required>
              <Input value={form.title} onChange={set('title')} />
            </Field>
            <Field label="Class">
              <Select value={form.class_id} onChange={changeClass}>
                <option value="">— None —</option>
                {(classes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" hint="Questions are listed for this subject" required>
              <Select
                value={form.subject_id}
                onChange={changeSubject}
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

        <QuestionPicker
          key={form.subject_id || 'none'}
          subjectId={form.subject_id}
          selected={selected}
          onToggle={toggleQuestion}
          onClear={() => setSelected([])}
        />

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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{selected.length}</span> question
            {selected.length === 1 ? '' : 's'} selected
            {selected.length > 0 && (
              <>
                {' '}
                · <span className="font-semibold text-slate-700">{num(totalMarks)}</span> marks
              </>
            )}
          </p>
          <Button type="submit" icon="sparkles" loading={generating}>
            Generate paper
          </Button>
        </div>
      </form>
    </>
  );
}
