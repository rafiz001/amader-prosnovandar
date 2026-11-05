import { useEffect, useState } from 'react';
import { useNav } from '../context/NavContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API } from '../lib/api.js';
import { cn, num } from '../lib/utils.js';
import { Icon } from '../components/Icon.jsx';
import { Button, ErrorBlock, LoadingBlock, PageHeader } from '../components/ui/index.js';
import { ChaptersTab } from '../components/subject/ChaptersTab.jsx';
import { TypesTab } from '../components/subject/TypesTab.jsx';
import { QuestionsTab } from '../components/subject/QuestionsTab.jsx';
import { QuestionEditor } from '../components/questions/QuestionEditor.jsx';

export function SubjectPage({ subjectId, initialTab = 'questions' }) {
  const toast = useToast();
  const nav = useNav();
  const [tab, setTab] = useState(initialTab);
  const { data: subject, loading, error, reload } = useResource(
    () => API.subjects.get(subjectId),
    [subjectId]
  );

  const [qEditor, setQEditor] = useState(null);
  const [qVersion, setQVersion] = useState(0);

  useEffect(() => {
    if (error && error.status === 404) {
      toast.error('Subject not found');
      nav.back();
    }
  }, [error, nav, toast]);

  if (loading) return <LoadingBlock label="Loading subject…" />;
  if (error) return <ErrorBlock error={error} onRetry={reload} />;

  const tabs = [
    { key: 'questions', label: 'Questions', icon: 'list', count: subject.question_count },
    { key: 'chapters', label: 'Chapters', icon: 'tag', count: subject.chapter_count },
    { key: 'types', label: 'Question types', icon: 'grid', count: subject.type_count },
  ];

  const onQuestionSaved = () => {
    setQEditor(null);
    setQVersion((v) => v + 1);
    reload();
  };

  return (
    <>
      <PageHeader
        title={subject.name}
        subtitle={subject.code ? `Subject code ${subject.code}` : 'Subject'}
        icon="book"
        actions={
          tab === 'questions' && (
            <Button icon="plus" onClick={() => setQEditor({})}>
              New question
            </Button>
          )
        }
      />

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-card">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
                active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Icon name={t.icon} className="h-4 w-4" />
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {num(t.count)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'chapters' && <ChaptersTab subjectId={subjectId} onChanged={reload} />}
      {tab === 'types' && <TypesTab subjectId={subjectId} onChanged={reload} />}
      {tab === 'questions' && (
        <QuestionsTab
          subjectId={subjectId}
          version={qVersion}
          onCreate={() => setQEditor({})}
          onEdit={(id) => setQEditor({ id })}
          onChanged={reload}
        />
      )}

      {qEditor !== null && (
        <QuestionEditor
          subjectId={subjectId}
          questionId={qEditor.id}
          onClose={() => setQEditor(null)}
          onSaved={onQuestionSaved}
        />
      )}
    </>
  );
}
