import { useEffect, useState } from 'react';
import {
  ALIGN_OPTIONS,
  COLUMN_OPTIONS,
  DEFAULT_LAYOUT,
  HEADING_OPTIONS,
  MARKER_STYLES,
  NUMBER_FORMATS,
  ORIENTATIONS,
  PAGE_SIZES,
  QUESTION_MARKER_STYLES,
  WATERMARK_COLOR_OPTIONS,
  WATERMARK_MODES,
  watermarkSettings,
} from '../../lib/paperLayout.js';
import { API } from '../../lib/api.js';
import { bnNum, cn } from '../../lib/utils.js';
import { Icon } from '../Icon.jsx';
import { Button, Card, CardHeader, Field, Input, Select, Toggle } from '../ui/index.js';

const MAX_IMAGE = 5 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function PtStepper({ value, onChange, min = 4, max = 40, step = 0.5 }) {
  const current = Math.min(max, Math.max(min, Number(value) || min));
  const set = (next) =>
    onChange(Math.round(Math.min(max, Math.max(min, next)) * 10) / 10);
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => set(current - step)}
        aria-label="আকার কমান"
      >
        −
      </Button>
      <div className="flex min-w-[4.5rem] items-center justify-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value === '' || value === undefined ? '' : value}
          onChange={(e) =>
            onChange(e.target.value === '' ? '' : Number(e.target.value))
          }
          className="w-14 rounded-md border border-slate-300 bg-white px-1 py-1 text-center text-sm font-semibold text-slate-700 focus:border-indigo-400 focus:outline-none"
        />
        <span className="text-xs text-slate-500">pt</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => set(current + step)}
        aria-label="আকার বাড়ান"
      >
        +
      </Button>
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-2 py-1.5 text-xs font-medium transition',
            value === option.value
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PaperLayoutPanel({ layout, onChange, hasLogo = true }) {
  const l = {
    ...DEFAULT_LAYOUT,
    ...layout,
    headings: { ...DEFAULT_LAYOUT.headings, ...(layout?.headings || {}) },
    watermark: watermarkSettings(layout?.watermark),
  };
  const [presets, setPresets] = useState([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [presetId, setPresetId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presetError, setPresetError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [presetBusy, setPresetBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    API.presets
      .list()
      .then((items) => {
        if (alive) {
          setPresets(
            (items || []).map((item) => ({ ...item, id: String(item.id) }))
          );
        }
      })
      .catch((error) => {
        if (alive) setPresetError(error.message || 'প্রিসেট লোড করা যায়নি');
      })
      .finally(() => {
        if (alive) setPresetsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setWatermark = (changes) =>
    onChange({ watermark: { ...l.watermark, ...changes } });

  const onPickWatermarkImage = async (file) => {
    if (!file || file.size > MAX_IMAGE) return;
    try {
      const image = await readAsDataUrl(file);
      setWatermark({ image, mode: 'image' });
    } catch {
      /* ignore unreadable files */
    }
  };

  const applyPreset = (id) => {
    setPresetId(id);
    setPresetError('');
    const preset = presets.find((item) => item.id === id);
    if (!preset) {
      setPresetName('');
      return;
    }
    setPresetName(preset.name);
    onChange(preset.layout);
  };

  const savePreset = async () => {
    if (!presetName.trim()) {
      setPresetError('প্রিসেটের নাম দিন');
      return;
    }
    if (presetsLoading || presetBusy) return;
    setPresetBusy(true);
    try {
      const saved = await API.presets.save(presetName, l);
      const entry = { ...saved, id: String(saved.id) };
      setPresets((current) => [
        entry,
        ...current.filter((item) => item.id !== entry.id),
      ]);
      setPresetId(entry.id);
      setPresetName(entry.name);
      setPresetError('');
    } catch (error) {
      setPresetError(error.message || 'প্রিসেট সংরক্ষণ করা যায়নি');
    } finally {
      setPresetBusy(false);
    }
  };

  const removePreset = async () => {
    const target = deleting;
    if (!target || presetBusy) return;
    setPresetBusy(true);
    try {
      await API.presets.remove(target.id);
      setPresets((current) => current.filter((item) => item.id !== target.id));
      if (presetId === target.id) {
        setPresetId('');
        setPresetName('');
      }
      setDeleting(null);
      setPresetError('');
    } catch (error) {
      setDeleting(null);
      setPresetError(error.message || 'প্রিসেট মোছা যায়নি');
    } finally {
      setPresetBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="পৃষ্ঠা সাজান"
        icon="grid"
        actions={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon="refresh"
            onClick={() => onChange(DEFAULT_LAYOUT)}
          >
            রিসেট
          </Button>
        }
      />
      <div className="space-y-3 p-3 sm:p-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            প্রিসেট
          </p>
          <div className="flex items-center gap-1.5">
            <Select
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="min-w-0 flex-1"
              disabled={presetsLoading}
            >
              <option value="">— প্রিসেট বাছুন —</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="icon"
              variant="dangerGhost"
              icon="trash"
              aria-label="প্রিসেট মুছুন"
              disabled={!presetId || presetsLoading || presetBusy}
              onClick={() => {
                const preset = presets.find((item) => item.id === presetId);
                if (preset) setDeleting(preset);
              }}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Input
              value={presetName}
              onChange={(e) => {
                setPresetName(e.target.value);
                if (presetError) setPresetError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  savePreset();
                }
              }}
              placeholder="প্রিসেটের নাম"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              size="sm"
              icon="save"
              onClick={savePreset}
              loading={presetBusy}
              disabled={presetsLoading}
            >
              সংরক্ষণ
            </Button>
          </div>
          {deleting && (
            <div className="mt-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5">
              <p className="text-xs font-medium text-rose-700">
                “{deleting.name}” প্রিসেটটি মুছে ফেলবেন?
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={removePreset}
                  loading={presetBusy}
                >
                  মুছুন
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setDeleting(null)}
                  disabled={presetBusy}
                >
                  বাতিল
                </Button>
              </div>
            </div>
          )}
          {presetError ? (
            <p className="mt-1 text-xs font-medium text-rose-600">{presetError}</p>
          ) : presetsLoading ? (
            <p className="mt-1 text-xs text-slate-400">প্রিসেট লোড হচ্ছে…</p>
          ) : presets.length === 0 ? (
            <p className="mt-1 text-xs text-slate-400">
              বর্তমান সাজানটি পরে ব্যবহার করতে একটি নাম দিয়ে সংরক্ষণ করুন।
            </p>
          ) : null}
        </div>

        <Field label="পৃষ্ঠার আকার">
          <Select value={l.pageSize} onChange={(e) => onChange({ pageSize: e.target.value })}>
            {Object.entries(PAGE_SIZES).map(([value, info]) => (
              <option key={value} value={value}>
                {info.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="মার্জিন (মিমি)">
          <Input
            type="number"
            min="5"
            max="40"
            value={l.margin}
            onChange={(e) =>
              onChange({ margin: e.target.value === '' ? '' : Number(e.target.value) })
            }
          />
        </Field>

        <Field
          label="প্রশ্নের লেখার আকার (pt)"
          hint="মূল প্রশ্নগুলোর ফন্ট, পয়েন্টে"
        >
          <PtStepper
            value={l.questionFontPt}
            onChange={(questionFontPt) => onChange({ questionFontPt })}
          />
        </Field>

        <Field
          label="হেডারের লেখার আকার (pt)"
          hint="প্রতিষ্ঠান, শ্রেণি, বিষয়, পরিচিতি, সময় ও পূর্ণমান"
        >
          <PtStepper
            value={l.headerFontPt}
            onChange={(headerFontPt) => onChange({ headerFontPt })}
          />
        </Field>

        <Field
          label="প্রশ্নের মাঝের ফাঁক (মিমি)"
          hint="প্রতিটি প্রশ্নের নিচে অতিরিক্ত জায়গা"
        >
          <Input
            type="number"
            min="0"
            max="20"
            step="1"
            value={l.questionGap}
            onChange={(e) =>
              onChange({
                questionGap: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          />
        </Field>

        <Field label="প্রশ্নের সারিবদ্ধতা">
          <Select
            value={l.align || ''}
            onChange={(e) => onChange({ align: e.target.value })}
          >
            {ALIGN_OPTIONS.map((option) => (
              <option key={option.value || 'auto'} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="অভিমুখ">
          <Segmented
            value={l.orientation}
            options={ORIENTATIONS}
            onChange={(orientation) => onChange({ orientation })}
          />
        </Field>

        <Field label="কলাম">
          <Segmented
            value={l.columns}
            options={COLUMN_OPTIONS}
            onChange={(columns) => onChange({ columns })}
          />
        </Field>

        <Field label="সংখ্যার ধরন">
          <Select
            value={l.numberFormat}
            onChange={(e) => onChange({ numberFormat: e.target.value })}
          >
            {NUMBER_FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="প্রশ্নের চিহ্ন">
          <Select
            value={l.questionMarkerStyle}
            onChange={(e) => onChange({ questionMarkerStyle: e.target.value })}
          >
            {QUESTION_MARKER_STYLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="বিকল্পের চিহ্ন">
          <Select
            value={l.markerStyle}
            onChange={(e) => onChange({ markerStyle: e.target.value })}
          >
            {MARKER_STYLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            যা দেখাতে চান
          </p>
          <div className="space-y-1.5">
            {HEADING_OPTIONS.map(({ key, label }) => (
              <Toggle
                key={key}
                label={label}
                checked={!!l.headings[key]}
                onChange={(checked) =>
                  onChange({ headings: { ...l.headings, [key]: checked } })
                }
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            ওয়াটারমার্ক
          </p>
          <div className="space-y-2">
            <Field label="উৎস" hint="একবারে একটিই ব্যবহার করা যায়">
              <Select
                value={l.watermark.mode}
                onChange={(e) => setWatermark({ mode: e.target.value })}
              >
                {WATERMARK_MODES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            {l.watermark.mode === 'logo' && !hasLogo && (
              <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                প্রতিষ্ঠানের কোনো লোগো নেই। প্রতিষ্ঠান পাতায় লোগো যোগ করুন।
              </p>
            )}

            {l.watermark.mode === 'image' && (
              <div>
                {l.watermark.image ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <img
                      src={l.watermark.image}
                      alt="ওয়াটারমার্ক"
                      className="max-h-20 rounded border border-slate-200 bg-white object-contain p-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="dangerGhost"
                      icon="trash"
                      onClick={() => setWatermark({ image: '' })}
                    >
                      সরান
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600">
                    <Icon name="image" className="h-4 w-4" />
                    ওয়াটারমার্কের ছবি বাছুন
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        onPickWatermarkImage(file);
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {l.watermark.mode === 'text' && (
              <>
                <Field label="লেখা">
                  <Input
                    value={l.watermark.text}
                    onChange={(e) => setWatermark({ text: e.target.value })}
                    placeholder="যেমন: নমুনা প্রশ্ন"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="কোণ (ডিগ্রি)">
                    <Input
                      type="number"
                      min="-180"
                      max="180"
                      step="5"
                      value={l.watermark.angle}
                      onChange={(e) =>
                        setWatermark({ angle: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
                  <Field label="রঙ">
                    <Input
                      type="color"
                      value={l.watermark.color}
                      onChange={(e) => setWatermark({ color: e.target.value })}
                      className="h-10 cursor-pointer p-1"
                    />
                  </Field>
                </div>
              </>
            )}

            {(l.watermark.mode === 'logo' || l.watermark.mode === 'image') && (
              <>
                <Field
                  label="আকার"
                  hint={`পৃষ্ঠার প্রস্থের ${bnNum(l.watermark.size)}%`}
                >
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={l.watermark.size}
                    onChange={(e) => setWatermark({ size: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </Field>
                <Field label="রঙ">
                  <Segmented
                    value={l.watermark.grayscale ? 'grayscale' : 'color'}
                    options={WATERMARK_COLOR_OPTIONS}
                    onChange={(value) =>
                      setWatermark({ grayscale: value === 'grayscale' })
                    }
                  />
                </Field>
              </>
            )}

            {l.watermark.mode === 'text' && (
              <Field
                label="লেখার আকার"
                hint={`${bnNum(l.watermark.textSize)} পিক্সেল`}
              >
                <input
                  type="range"
                  min="20"
                  max="260"
                  step="4"
                  value={l.watermark.textSize}
                  onChange={(e) => setWatermark({ textSize: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </Field>
            )}

            {l.watermark.mode !== 'none' && (
              <Field
                label="অপাসিটি"
                hint={`${bnNum(l.watermark.opacity)}% · বেশি = স্পষ্ট`}
              >
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={l.watermark.opacity}
                  onChange={(e) => setWatermark({ opacity: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </Field>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
