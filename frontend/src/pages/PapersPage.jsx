import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API } from '../lib/api.js';
import { DEFAULT_LAYOUT } from '../lib/paperLayout.js';
import { bnNum, prettyDate } from '../lib/utils.js';
import { Icon } from '../components/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
} from '../components/ui/index.js';
import { PaperLayoutPanel } from '../components/paper/PaperLayoutPanel.jsx';
import { PaperView } from '../components/paper/PaperView.jsx';

function PaperDetail({ id, onBack }) {
  const { data: paper, loading, error, reload } = useResource(() => API.papers.get(id), [id]);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  if (loading) return <LoadingBlock label="প্রশ্নপত্র লোড হচ্ছে…" />;
  if (error) return <ErrorBlock error={error} onRetry={reload} />;
  return (
    <div className="paper-print-block grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <PaperView paper={paper} layout={layout} onBack={onBack} />
      </div>
      <aside className="sticky top-14 z-10 self-start max-h-[calc(100vh-4rem)] overflow-y-auto print:hidden">
        <PaperLayoutPanel
          layout={layout}
          onChange={(patch) => setLayout((current) => ({ ...current, ...patch }))}
          hasLogo={!!paper?.institute?.logo_url}
        />
      </aside>
    </div>
  );
}

export function PapersPage() {
  const toast = useToast();
  const [viewingId, setViewingId] = useState(null);
  const { data: papers, loading, error, reload } = useResource(() => API.papers.list(), []);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  if (viewingId != null) {
    return <PaperDetail id={viewingId} onBack={() => { setViewingId(null); reload(); }} />;
  }

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await API.papers.remove(deleting.id);
      toast.success('প্রশ্নপত্র মুছে ফেলা হয়েছে');
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="সংরক্ষিত প্রশ্নপত্র"
        subtitle="প্রশ্নপত্র তৈরির সময় আপনি যেগুলো সংরক্ষণ করেছেন"
        icon="file"
      />

      {loading ? (
        <LoadingBlock label="প্রশ্নপত্র লোড হচ্ছে…" />
      ) : error ? (
        <ErrorBlock error={error} onRetry={reload} />
      ) : (papers || []).length === 0 ? (
        <Card>
          <EmptyState
            icon="file"
            title="কোনো সংরক্ষিত প্রশ্নপত্র নেই"
            message="“সংরক্ষণ” চিহ্নিত করে প্রশ্নপত্র তৈরি করুন, তা এখানে দেখা যাবে।"
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {papers.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Icon name="file" className="h-4 w-4" />
                </span>
                <button onClick={() => setViewingId(p.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500">সংরক্ষিত {prettyDate(p.created_at)}</p>
                </button>
                <Badge tone="slate">#{bnNum(p.id)}</Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleting(p)}
                  aria-label="প্রশ্নপত্র মুছুন"
                >
                  <Icon name="trash" className="h-4 w-4 text-rose-600" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`“${deleting?.title || ''}” মুছে ফেলবেন?`}
        message="এই সংরক্ষিত প্রশ্নপত্রটি স্থায়ীভাবে মুছে যাবে।"
        confirmLabel="প্রশ্নপত্র মুছুন"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
