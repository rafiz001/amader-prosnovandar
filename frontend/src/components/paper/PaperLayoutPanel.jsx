import {
  COLUMN_OPTIONS,
  DEFAULT_LAYOUT,
  HEADING_OPTIONS,
  MARKER_STYLES,
  NUMBER_FORMATS,
  ORIENTATIONS,
  PAGE_SIZES,
  QUESTION_MARKER_STYLES,
} from '../../lib/paperLayout.js';
import { cn } from '../../lib/utils.js';
import { Button, Card, CardHeader, Field, Input, Select } from '../ui/index.js';

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

export function PaperLayoutPanel({ layout, onChange }) {
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
        <Field label="পৃষ্ঠার আকার">
          <Select
            value={layout.pageSize}
            onChange={(e) => onChange({ pageSize: e.target.value })}
          >
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
            value={layout.margin}
            onChange={(e) =>
              onChange({ margin: e.target.value === '' ? '' : Number(e.target.value) })
            }
          />
        </Field>

        <Field label="অভিমুখ">
          <Segmented
            value={layout.orientation}
            options={ORIENTATIONS}
            onChange={(orientation) => onChange({ orientation })}
          />
        </Field>

        <Field label="কলাম">
          <Segmented
            value={layout.columns}
            options={COLUMN_OPTIONS}
            onChange={(columns) => onChange({ columns })}
          />
        </Field>

        <Field label="সংখ্যার ধরন">
          <Select
            value={layout.numberFormat}
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
            value={layout.questionMarkerStyle}
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
            value={layout.markerStyle}
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
            শিরোনাম দেখান
          </p>
          <div className="space-y-1.5">
            {HEADING_OPTIONS.map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={!!layout.headings[key]}
                  onChange={(e) =>
                    onChange({
                      headings: { ...layout.headings, [key]: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded accent-indigo-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
