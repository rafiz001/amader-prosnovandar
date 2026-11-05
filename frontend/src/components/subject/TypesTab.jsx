import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { API } from '../../lib/api.js';
import { num } from '../../lib/utils.js';
import { Icon } from '../Icon.jsx';
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  KindBadge,
  LoadingBlock,
  Modal,
  Select,
} from '../ui/index.js';

export function TypesTab({ subjectId, onChanged }) {
  const toast = useToast();
  const { data: types, loading, error, reload } = useResource(
    () => API.types.list(subjectId),
    [subjectId]
  );

  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({ name: '', kind: 'text' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const openCreate = () => {
    setForm({ name: '', kind: 'text' });
    setEditor({ mode: 'create' });
  };
  const openEdit = (t) => {
    setForm({ name: t.name || '', kind: t.kind || 'text' });
    setEditor({ mode: 'edit', type: t });
  };

  const save = async (e) => {
    e?.preventDefault?.();
    const name = form.name.trim();
    if (!name) return toast.error('Type name is required');
    setSaving(true);
    try {
      if (editor.mode === 'create') {
        await API.types.create(subjectId, { name, kind: form.kind });
        toast.success('Question type created');
      } else {
        const payload = { name };
        if (form.kind !== editor.type.kind) payload.kind = form.kind;
        await API.types.update(editor.type.id, payload);
        toast.success('Question type updated');
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
      await API.types.remove(deleting.id);
      toast.success('Question type deleted');
      setDeleting(null);
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  const inUse = editor?.mode === 'edit' && editor.type.question_count > 0;

  return (
    <>
      <Card>
        <CardHeader
          title="Question types"
          subtitle="Each subject owns its own list of types"
          icon="grid"
          actions={
            <Button size="sm" icon="plus" onClick={openCreate}>
              New type
            </Button>
          }
        />
        {loading ? (
          <LoadingBlock label="Loading types…" />
        ) : error ? (
          <ErrorBlock error={error} onRetry={reload} />
        ) : (types || []).length === 0 ? (
          <EmptyState
            icon="grid"
            title="No question types"
            message="Every subject starts with MCQ, True/False and Plain, but they seem to be missing."
            action={
              <Button size="sm" icon="plus" onClick={openCreate}>
                New type
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {types.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <KindBadge kind={t.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {num(t.question_count)} {t.question_count === 1 ? 'question' : 'questions'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(t)}
                    aria-label="Edit type"
                  >
                    <Icon name="pencil" className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleting(t)}
                    aria-label="Delete type"
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
        title={editor?.mode === 'create' ? 'New question type' : 'Edit question type'}
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
          <Field label="Name" required hint="Unique within this subject (case-insensitive)">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="সৃজনশীল"
              autoFocus
            />
          </Field>
          <Field
            label="Kind"
            required
            hint={
              inUse
                ? 'Cannot be changed while questions use this type'
                : 'Determines how questions are validated'
            }
          >
            <Select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              disabled={inUse}
            >
              <option value="mcq">MCQ — 4 options + correct option</option>
              <option value="true_false">True/False</option>
              <option value="text">Text — plain, optional model answer</option>
            </Select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name || ''}”?`}
        message={
          deleting && deleting.question_count > 0
            ? `${deleting.question_count} question(s) still use this type. Delete or move them first — the API will refuse otherwise.`
            : 'This removes the type from this subject.'
        }
        confirmLabel="Delete type"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
