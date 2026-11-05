import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API } from '../lib/api.js';
import { prettyDate } from '../lib/utils.js';
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
import { PaperView } from '../components/paper/PaperView.jsx';

function PaperDetail({ id, onBack }) {
  const { data: paper, loading, error, reload } = useResource(() => API.papers.get(id), [id]);
  if (loading) return <LoadingBlock label="Loading paper…" />;
  if (error) return <ErrorBlock error={error} onRetry={reload} />;
  return <PaperView paper={paper} onBack={onBack} />;
}

export function PapersPage() {
  const toast = useToast();
  const [viewingId, setViewingId] = useState(null);
  const { data: papers, loading, error, reload } = useResource(() => API.papers.list(), []);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  if (viewingId != null) {
    return <PaperDetail id={viewingId} onBack={() => setViewingId(null)} />;
  }

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await API.papers.remove(deleting.id);
      toast.success('Paper deleted');
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
        title="Saved papers"
        subtitle="Papers you saved during generation"
        icon="file"
      />

      {loading ? (
        <LoadingBlock label="Loading papers…" />
      ) : error ? (
        <ErrorBlock error={error} onRetry={reload} />
      ) : (papers || []).length === 0 ? (
        <Card>
          <EmptyState
            icon="file"
            title="No saved papers"
            message="Generate a paper with “Save” checked and it will appear here."
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
                  <p className="text-xs text-slate-500">Saved {prettyDate(p.created_at)}</p>
                </button>
                <Badge tone="slate">#{p.id}</Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleting(p)}
                  aria-label="Delete paper"
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
        title={`Delete “${deleting?.title || ''}”?`}
        message="This saved paper will be permanently removed."
        confirmLabel="Delete paper"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
