export const RTL_LANGS = ['ar', 'fa', 'ur', 'he'];

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const cn = (...parts) => parts.filter(Boolean).join(' ');

export const dirOf = (lang) =>
  RTL_LANGS.includes(String(lang || '').toLowerCase().slice(0, 2)) ? 'rtl' : 'ltr';

export const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);

export const bnNum = (v) => String(num(v)).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

export const optionLetter = (index) => ['ক', 'খ', 'গ', 'ঘ'][index] || bnNum(index + 1);

export const downloadBase64File = ({ filename, mime, data_base64 }) => {
  const binary = atob(data_base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'backup';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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
