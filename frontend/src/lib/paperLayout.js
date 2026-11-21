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
  { key: 'institute', label: 'প্রতিষ্ঠানের তথ্য' },
  { key: 'title', label: 'প্রশ্নপত্রের শিরোনাম' },
  { key: 'summary', label: 'সারসংক্ষেপ (প্রশ্ন, নম্বর, সময়)' },
  { key: 'answerKey', label: 'উত্তরমালা' },
];

export const DEFAULT_LAYOUT = {
  pageSize: 'A4',
  orientation: 'portrait',
  columns: 1,
  margin: 14,
  numberFormat: 'bangla',
  questionMarkerStyle: 'circle',
  markerStyle: 'bengali-dot',
  headings: {
    institute: true,
    title: true,
    summary: true,
    answerKey: true,
  },
};

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
