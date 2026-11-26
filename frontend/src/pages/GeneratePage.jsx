import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API } from '../lib/api.js';
import { DEFAULT_LAYOUT } from '../lib/paperLayout.js';
import { bnNum } from '../lib/utils.js';
import { Button, Card, CardHeader, Field, Input, PageHeader, Select } from '../components/ui/index.js';
import { QuestionFilterPanel } from '../components/questions/QuestionFilterPanel.jsx';
import { QuestionPicker } from '../components/questions/QuestionPicker.jsx';
import { PaperLayoutPanel } from '../components/paper/PaperLayoutPanel.jsx';
import { PaperView } from '../components/paper/PaperView.jsx';

const EMPTY_FILTERS = {
  q: '',
  kind: '',
  difficulty: '',
  lang: '',
  chapter_id: '',
  type_id: '',
};

export function GeneratePage() {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState({ limit: 20, offset: 0 });
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

  const { data: classes } = useResource(() => API.classes.list(), []);

  const [form, setForm] = useState({
    title: 'প্রশ্নপত্র',
    class_id: '',
    subject_id: '',
    shuffle_questions: false,
    shuffle_options: false,
    include_answers: false,
    save: true,
    introduction: '',
    time: '',
    full_marks: '',
  });

  /* subjects for the selected class */
  const { data: classSubjects } = useResource(
    () => (form.class_id ? API.subjects.list(form.class_id) : Promise.resolve([])),
    [form.class_id]
  );

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage((p) => ({ ...p, offset: 0 }));
  };

  const updateFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage((p) => ({ ...p, offset: 0 }));
  };

  const updateLayout = (patch) => setLayout((l) => ({ ...l, ...patch }));

  const changeClass = (e) => {
    const classId = e.target.value;
    setSelected([]);
    setForm((f) => ({ ...f, class_id: classId, subject_id: '' }));
    resetFilters();
  };

  const changeSubject = (e) => {
    const subjectId = e.target.value;
    setSelected([]);
    setForm((f) => ({ ...f, subject_id: subjectId }));
    resetFilters();
  };

  const toggleQuestion = (q) =>
    setSelected((list) =>
      list.some((item) => item.id === q.id)
        ? list.filter((item) => item.id !== q.id)
        : [...list, q]
    );

  const selectAllQuestions = (items) =>
    setSelected((list) => {
      const byId = new Map(list.map((q) => [q.id, q]));
      items.forEach((q) => byId.set(q.id, q));
      return [...byId.values()];
    });

  const totalMarks = selected.reduce((sum, q) => sum + Number(q.marks || 0), 0);

  const handleGenerate = async (e) => {
    e?.preventDefault?.();
    if (!form.subject_id) {
      return toast.error('প্রশ্ন বাছাইয়ের জন্য একটি বিষয় নির্বাচন করুন');
    }
    if (selected.length === 0) {
      return toast.error('প্রশ্নপত্রের জন্য অন্তত একটি প্রশ্ন নির্বাচন করুন');
    }

    const payload = {
      title: form.title.trim() || 'প্রশ্নপত্র',
      subject_id: Number(form.subject_id),
      question_ids: selected.map((q) => q.id),
      shuffle_questions: form.shuffle_questions,
      shuffle_options: form.shuffle_options,
      include_answers: form.include_answers,
      save: form.save,
    };

    if (form.class_id) payload.class_id = Number(form.class_id);

    const chosenClass = (classes || []).find(
      (cls) => String(cls.id) === String(form.class_id)
    );
    const chosenSubject = (classSubjects || []).find(
      (subject) => String(subject.id) === String(form.subject_id)
    );
    const meta = { subject_id: Number(form.subject_id) };
    if (form.class_id) meta.class_id = Number(form.class_id);
    const className = chosenClass?.name || selected[0]?.class_name;
    const subjectName = chosenSubject?.name || selected[0]?.subject_name;
    if (className) meta.class_name = className;
    if (subjectName) meta.subject_name = subjectName;
    if (form.introduction.trim()) meta.introduction = form.introduction.trim();
    if (form.time.trim()) meta.time = form.time.trim();
    if (form.full_marks.trim()) meta.full_marks = form.full_marks.trim();
    if (Object.keys(meta).length) payload.meta = meta;

    setGenerating(true);
    try {
      const paper = await API.generate(payload);
      setResult(paper);
      toast.success(payload.save ? 'প্রশ্নপত্র তৈরি ও সংরক্ষণ হয়েছে' : 'প্রশ্নপত্র তৈরি হয়েছে');
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
          title="তৈরি প্রশ্নপত্র"
          subtitle="প্রশ্নপত্র দেখে নিন, তারপর মুদ্রণ বা সংরক্ষণ করুন"
          icon="sparkles"
          actions={
            <Button icon="refresh" onClick={() => setResult(null)}>
              নতুন প্রশ্নপত্র
            </Button>
          }
        />
        <div className="paper-print-block grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <PaperView
              paper={result}
              layout={layout}
              onBack={() => setResult(null)}
              backLabel="ফর্মে ফিরে যান"
            />
          </div>
          <aside className="sticky top-14 z-10 self-start max-h-[calc(100vh-4rem)] overflow-y-auto print:hidden">
            <PaperLayoutPanel
              layout={layout}
              onChange={updateLayout}
              hasLogo={!!result?.institute?.logo_url}
            />
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="প্রশ্নপত্র তৈরি"
        subtitle="যে প্রশ্নগুলো চান বেছে নিন, তারপর প্রশ্নপত্র তৈরি করুন"
        icon="sparkles"
      />

      <form onSubmit={handleGenerate} className="space-y-4">
        <Card>
          <CardHeader title="পরিধি" icon="layers" />
          <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
            <Field label="শিরোনাম" required>
              <Input value={form.title} onChange={set('title')} />
            </Field>
            <Field label="শ্রেণি">
              <Select value={form.class_id} onChange={changeClass}>
                <option value="">— কোনোটি নয় —</option>
                {(classes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="বিষয়" hint="এই বিষয়ের প্রশ্নগুলো তালিকায় দেখানো হবে" required>
              <Select
                value={form.subject_id}
                onChange={changeSubject}
                disabled={!form.class_id}
              >
                <option value="">— কোনোটি নয় —</option>
                {(classSubjects || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-4">
            <QuestionPicker
              subjectId={form.subject_id}
              selected={selected}
              onToggle={toggleQuestion}
              onClear={() => setSelected([])}
              onSelectAll={selectAllQuestions}
              filters={filters}
              page={page}
              onPageChange={setPage}
            />

            <Card>
              <CardHeader title="ফলাফল" icon="file" />
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                {[
                  ['shuffle_questions', 'প্রশ্নের ক্রম এলোমেলো করুন'],
                  ['shuffle_options', 'বহুনির্বাচনি বিকল্পের ক্রম এলোমেলো করুন (সঠিক উত্তর হালনাগাদ হবে)'],
                  ['include_answers', 'উত্তর ও উত্তরমালা অন্তর্ভুক্ত করুন'],
                  ['save', 'প্রশ্নপত্রটি “প্রশ্নপত্রসমূহ”-এ সংরক্ষণ করুন'],
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
                <Field label="পরিচিতি" className="sm:col-span-2">
                  <Input
                    value={form.introduction}
                    onChange={set('introduction')}
                    placeholder="পরীক্ষা বা সাজেশন লিখুন"
                  />
                </Field>
                <Field label="সময়">
                  <Input
                    value={form.time}
                    onChange={set('time')}
                    placeholder="১ ঘণ্টা"
                  />
                </Field>
                <Field label="পূর্ণমান">
                  <Input
                    value={form.full_marks}
                    onChange={set('full_marks')}
                    placeholder="স্বয়ংক্রিয় (মোট নম্বর)"
                  />
                </Field>
              </div>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{bnNum(selected.length)}</span>টি
                প্রশ্ন নির্বাচিত
                {selected.length > 0 && (
                  <>
                    {' '}
                    · <span className="font-semibold text-slate-700">{bnNum(totalMarks)}</span>{' '}
                    নম্বর
                  </>
                )}
              </p>
              <Button type="submit" icon="sparkles" loading={generating}>
                প্রশ্নপত্র তৈরি করুন
              </Button>
            </div>
          </div>

          <aside
            className="order-first self-start print:hidden xl:order-last xl:sticky xl:top-14"
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
          >
            <QuestionFilterPanel
              subjectId={form.subject_id}
              filters={filters}
              onChange={updateFilter}
              onReset={resetFilters}
            />
          </aside>
        </div>
      </form>
    </>
  );
}
