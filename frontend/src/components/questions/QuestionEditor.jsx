import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { API } from '../../lib/api.js';
import { DIFFICULTIES, KIND_LABEL } from '../../lib/constants.js';
import { cn } from '../../lib/utils.js';
import { Icon } from '../Icon.jsx';
import {
  Button,
  Field,
  Input,
  LoadingBlock,
  Modal,
  Select,
  Textarea,
} from '../ui/index.js';

export function QuestionEditor({ subjectId, questionId, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = questionId != null;

  const { data: types } = useResource(() => API.types.list(subjectId), [subjectId]);
  const { data: chapters } = useResource(() => API.chapters.list(subjectId), [subjectId]);
  const { data: existing, loading: loadingQ } = useResource(
    () => (isEdit ? API.questions.get(questionId) : Promise.resolve(null)),
    [questionId, isEdit],
    { skip: !isEdit }
  );

  const emptyForm = {
    type_id: '',
    chapter_id: '',
    text: '',
    math: '',
    options: ['', '', '', ''],
    correct_option: 1,
    answer: 'true',
    description: '',
    marks: 1,
    difficulty: 'medium',
    lang: 'en',
  };

  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  /* populate from existing question (edit mode) */
  useEffect(() => {
    if (!existing) return;
    setForm({
      type_id: existing.type_id ?? '',
      chapter_id: existing.chapter_id ?? '',
      text: existing.text || '',
      math: existing.math || '',
      options:
        Array.isArray(existing.options) && existing.options.length === 4
          ? existing.options.slice()
          : ['', '', '', ''],
      correct_option: existing.correct_option ?? 1,
      answer:
        existing.kind === 'true_false'
          ? String(existing.answer) === 'false'
            ? 'false'
            : 'true'
          : existing.answer || '',
      description: existing.description || '',
      marks: existing.marks ?? 1,
      difficulty: existing.difficulty || 'medium',
      lang: existing.lang || 'en',
    });
    setRemoveImage(false);
    setImageFile(null);
    setImagePreview(null);
  }, [existing]);

  /* default the type selector (create mode) */
  useEffect(() => {
    if (!isEdit && !form.type_id && types && types.length > 0) {
      setForm((f) => ({ ...f, type_id: types[0].id }));
    }
  }, [types, isEdit, form.type_id]);

  /* release preview URLs */
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const selectedType = (types || []).find((t) => t.id === Number(form.type_id));
  const kind = selectedType?.kind || 'text';

  const previewSrc =
    imagePreview || (!removeImage && existing?.image_url ? existing.image_url : null);

  const onPickImage = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const validate = () => {
    const hasContent =
      form.text.trim() || form.math.trim() || imageFile || (!removeImage && existing?.image_url);
    if (!hasContent) {
      toast.error('Add question text, math, or an image');
      return false;
    }
    if (!form.type_id) {
      toast.error('Choose a question type');
      return false;
    }
    if (kind === 'mcq') {
      if (form.options.some((o) => !String(o).trim())) {
        toast.error('All 4 options are required');
        return false;
      }
      if (![1, 2, 3, 4].includes(Number(form.correct_option))) {
        toast.error('Pick the correct option (1–4)');
        return false;
      }
    }
    if (kind === 'true_false' && !['true', 'false'].includes(form.answer)) {
      toast.error('Choose the correct answer');
      return false;
    }
    return true;
  };

  const buildPayload = () => {
    const marks = Number(form.marks);
    const payload = {
      type_id: Number(form.type_id),
      chapter_id: form.chapter_id ? Number(form.chapter_id) : null,
      text: form.text,
      math: form.math,
      description: form.description,
      marks: Number.isFinite(marks) && marks >= 0 ? marks : 1,
      difficulty: form.difficulty,
      lang: form.lang,
    };
    if (kind === 'mcq') {
      payload.options = form.options;
      payload.correct_option = Number(form.correct_option);
    } else if (kind === 'true_false') {
      payload.answer = form.answer; // "true" / "false"
    } else if (kind === 'text') {
      payload.answer = form.answer;
    }
    return payload;
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append('type_id', String(form.type_id));
    fd.append('chapter_id', form.chapter_id ? String(form.chapter_id) : '');
    fd.append('text', form.text || '');
    fd.append('math', form.math || '');
    fd.append('description', form.description || '');
    fd.append('marks', String(form.marks));
    fd.append('difficulty', form.difficulty);
    fd.append('lang', form.lang);

    if (kind === 'mcq') {
      form.options.forEach((o, i) => fd.append(`option_${i + 1}`, o));
      fd.append('correct_option', String(form.correct_option));
    } else if (kind === 'true_false' || kind === 'text') {
      fd.append('answer', form.answer || '');
    }

    if (imageFile) fd.append('image', imageFile);
    else if (isEdit && removeImage) fd.append('remove_image', 'true');

    return fd;
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!validate()) return;

    const needsMultipart = !!imageFile || (isEdit && removeImage);
    setSaving(true);
    try {
      if (isEdit) {
        if (needsMultipart) {
          await API.questions.updateForm(questionId, buildFormData());
        } else {
          await API.questions.update(questionId, buildPayload());
        }
        toast.success('Question updated');
      } else {
        if (needsMultipart) {
          await API.questions.createForm(subjectId, buildFormData());
        } else {
          await API.questions.create(subjectId, buildPayload());
        }
        toast.success('Question created');
      }
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose?.()}
      title={isEdit ? 'Edit question' : 'New question'}
      description={
        selectedType
          ? `Type: ${selectedType.name} · ${KIND_LABEL[kind] || kind}`
          : 'Choose a question type'
      }
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button icon="save" onClick={submit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create question'}
          </Button>
        </>
      }
    >
      {isEdit && loadingQ && !existing ? (
        <LoadingBlock label="Loading question…" />
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {/* Type + chapter */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Question type"
              required
              hint="The type decides which fields are required"
            >
              <Select
                value={form.type_id}
                onChange={(e) => setForm((f) => ({ ...f, type_id: e.target.value }))}
              >
                <option value="">— Select —</option>
                {(types || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({KIND_LABEL[t.kind] || t.kind})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Chapter" hint="Leave empty for no chapter">
              <Select
                value={form.chapter_id}
                onChange={(e) => setForm((f) => ({ ...f, chapter_id: e.target.value }))}
              >
                <option value="">— None —</option>
                {(chapters || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Text + math */}
          <Field label="Question text" hint="Inline LaTeX like $x^2$ is supported">
            <Textarea
              rows={3}
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="সমীকরণ $x^2-5x+6=0$ এর বীজ কত?"
            />
          </Field>

          <Field label="Display math (LaTeX)">
            <Input
              value={form.math}
              onChange={(e) => setForm((f) => ({ ...f, math: e.target.value }))}
              placeholder="A = \pi r^2"
              className="font-mono"
            />
          </Field>

          {/* Kind-specific fields */}
          {kind === 'mcq' && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-700">
                Options · pick the correct one
              </p>
              <div className="space-y-2">
                {form.options.map((opt, i) => {
                  const value = i + 1;
                  const checked = Number(form.correct_option) === value;
                  return (
                    <label
                      key={i}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 transition',
                        checked
                          ? 'border-emerald-300 ring-2 ring-emerald-100'
                          : 'border-slate-200'
                      )}
                    >
                      <input
                        type="radio"
                        name="correct_option"
                        checked={checked}
                        onChange={() => setForm((f) => ({ ...f, correct_option: value }))}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                        {String.fromCharCode(64 + value)}
                      </span>
                      <Input
                        value={opt}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = f.options.slice();
                            next[i] = e.target.value;
                            return { ...f, options: next };
                          })
                        }
                        placeholder={`Option ${String.fromCharCode(64 + value)}`}
                        className="border-0 bg-transparent shadow-none focus:ring-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {kind === 'true_false' && (
            <Field label="Correct answer" required>
              <div className="flex gap-2">
                {['true', 'false'].map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setForm((f) => ({ ...f, answer: v }))}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition',
                      form.answer === v
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {v === 'true' ? 'True' : 'False'}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {kind === 'text' && (
            <Field label="Model answer" hint="Optional — saved with the question">
              <Textarea
                rows={2}
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              />
            </Field>
          )}

          <Field label="Explanation / solution" hint="Optional notes">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>

          {/* Figure */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Figure
            </p>
            {previewSrc ? (
              <div className="relative inline-block">
                <img
                  src={previewSrc}
                  alt="Figure preview"
                  className="max-h-44 rounded-lg border border-slate-200 bg-slate-50 object-contain p-2"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                  aria-label="Remove image"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-sm text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
              >
                <Icon name="upload" className="h-4 w-4" />
                Click to attach an image (PNG, JPEG, GIF, WebP · max 5 MB)
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0])}
            />
            {previewSrc && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
              >
                Replace image
              </button>
            )}
          </div>

          {/* Marks / difficulty / lang */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Marks">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={form.marks}
                onChange={(e) => setForm((f) => ({ ...f, marks: e.target.value }))}
              />
            </Field>
            <Field label="Difficulty">
              <Select
                value={form.difficulty}
                onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Language" hint="RTL for ar, fa, ur, he">
              <Input
                value={form.lang}
                onChange={(e) => setForm((f) => ({ ...f, lang: e.target.value }))}
                placeholder="bn"
              />
            </Field>
          </div>
        </form>
      )}
    </Modal>
  );
}
