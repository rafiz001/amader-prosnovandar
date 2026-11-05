import { useEffect, useState } from 'react';
import { useNav } from '../context/NavContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API } from '../lib/api.js';
import { num, prettyDate } from '../lib/utils.js';
import { Icon } from '../components/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui/index.js';

export function ClassPage({ classId }) {
  const toast = useToast();
  const nav = useNav();
  const clsRes = useResource(() => API.classes.get(classId), [classId]);
  const subjRes = useResource(() => API.subjects.list(classId), [classId]);

  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const notFound = [clsRes.error, subjRes.error].find((e) => e && e.status === 404);
    if (notFound) {
      toast.error('Class not found');
      nav.back();
    }
  }, [clsRes.error, subjRes.error, nav, toast]);

  const openCreate = () => {
    setForm({ name: '', code: '' });
    setEditor({ mode: 'create' });
  };
  const openEdit = (s) => {
    setForm({ name: s.name || '', code: s.code || '' });
    setEditor({ mode: 'edit', subject: s });
  };

  const save = async (e) => {
    e?.preventDefault?.();
    const name = form.name.trim();
    if (!name) return toast.error('Subject name is required');
    setSaving(true);
    try {
      if (editor.mode === 'create') {
        await API.subjects.create(classId, { name, code: form.code.trim() });
        toast.success('Subject created');
      } else {
        await API.subjects.update(editor.subject.id, {
          name,
          code: form.code.trim(),
        });
        toast.success('Subject updated');
      }
      setEditor(null);
      clsRes.reload();
      subjRes.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await API.subjects.remove(deleting.id);
      toast.success('Subject deleted');
      setDeleting(null);
      clsRes.reload();
      subjRes.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  if (clsRes.loading) return <LoadingBlock label="Loading class…" />;
  if (clsRes.error) return <ErrorBlock error={clsRes.error} onRetry={clsRes.reload} />;

  const cls = clsRes.data;
  const subjects = subjRes.data || [];

  return (
    <>
      <PageHeader
        title={cls.name}
        subtitle={cls.description || 'No description'}
        icon="layers"
        actions={
          <Button icon="plus" onClick={openCreate}>
            New subject
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="indigo">{num(cls.subject_count)} subjects</Badge>
        <Badge tone="slate">Created {prettyDate(cls.created_at)}</Badge>
      </div>

      {subjRes.loading && !subjects.length ? (
        <LoadingBlock label="Loading subjects…" />
      ) : subjRes.error ? (
        <ErrorBlock error={subjRes.error} onRetry={subjRes.reload} />
      ) : subjects.length === 0 ? (
        <Card>
          <EmptyState
            icon="book"
            title="No subjects yet"
            message="Create a subject to start adding chapters, question types and questions."
            action={
              <Button icon="plus" onClick={openCreate}>
                New subject
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <Card
              key={s.id}
              className="group flex flex-col transition hover:-translate-y-0.5 hover:shadow-pop"
            >
              <button
                onClick={() => nav.push({ name: 'subject', id: s.id, label: s.name })}
                className="flex flex-1 flex-col items-start gap-2 p-4 text-left"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Icon name="book" className="h-5 w-5" />
                  </span>
                  {s.code && <Badge tone="slate">{s.code}</Badge>}
                </div>
                <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-900">
                  {s.name}
                </h3>
                <div className="mt-2 grid w-full grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Questions
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{num(s.question_count)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Chapters
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{num(s.chapter_count)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Types
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{num(s.type_count)}</p>
                  </div>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium text-indigo-600">
                  Open <Icon name="chevronRight" className="h-3.5 w-3.5" />
                </span>
              </button>
              <div className="flex items-center justify-end gap-1 border-t border-slate-100 px-3 py-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openEdit(s)}
                  aria-label="Edit subject"
                >
                  <Icon name="pencil" className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleting(s)}
                  aria-label="Delete subject"
                >
                  <Icon name="trash" className="h-4 w-4 text-rose-600" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editor}
        onClose={() => !saving && setEditor(null)}
        title={editor?.mode === 'create' ? 'New subject' : 'Edit subject'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editor?.mode === 'create' ? 'Create' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Name" required hint="Unique within this class">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="গণিত"
              autoFocus
            />
          </Field>
          <Field label="Code" hint="Optional, e.g. M10">
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="M10"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name || ''}”?`}
        message="This will also delete its chapters, question types and questions. This cannot be undone."
        confirmLabel="Delete subject"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
