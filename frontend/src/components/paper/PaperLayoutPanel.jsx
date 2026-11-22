import { useEffect, useState } from 'react';
import {
  COLUMN_OPTIONS,
  DEFAULT_LAYOUT,
  HEADING_OPTIONS,
  MARKER_STYLES,
  NUMBER_FORMATS,
  ORIENTATIONS,
  PAGE_SIZES,
  QUESTION_MARKER_STYLES,
  WATERMARK_COLOR_OPTIONS,
  watermarkSettings,
} from '../../lib/paperLayout.js';
import { API } from '../../lib/api.js';
import { bnNum, cn } from '../../lib/utils.js';
import { Button, Card, CardHeader, Field, Input, Select, Toggle } from '../ui/index.js';

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
            লোগো ওয়াটারমার্ক
          </p>
          <div className="space-y-2">
            <Toggle
              label="লোগো দেখান"
              hint={
                hasLogo
                  ? 'প্রতিটি পৃষ্ঠার মাঝে হালকা লোগো'
                  : 'প্রতিষ্ঠানের কোনো লোগো নেই'
              }
              checked={!!l.watermark.enabled}
              onChange={(enabled) => setWatermark({ enabled })}
            />
            {l.watermark.enabled && (
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
          </div>
        </div>
      </div>
    </Card>
  );
}
