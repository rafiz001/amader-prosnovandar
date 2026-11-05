import { useState } from 'react';
import { useNav } from '../context/NavContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API } from '../lib/api.js';
import { num } from '../lib/utils.js';
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
  Textarea,
} from '../components/ui/index.js';

export function ClassesPage() {
  const toast = useToast();
  const nav = useNav();
  const { data: classes, loading, error, reload } = useResource(() => API.classes.list(), []);

  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const openCreate = () => {
    setForm({ name: '', description: '' });
    setEditor({ mode: 'create' });
  };
  const openEdit = (cls) => {
    setForm({ name: cls.name || '', description: cls.description || '' });
    setEditor({ mode: 'edit', cls });
  };

  const save = async (e) => {
    e?.preventDefault?.();
    const name = form.name.trim();
    if (!name) return toast.error('Class name is required');
    setSaving(true);
    try {
      if (editor.mode === 'create') {
        await API.classes.create({ name, description: form.description.trim() });
        toast.success('Class created');
      } else {
        await API.classes.update(editor.cls.id, {
          name,
          description: form.description.trim(),
        });
        toast.success('Class updated');
      }
      setEditor(null);
      reload();
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
      await API.classes.remove(deleting.id);
      toast.success('Class deleted');
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
        title="Classes"
        subtitle="Top-level groups. Each class contains subjects."
        icon="layers"
        actions={
          <Button icon="plus" onClick={openCreate}>
            New class
          </Button>
        }
      />

      {loading ? (
        <LoadingBlock label="Loading classes…" />
      ) : error ? (
        <ErrorBlock error={error} onRetry={reload} />
      ) : classes.length === 0 ? (
        <Card>
          <EmptyState
            icon="layers"
            title="No classes yet"
            message="Create your first class to start organising subjects."
            action={
              <Button icon="plus" onClick={openCreate}>
                New class
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card
              key={cls.id}
              className="group flex flex-col transition hover:-translate-y-0.5 hover:shadow-pop"
            >
              <button
                onClick={() => nav.push({ name: 'class', id: cls.id, label: cls.name })}
                className="flex flex-1 flex-col items-start gap-2 p-4 text-left"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Icon name="layers" className="h-5 w-5" />
                  </span>
                  <Badge tone="slate">
                    {num(cls.subject_count)} {cls.subject_count === 1 ? 'subject' : 'subjects'}
                  </Badge>
                </div>
                <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-900">
                  {cls.name}
                </h3>
                {cls.description ? (
                  <p className="line-clamp-2 text-sm text-slate-500">{cls.description}</p>
                ) : (
                  <p className="text-sm text-slate-400">No description</p>
                )}
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium text-indigo-600">
                  Open <Icon name="chevronRight" className="h-3.5 w-3.5" />
                </span>
              </button>
              <div className="flex items-center justify-end gap-1 border-t border-slate-100 px-3 py-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openEdit(cls)}
                  aria-label="Edit class"
                >
                  <Icon name="pencil" className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleting(cls)}
                  aria-label="Delete class"
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
        title={editor?.mode === 'create' ? 'New class' : 'Edit class'}
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
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="দশম শ্রেণি"
              autoFocus
            />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Anything that helps identify this class"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name || ''}”?`}
        message="This will also delete every subject, chapter, question type and question inside it. This cannot be undone."
        confirmLabel="Delete class"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
