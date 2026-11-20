import { useRef, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API } from '../lib/api.js';
import { prettyDate } from '../lib/utils.js';
import { Icon } from '../components/Icon.jsx';
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui/index.js';

export function InstitutePage() {
  const toast = useToast();
  const { data: institute, loading, error, reload } = useResource(() => API.institute.get(), []);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const fileRef = useRef(null);

  const openEdit = () => {
    setForm({ name: institute?.name || '', location: institute?.location || '' });
    setEditing(true);
  };

  const save = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) return toast.error('প্রতিষ্ঠানের নাম আবশ্যক');
    setSaving(true);
    try {
      await API.institute.update({
        name: form.name.trim(),
        location: form.location.trim(),
      });
      toast.success('প্রতিষ্ঠান হালনাগাদ হয়েছে');
      setEditing(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onPickLogo = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('লোগো ৫ মেগাবাইট বা তার কম হতে হবে');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      await API.institute.uploadLogo(file);
      toast.success('লোগো আপলোড হয়েছে');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeLogo = async () => {
    setRemovingLogo(true);
    try {
      await API.institute.deleteLogo();
      toast.success('লোগো সরানো হয়েছে');
      setConfirmRemoveLogo(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemovingLogo(false);
    }
  };

  if (loading) return <LoadingBlock label="প্রতিষ্ঠান লোড হচ্ছে…" />;
  if (error) return <ErrorBlock error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="প্রতিষ্ঠানের প্রোফাইল"
        subtitle="তৈরি প্রশ্নপত্রে দেখানো নাম, অবস্থান ও লোগো"
        icon="building"
        actions={
          <Button icon="pencil" onClick={openEdit}>
            বিবরণ সম্পাদনা
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="বিবরণ" icon="info" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                নাম
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {institute.name || <span className="text-slate-400">নির্ধারিত নয়</span>}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                অবস্থান
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {institute.location || <span className="text-slate-400">নির্ধারিত নয়</span>}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                সর্বশেষ হালনাগাদ
              </p>
              <p className="mt-1 text-sm text-slate-600">{prettyDate(institute.updated_at)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="লোগো"
            icon="image"
            subtitle="পিএনজি, জেপিইজি, জিআইএফ বা ওয়েবপি · সর্বোচ্চ ৫ মেগাবাইট"
          />
          <div className="space-y-3 p-4">
            {institute.logo_url ? (
              <img
                src={institute.logo_url}
                alt="প্রতিষ্ঠানের লোগো"
                className="mx-auto grid h-36 w-36 place-items-center rounded-xl border border-slate-200 bg-slate-50 object-contain p-2"
              />
            ) : (
              <div className="mx-auto grid h-36 w-36 place-items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-300">
                <Icon name="image" className="h-10 w-10" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="upload"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                আপলোড
              </Button>
              {institute.logo_url && (
                <Button
                  variant="dangerGhost"
                  size="sm"
                  icon="trash"
                  onClick={() => setConfirmRemoveLogo(true)}
                >
                  সরান
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => onPickLogo(e.target.files?.[0])}
            />
          </div>
        </Card>
      </div>

      <Modal
        open={editing}
        onClose={() => !saving && setEditing(false)}
        title="প্রতিষ্ঠান সম্পাদনা"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              বাতিল
            </Button>
            <Button onClick={save} loading={saving}>
              পরিবর্তন সংরক্ষণ করুন
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="নাম" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ঢাকা আদর্শ বিদ্যালয়"
              autoFocus
            />
          </Field>
          <Field label="অবস্থান">
            <Input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="ঢাকা, বাংলাদেশ"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmRemoveLogo}
        title="লোগোটি সরিয়ে ফেলবেন?"
        message="এটি প্রতিষ্ঠানের প্রোফাইল থেকে লোগো সরিয়ে দেবে। পরে আবার নতুন একটি আপলোড করতে পারবেন।"
        confirmLabel="লোগো সরান"
        loading={removingLogo}
        onCancel={() => !removingLogo && setConfirmRemoveLogo(false)}
        onConfirm={removeLogo}
      />
    </>
  );
}
