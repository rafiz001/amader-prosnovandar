export const RTL_LANGS = ['ar', 'fa', 'ur', 'he'];

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const cn = (...parts) => parts.filter(Boolean).join(' ');

export const dirOf = (lang) =>
  RTL_LANGS.includes(String(lang || '').toLowerCase().slice(0, 2)) ? 'rtl' : 'ltr';

export const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);

export const bnNum = (v) => String(num(v)).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

export const optionLetter = (index) => ['ক', 'খ', 'গ', 'ঘ'][index] || bnNum(index + 1);

export const prettyDate = (value) => {
  if (!value) return '—';
  const iso = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('bn-BD', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
