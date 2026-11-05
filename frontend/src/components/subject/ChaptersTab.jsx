import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { API } from '../../lib/api.js';
import { num } from '../../lib/utils.js';
import { Icon } from '../Icon.jsx';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Modal,
  Textarea,
} from '../ui/index.js';

export function ChaptersTab({ subjectId, onChanged }) {
  const toast = useToast();
  const { data: chapters, loading, error, reload } = useResource(
    () => API.chapters.list(subjectId),
    [subjectId]
  );

  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({ name: '', position: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const openCreate = () => {
    setForm({ name: '', position: '', description: '' });
    setEditor({ mode: 'create' });
  };
  const openEdit = (ch) => {
    setForm({
      name: ch.name || '',
      position: ch.position ?? '',
      description: ch.description || '',
    });
    setEditor({ mode: 'edit', chapter: ch });
  };

  const save = async (e) => {
    e?.preventDefault?.();
    const name = form.name.trim();
    if (!name) return toast.error('Chapter name is required');
    const payload = { name };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.position !== '' && form.position !== null) {
      const pos = Number(form.position);
      if (Number.isFinite(pos)) payload.position = pos;
    }
    setSaving(true);
    try {
      if (editor.mode === 'create') {
        await API.chapters.create(subjectId, payload);
        toast.success('Chapter created');
      } else {
        await API.chapters.update(editor.chapter.id, payload);
        toast.success('Chapter updated');
      }
      setEditor(null);
      reload();
      onChanged?.();
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
      await API.chapters.remove(deleting.id);
      toast.success('Chapter deleted');
      setDeleting(null);
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Chapters"
          subtitle="Ordered by position"
          icon="tag"
          actions={
            <Button size="sm" icon="plus" onClick={openCreate}>
              New chapter
            </Button>
          }
        />
        {loading ? (
          <LoadingBlock label="Loading chapters…" />
        ) : error ? (
          <ErrorBlock error={error} onRetry={reload} />
        ) : (chapters || []).length === 0 ? (
          <EmptyState
            icon="tag"
            title="No chapters yet"
            message="Chapters help you organise questions and pick them when generating a paper."
            action={
              <Button size="sm" icon="plus" onClick={openCreate}>
                New chapter
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {chapters.map((ch) => (
              <li key={ch.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                  {ch.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{ch.name}</p>
                  {ch.description && (
                    <p className="truncate text-xs text-slate-500">{ch.description}</p>
                  )}
                </div>
                <Badge tone="slate">
                  {num(ch.question_count)} {ch.question_count === 1 ? 'question' : 'questions'}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(ch)}
                    aria-label="Edit chapter"
                  >
                    <Icon name="pencil" className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleting(ch)}
                    aria-label="Delete chapter"
                  >
                    <Icon name="trash" className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!editor}
        onClose={() => !saving && setEditor(null)}
        title={editor?.mode === 'create' ? 'New chapter' : 'Edit chapter'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editor?.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Name" required hint="Unique within this subject">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="বীজগণিত"
              autoFocus
            />
          </Field>
          <Field label="Position" hint="Leave empty to add at the end">
            <Input
              type="number"
              min="0"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="Auto"
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name || ''}”?`}
        message="Questions in this chapter will be kept but become chapter-less."
        confirmLabel="Delete chapter"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
