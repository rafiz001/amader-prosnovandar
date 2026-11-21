import { useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { API } from '../../lib/api.js';
import { bnNum } from '../../lib/utils.js';
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
    if (!name) return toast.error('ধরনের নাম আবশ্যক');
    setSaving(true);
    try {
      if (editor.mode === 'create') {
        await API.types.create(subjectId, { name, kind: form.kind });
        toast.success('প্রশ্নের ধরন তৈরি হয়েছে');
      } else {
        const payload = { name };
        if (form.kind !== editor.type.kind) payload.kind = form.kind;
        await API.types.update(editor.type.id, payload);
        toast.success('প্রশ্নের ধরন হালনাগাদ হয়েছে');
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
      toast.success('প্রশ্নের ধরন মুছে ফেলা হয়েছে');
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
          title="প্রশ্নের ধরন"
          subtitle="প্রতিটি বিষয়ের নিজস্ব ধরনের তালিকা থাকে"
          icon="grid"
          actions={
            <Button size="sm" icon="plus" onClick={openCreate}>
              নতুন ধরন
            </Button>
          }
        />
        {loading ? (
          <LoadingBlock label="ধরন লোড হচ্ছে…" />
        ) : error ? (
          <ErrorBlock error={error} onRetry={reload} />
        ) : (types || []).length === 0 ? (
          <EmptyState
            icon="grid"
            title="কোনো প্রশ্নের ধরন নেই"
            message="প্রতিটি বিষয় বহুনির্বাচনি, সত্য/মিথ্যা ও লিখিত দিয়ে শুরু হয়, কিন্তু সেগুলো অনুপস্থিত মনে হচ্ছে।"
            action={
              <Button size="sm" icon="plus" onClick={openCreate}>
                নতুন ধরন
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
                  <p className="text-xs text-slate-500">{bnNum(t.question_count)}টি প্রশ্ন</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(t)}
                    aria-label="ধরন সম্পাদনা"
                  >
                    <Icon name="pencil" className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleting(t)}
                    aria-label="ধরন মুছুন"
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
        title={editor?.mode === 'create' ? 'নতুন প্রশ্নের ধরন' : 'প্রশ্নের ধরন সম্পাদনা'}
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
          <Field label="নাম" required hint="এই বিষয়ের মধ্যে অনন্য (বড়-ছোট হাতের অক্ষর নির্বিশেষে)">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="সৃজনশীল"
              autoFocus
            />
          </Field>
          <Field
            label="ধরন"
            required
            hint={
              inUse
                ? 'এই ধরন ব্যবহার করে প্রশ্ন থাকা অবস্থায় পরিবর্তন করা যাবে না'
                : 'প্রশ্ন কীভাবে যাচাই হবে তা নির্ধারণ করে'
            }
          >
            <Select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              disabled={inUse}
            >
              <option value="mcq">বহুনির্বাচনি — ৪টি বিকল্প + সঠিক বিকল্প</option>
              <option value="true_false">সত্য/মিথ্যা</option>
              <option value="text">লিখিত — সাধারণ, ঐচ্ছিক আদর্শ উত্তর</option>
            </Select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`“${deleting?.name || ''}” মুছে ফেলবেন?`}
        message={
          deleting && deleting.question_count > 0
            ? `${bnNum(deleting.question_count)}টি প্রশ্ন এখনো এই ধরন ব্যবহার করছে। আগে সেগুলো মুছুন বা সরান — অন্যথায় পরিবর্তনটি প্রত্যাখ্যাত হবে।`
            : 'এটি এই বিষয় থেকে ধরনটি সরিয়ে দেবে।'
        }
        confirmLabel="ধরন মুছুন"
        loading={removing}
        onCancel={() => !removing && setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
