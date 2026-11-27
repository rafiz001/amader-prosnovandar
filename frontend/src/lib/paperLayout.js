export const PAGE_SIZES = {
  A4: { label: 'A4', width: 210, height: 297 },
  A3: { label: 'A3', width: 297, height: 420 },
  A5: { label: 'A5', width: 148, height: 210 },
  Letter: { label: 'লেটার', width: 215.9, height: 279.4 },
  Legal: { label: 'লিগ্যাল', width: 215.9, height: 355.6 },
};

export const ORIENTATIONS = [
  { value: 'portrait', label: 'খাড়া' },
  { value: 'landscape', label: 'আড়াআড়ি' },
];

export const COLUMN_OPTIONS = [
  { value: 1, label: '১ কলাম' },
  { value: 2, label: '২ কলাম' },
];

export const NUMBER_FORMATS = [
  { value: 'bangla', label: 'বাংলা' },
  { value: 'english', label: 'ইংরেজি' },
  { value: 'arabic', label: 'আরবি' },
];

export const MARKER_STYLES = [
  { value: 'upper-dot', label: 'A.' },
  { value: 'upper', label: 'A' },
  { value: 'upper-circle', label: 'Ⓐ' },
  { value: 'lower-dot', label: 'a.' },
  { value: 'lower', label: 'a' },
  { value: 'lower-circle', label: 'ⓐ' },
  { value: 'roman-upper-dot', label: 'I.' },
  { value: 'roman-upper', label: 'I' },
  { value: 'roman-lower-dot', label: 'i.' },
  { value: 'roman-lower', label: 'i' },
  { value: 'bengali-dot', label: 'ক.' },
  { value: 'bengali', label: 'ক' },
  { value: 'bengali-circle', label: 'ক (বৃত্ত)' },
  { value: 'decimal-dot', label: '১.' },
  { value: 'decimal', label: '১' },
];

export const QUESTION_MARKER_STYLES = [
  { value: 'circle', label: 'বৃত্ত (১)' },
  { value: 'decimal-dot', label: '১.' },
  { value: 'decimal', label: '১' },
  { value: 'upper-dot', label: 'A.' },
  { value: 'upper', label: 'A' },
  { value: 'upper-circle', label: 'Ⓐ' },
  { value: 'lower-dot', label: 'a.' },
  { value: 'lower', label: 'a' },
  { value: 'bengali-circle', label: 'ক (বৃত্ত)' },
  { value: 'roman-upper-dot', label: 'I.' },
  { value: 'roman-upper', label: 'I' },
  { value: 'roman-lower-dot', label: 'i.' },
  { value: 'roman-lower', label: 'i' },
];

export const HEADING_OPTIONS = [
  { key: 'institute', label: 'প্রতিষ্ঠানের নাম' },
  { key: 'class', label: 'শ্রেণি' },
  { key: 'subject', label: 'বিষয়' },
  { key: 'introduction', label: 'পরিচিতি' },
  { key: 'time', label: 'সময়' },
  { key: 'fullMarks', label: 'পূর্ণমান' },
  { key: 'answerKey', label: 'উত্তরমালা' },
];

export const WATERMARK_COLOR_OPTIONS = [
  { value: 'color', label: 'রঙিন' },
  { value: 'grayscale', label: 'গ্রেস্কেল' },
];

export const WATERMARK_MODES = [
  { value: 'logo', label: 'প্রতিষ্ঠানের লোগো' },
  { value: 'image', label: 'নিজের ছবি' },
  { value: 'text', label: 'লেখা' },
  { value: 'none', label: 'বন্ধ' },
];

export const ALIGN_OPTIONS = [
  { value: '', label: 'স্বয়ংক্রিয়' },
  { value: 'left', label: 'বাম' },
  { value: 'center', label: 'কেন্দ্র' },
  { value: 'right', label: 'ডান' },
  { value: 'justify', label: 'সারিবদ্ধ' },
];

export const QUESTION_ALIGN_OPTIONS = ALIGN_OPTIONS.filter(
  (option) => option.value !== ''
);

export const DEFAULT_LAYOUT = {
  pageSize: 'A4',
  orientation: 'portrait',
  columns: 1,
  margin: 14,
  questionFontPt: 10,
  headerFontPt: 10.5,
  questionGap: 4,
  align: '',
  numberFormat: 'bangla',
  questionMarkerStyle: 'circle',
  markerStyle: 'bengali-dot',
  headings: {
    institute: true,
    class: true,
    subject: true,
    introduction: true,
    time: true,
    fullMarks: true,
    answerKey: true,
  },
  watermark: {
    mode: 'logo',
    enabled: true,
    size: 55,
    opacity: 15,
    grayscale: false,
    image: '',
    text: '',
    angle: 45,
    color: '#94a3b8',
    textSize: 96,
  },
};

export function paperFontSizes(layout = DEFAULT_LAYOUT) {
  const source = layout && typeof layout === 'object' ? layout : {};
  const positive = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const questionPt = Math.min(
    40,
    Math.max(4, positive(source.questionFontPt, DEFAULT_LAYOUT.questionFontPt))
  );
  const headerPt = Math.min(
    40,
    Math.max(4, positive(source.headerFontPt, DEFAULT_LAYOUT.headerFontPt))
  );
  return {
    questionPt,
    headerPt,
    titlePt: Math.round(headerPt * 1.4 * 10) / 10,
  };
}

export function watermarkSettings(watermark) {
  const source = watermark && typeof watermark === 'object' ? watermark : {};
  let opacity = source.opacity;
  if (
    (opacity === undefined || opacity === null) &&
    source.transparency !== undefined &&
    source.transparency !== null
  ) {
    opacity = 100 - Number(source.transparency);
  }
  const numericOpacity = Number(opacity);
  const numericSize = Number(source.size);
  let mode = typeof source.mode === 'string' ? source.mode : '';
  if (!WATERMARK_MODES.some((item) => item.value === mode)) {
    mode = source.enabled === false ? 'none' : 'logo';
  }
  const numericAngle = Number(source.angle);
  const numericTextSize = Number(source.textSize);
  const validColor =
    typeof source.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(source.color.trim());
  return {
    mode,
    enabled: mode !== 'none',
    size: Number.isFinite(numericSize)
      ? numericSize
      : DEFAULT_LAYOUT.watermark.size,
    opacity: Number.isFinite(numericOpacity)
      ? Math.min(100, Math.max(0, numericOpacity))
      : DEFAULT_LAYOUT.watermark.opacity,
    grayscale: Boolean(source.grayscale),
    image: typeof source.image === 'string' ? source.image : '',
    text: typeof source.text === 'string' ? source.text : '',
    angle: Number.isFinite(numericAngle)
      ? numericAngle
      : DEFAULT_LAYOUT.watermark.angle,
    color: validColor ? source.color.trim() : DEFAULT_LAYOUT.watermark.color,
    textSize: Number.isFinite(numericTextSize) && numericTextSize > 0
      ? numericTextSize
      : DEFAULT_LAYOUT.watermark.textSize,
  };
}

const DIGITS = {
  bangla: '০১২৩৪৫৬৭৮৯',
  english: '0123456789',
  arabic: '٠١٢٣٤٥٦٧٨٩',
};

const ROMAN = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

const BENGALI_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ'];

export function formatNumber(value, format = 'bangla') {
  const digits = DIGITS[format] || DIGITS.bangla;
  return String(value ?? '').replace(/\d/g, (d) => digits[Number(d)]);
}

export function toRoman(value) {
  let n = Math.max(0, Math.floor(Number(value) || 0));
  let out = '';
  for (const [amount, numeral] of ROMAN) {
    while (n >= amount) {
      out += numeral;
      n -= amount;
    }
  }
  return out;
}

export function optionMarker(index, style = 'upper-dot', format = 'bangla') {
  const i = Math.max(0, Math.floor(Number(index) || 0));
  const upper = String.fromCharCode(65 + (i % 26));
  const lower = upper.toLowerCase();
  const bengali = BENGALI_LETTERS[i] || formatNumber(i + 1, format);
  const roman = toRoman(i + 1);

  switch (style) {
    case 'upper':
      return { label: upper, circle: false };
    case 'upper-circle':
      return { label: upper, circle: true };
    case 'lower-dot':
      return { label: `${lower}.`, circle: false };
    case 'lower':
      return { label: lower, circle: false };
    case 'lower-circle':
      return { label: lower, circle: true };
    case 'roman-upper-dot':
      return { label: `${roman}.`, circle: false };
    case 'roman-upper':
      return { label: roman, circle: false };
    case 'roman-lower-dot':
      return { label: `${roman.toLowerCase()}.`, circle: false };
    case 'roman-lower':
      return { label: roman.toLowerCase(), circle: false };
    case 'bengali-dot':
      return { label: `${bengali}.`, circle: false };
    case 'bengali':
      return { label: bengali, circle: false };
    case 'bengali-circle':
      return { label: bengali, circle: true };
    case 'decimal-dot':
      return { label: `${formatNumber(i + 1, format)}.`, circle: false };
    case 'decimal':
      return { label: formatNumber(i + 1, format), circle: false };
    case 'upper-dot':
    default:
      return { label: `${upper}.`, circle: false };
  }
}

export function questionMarker(number, style = 'circle', format = 'bangla') {
  const n = Math.max(1, Math.floor(Number(number) || 1));
  if (style === 'circle') {
    return { label: formatNumber(n, format), circle: true, filled: true };
  }
  if (style === 'decimal-dot') {
    return { label: `${formatNumber(n, format)}.`, circle: false, filled: false };
  }
  if (style === 'decimal') {
    return { label: formatNumber(n, format), circle: false, filled: false };
  }
  return { ...optionMarker(n - 1, style, format), filled: false };
}

export function pageDimensions(layout = DEFAULT_LAYOUT) {
  const size = PAGE_SIZES[layout.pageSize] || PAGE_SIZES.A4;
  const landscape = layout.orientation === 'landscape';
  return {
    width: landscape ? size.height : size.width,
    height: landscape ? size.width : size.height,
  };
}

export function paginateQuestions(
  heights,
  { contentHeight, headerHeight = 0, hasHeader = false, columns = 1, answerKey = false }
) {
  const pages = [];
  const firstLimit = Math.max(0, contentHeight - headerHeight);

  if (columns === 2) {
    let current = {
      header: hasHeader,
      columns: [[], []],
      used: [0, 0],
      limit: firstLimit,
    };
    const pushPage = () => {
      pages.push(current);
      current = { header: false, columns: [[], []], used: [0, 0], limit: contentHeight };
    };

    heights.forEach((height, index) => {
      let placed = false;
      for (let col = 0; col < 2; col += 1) {
        if (current.used[col] + height <= current.limit) {
          current.columns[col].push(index);
          current.used[col] += height;
          placed = true;
          break;
        }
      }
      if (!placed) {
        if (current.columns[0].length || current.columns[1].length) pushPage();
        current.columns[0].push(index);
        current.used[0] += height;
      }
    });

    if (current.columns[0].length || current.columns[1].length || pages.length === 0) {
      pages.push(current);
    }
  } else {
    let current = { header: hasHeader, questions: [], used: 0, limit: firstLimit };
    const pushPage = () => {
      pages.push(current);
      current = { header: false, questions: [], used: 0, limit: contentHeight };
    };

    heights.forEach((height, index) => {
      if (current.used > 0 && current.used + height > current.limit) pushPage();
      current.questions.push(index);
      current.used += height;
    });

    if (current.questions.length || pages.length === 0) pages.push(current);
  }

  if (answerKey) {
    pages.push({
      header: false,
      questions: [],
      columns: [[], []],
      used: [0, 0],
      answerKey: true,
    });
  }

  return pages;
}
