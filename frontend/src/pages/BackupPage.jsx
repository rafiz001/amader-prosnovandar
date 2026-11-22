import { useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { API, fileToBase64, saveDownload } from '../lib/api.js';
import { bnNum } from '../lib/utils.js';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorBlock,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
} from '../components/ui/index.js';

function RestoreResult({ result }) {
  const full = result.scope === 'full';
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm leading-relaxed text-emerald-800">
      <p className="font-semibold">পুনরুদ্ধার সম্পন্ন হয়েছে</p>
      {full ? (
        <p className="mt-1">
          {bnNum(result.classes)}টি শ্রেণি, {bnNum(result.subjects)}টি বিষয়,{' '}
          {bnNum(result.questions)}টি প্রশ্ন ও {bnNum(result.papers)}টি সংরক্ষিত প্রশ্নপত্র পাওয়া
          গেছে।
        </p>
      ) : (
        <p className="mt-1">
          নতুন শ্রেণি {bnNum(result.classes_created)}টি, নতুন বিষয় {bnNum(result.subjects_created)}টি
          ও নতুন প্রশ্ন {bnNum(result.questions_added)}টি যোগ হয়েছে
          {result.questions_skipped_duplicate
            ? `; ${bnNum(result.questions_skipped_duplicate)}টি নকল প্রশ্ন বাদ গেছে`
            : ''}
          ।
        </p>
      )}
    </div>
  );
}

export function BackupPage() {
  const toast = useToast();
  const { data: classes, loading, error, reload } = useResource(() => API.classes.list(), []);

  const [classId, setClassId] = useState('');
  const [busy, setBusy] = useState('');
  const [file, setFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!classes?.length) {
      if (classId) setClassId('');
      return;
    }
    if (!classes.some((cls) => String(cls.id) === classId)) {
      setClassId(String(classes[0].id));
    }
  }, [classes, classId]);

  const fullBackup = async () => {
    setBusy('full');
    try {
      const backup = await API.backup.exportFull();
      const path = await saveDownload(backup);
      toast.success(path ? `ব্যাকআপ সংরক্ষিত হয়েছে: ${path}` : 'সম্পূর্ণ ব্যাকআপ ডাউনলোড হয়েছে');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const classBackup = async () => {
    if (!classId) return toast.error('প্রথমে একটি শ্রেণি নির্বাচন করুন');
    setBusy('class');
    try {
      const backup = await API.backup.exportClass(Number(classId));
      const path = await saveDownload(backup);
      toast.success(path ? `ব্যাকআপ সংরক্ষিত হয়েছে: ${path}` : 'শ্রেণির ব্যাকআপ ডাউনলোড হয়েছে');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const pickFile = (picked) => {
    if (!picked) return;
    setFile(picked);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const restore = async () => {
    if (!file) return;
    setRestoring(true);
    try {
      const data_base64 = await fileToBase64(file);
      const outcome = await API.backup.restore({ data_base64, filename: file.name });
      setResult(outcome);
      setFile(null);
      toast.success('পুনরুদ্ধার সম্পন্ন হয়েছে');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRestoring(false);
      setConfirming(false);
    }
  };

  if (loading) return <LoadingBlock label="ব্যাকআপ তথ্য লোড হচ্ছে…" />;
  if (error) return <ErrorBlock error={error} onRetry={reload} />;

  const list = classes || [];
  const selected = list.find((cls) => String(cls.id) === classId);
  const isSqliteFile = !!file && /\.(sqlite|db)$/i.test(file.name);

  return (
    <>
      <PageHeader
        title="ব্যাকআপ ও পুনরুদ্ধার"
        subtitle="শ্রেণিভিত্তিক বা সম্পূর্ণ ডেটার ব্যাকআপ রাখুন এবং প্রয়োজনে ফিরিয়ে আনুন।"
        icon="database"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="সম্পূর্ণ ব্যাকআপ"
            subtitle="সব শ্রেণি, বিষয়, প্রশ্ন, ছবি ও সংরক্ষিত প্রশ্নপত্র"
            icon="database"
          />
          <div className="space-y-3 p-4 sm:p-5">
            <p className="text-sm leading-relaxed text-slate-600">
              একটি SQLite ব্যাকআপ ফাইলে বর্তমান সব তথ্য সংরক্ষিত হয়। পুনরুদ্ধার করলে বর্তমান সব তথ্য
              এই ব্যাকআপ দিয়ে প্রতিস্থাপিত হবে।
            </p>
            <Button icon="save" loading={busy === 'full'} onClick={fullBackup}>
              সম্পূর্ণ ব্যাকআপ সংরক্ষণ করুন
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="শ্রেণিভিত্তিক ব্যাকআপ"
            subtitle="একটি শ্রেণির বিষয়, অধ্যায়, প্রশ্নের ধরন ও প্রশ্ন"
            icon="layers"
          />
          <div className="space-y-3 p-4 sm:p-5">
            {list.length === 0 ? (
              <p className="text-sm text-slate-500">
                ব্যাকআপ নেওয়ার আগে একটি শ্রেণি তৈরি করুন।
              </p>
            ) : (
              <>
                <Field label="শ্রেণি">
                  <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                    {list.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} · {bnNum(cls.subject_count)}টি বিষয়
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-xs text-slate-500">
                  {selected
                    ? `${bnNum(selected.subject_count)}টি বিষয় আছে। ব্যাকআপটি JSON ফাইলে সংরক্ষিত হবে।`
                    : 'শ্রেণি নির্বাচন করুন।'}
                </p>
                <Button icon="save" loading={busy === 'class'} onClick={classBackup}>
                  শ্রেণির ব্যাকআপ সংরক্ষণ করুন
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="পুনরুদ্ধার"
          subtitle="সম্পূর্ণ ব্যাকআপ (SQLite) বা শ্রেণিভিত্তিক ব্যাকআপ (JSON) ফাইল"
          icon="upload"
        />
        <div className="space-y-4 p-4 sm:p-5">
          <input
            ref={fileRef}
            type="file"
            accept=".sqlite,.db,.json,.yml,.yaml,application/json,application/vnd.sqlite3"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()}>
              ব্যাকআপ ফাইল নির্বাচন করুন
            </Button>
            {file && <Badge tone="slate">{file.name}</Badge>}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-800">
            <p className="font-semibold">সতর্কতা</p>
            <p className="mt-1">
              SQLite সম্পূর্ণ ব্যাকআপ পুনরুদ্ধার করলে বর্তমান সব শ্রেণি, প্রশ্ন ও সংরক্ষিত প্রশ্নপত্র
              প্রতিস্থাপিত হবে। JSON শ্রেণি ব্যাকআপ নতুন শ্রেণি হিসেবে যোগ হবে; একই নামের শ্রেণি
              থাকলে প্রশ্ন যোগ হবে এবং নকল প্রশ্ন বাদ যাবে।
            </p>
          </div>

          {result && <RestoreResult result={result} />}

          <Button
            icon="refresh"
            disabled={!file || restoring}
            loading={restoring}
            onClick={() => setConfirming(true)}
          >
            পুনরুদ্ধার করুন
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="ব্যাকআপ পুনরুদ্ধার করবেন?"
        message={
          isSqliteFile
            ? 'এটি একটি সম্পূর্ণ ব্যাকআপ। বর্তমান সব ডেটা প্রতিস্থাপিত হবে। চালিয়ে যাবেন?'
            : 'শ্রেণিভিত্তিক ব্যাকআপ হলে নতুন শ্রেণি বা প্রশ্ন যোগ হবে। চালিয়ে যাবেন?'
        }
        confirmLabel="পুনরুদ্ধার করুন"
        tone="primary"
        loading={restoring}
        onCancel={() => !restoring && setConfirming(false)}
        onConfirm={restore}
      />
    </>
  );
}
