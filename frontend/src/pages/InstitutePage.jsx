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
    if (!form.name.trim()) return toast.error('Institute name is required');
    setSaving(true);
    try {
      await API.institute.update({
        name: form.name.trim(),
        location: form.location.trim(),
      });
      toast.success('Institute updated');
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
      toast.error('Logo must be 5 MB or smaller');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      await API.institute.uploadLogo(file);
      toast.success('Logo uploaded');
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
      toast.success('Logo removed');
      setConfirmRemoveLogo(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemovingLogo(false);
    }
  };

  if (loading) return <LoadingBlock label="Loading institute…" />;
  if (error) return <ErrorBlock error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Institute profile"
        subtitle="Name, location and logo shown on generated papers"
        icon="building"
        actions={
          <Button icon="pencil" onClick={openEdit}>
            Edit details
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" icon="info" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Name
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {institute.name || <span className="text-slate-400">Not set</span>}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Location
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {institute.location || <span className="text-slate-400">Not set</span>}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Last updated
              </p>
              <p className="mt-1 text-sm text-slate-600">{prettyDate(institute.updated_at)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Logo" icon="image" subtitle="PNG, JPEG, GIF or WebP · max 5 MB" />
          <div className="space-y-3 p-4">
            {institute.logo_url ? (
              <img
                src={institute.logo_url}
                alt="Institute logo"
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
                Upload
              </Button>
              {institute.logo_url && (
                <Button
                  variant="dangerGhost"
                  size="sm"
                  icon="trash"
                  onClick={() => setConfirmRemoveLogo(true)}
                >
                  Remove
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
        title="Edit institute"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ঢাকা আদর্শ বিদ্যালয়"
              autoFocus
            />
          </Field>
          <Field label="Location">
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
        title="Remove the logo?"
        message="This will remove the logo from the institute profile. You can upload a new one any time."
        confirmLabel="Remove logo"
        loading={removingLogo}
        onCancel={() => !removingLogo && setConfirmRemoveLogo(false)}
        onConfirm={removeLogo}
      />
    </>
  );
}
