export const RTL_LANGS = ['ar', 'fa', 'ur', 'he'];

export const cn = (...parts) => parts.filter(Boolean).join(' ');

export const dirOf = (lang) =>
  RTL_LANGS.includes(String(lang || '').toLowerCase().slice(0, 2)) ? 'rtl' : 'ltr';

export const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);

export const prettyDate = (value) => {
  if (!value) return '—';
  const iso = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
