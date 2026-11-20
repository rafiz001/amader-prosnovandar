import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { API } from '../../lib/api.js';
import { bnNum } from '../../lib/utils.js';
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
    if (!name) return toast.error('অধ্যায়ের নাম আবশ্যক');
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
        toast.success('অধ্যায় তৈরি হয়েছে');
      } else {
        await API.chapters.update(editor.chapter.id, payload);
        toast.success('অধ্যায় হালনাগাদ হয়েছে');
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
      toast.success('অধ্যায় মুছে ফেলা হয়েছে');
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
          title="অধ্যায়সমূহ"
          subtitle="ক্রম অনুযায়ী সাজানো"
          icon="tag"
          actions={
            <Button size="sm" icon="plus" onClick={openCreate}>
              নতুন অধ্যায়
            </Button>
          }
        />
        {loading ? (
          <LoadingBlock label="অধ্যায় লোড হচ্ছে…" />
        ) : error ? (
          <ErrorBlock error={error} onRetry={reload} />
        ) : (chapters || []).length === 0 ? (
          <EmptyState
            icon="tag"
            title="এখনো কোনো অধ্যায় নেই"
            message="অধ্যায় প্রশ্ন গোছাতে সাহায্য করে এবং প্রশ্নপত্র তৈরির সময় বাছাই করা সহজ করে।"
            action={
              <Button size="sm" icon="plus" onClick={openCreate}>
                নতুন অধ্যায়
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {chapters.map((ch) => (
              <li key={ch.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                  {bnNum(ch.position)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{ch.name}</p>
                  {ch.description && (
                    <p className="truncate text-xs text-slate-500">{ch.description}</p>
                  )}
                </div>
                <Badge tone="slate">{bnNum(ch.question_count)}টি প্রশ্ন</Badge>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(ch)}
                    aria-label="অধ্যায় সম্পাদনা"
                  >
                    <Icon name="pencil" className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleting(ch)}
                    aria-label="অধ্যায় মুছুন"
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
        title={editor?.mode === 'create' ? 'নতুন অধ্যায়' : 'অধ্যায় সম্পাদনা'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={saving}>
              বাতিল
            </Button>
            <Button onClick={save} loading={saving}>
              {editor?.mode === 'create' ? 'তৈরি করুন' : 'সংরক্ষণ করুন'}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="নাম" required hint="এই বিষয়ের মধ্যে অনন্য">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="বীজগণিত"
              autoFocus
            />
          </Field>
          <Field label="ক্রম" hint="শেষে যোগ করতে খালি রাখুন">
            <Input
              type="number"
              min="0"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="স্বয়ংক্রিয়"
            />
          </Field>
          <Field label="বিবরণ">
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
        title={`“${deleting?.name || ''}” মুছে ফেলবেন?`}
        message="এই অধ্যায়ের প্রশ্নগুলো থাকবে, তবে কোনো অধ্যায়ের অধীনে থাকবে না।"
        confirmLabel="অধ্যায় মুছুন"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
