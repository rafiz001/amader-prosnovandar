export const KINDS = [
  { value: 'mcq', label: 'বহুনির্বাচনি' },
  { value: 'true_false', label: 'সত্য/মিথ্যা' },
  { value: 'text', label: 'লিখিত' },
];

export const DIFFICULTIES = [
  { value: 'easy', label: 'সহজ' },
  { value: 'medium', label: 'মাঝারি' },
  { value: 'hard', label: 'কঠিন' },
];

export const DIFFICULTY_TONE = { easy: 'emerald', medium: 'amber', hard: 'rose' };

export const DIFFICULTY_LABEL = { easy: 'সহজ', medium: 'মাঝারি', hard: 'কঠিন' };

export const KIND_TONE = { mcq: 'indigo', true_false: 'emerald', text: 'violet' };

export const KIND_LABEL = { mcq: 'বহুনির্বাচনি', true_false: 'সত্য/মিথ্যা', text: 'লিখিত' };

export const LANG_LABEL = {
  bn: 'বাংলা',
  en: 'ইংরেজি',
  ar: 'আরবি',
  fa: 'ফারসি',
  ur: 'উর্দু',
  he: 'হিব্রু',
};

export const langLabel = (code) => LANG_LABEL[code] || code || '—';

export const NAV_ITEMS = [
  { key: 'institute', label: 'প্রতিষ্ঠান', icon: 'building', hint: 'নাম, অবস্থান ও লোগো' },
  { key: 'classes', label: 'শ্রেণিসমূহ', icon: 'layers', hint: 'শ্রেণি, বিষয় ও অধ্যায়' },
  { key: 'generate', label: 'প্রশ্নপত্র তৈরি', icon: 'sparkles', hint: 'নতুন প্রশ্নপত্র বানান' },
  { key: 'papers', label: 'প্রশ্নপত্রসমূহ', icon: 'file', hint: 'সংরক্ষিত প্রশ্নপত্র' },
  { key: 'backup', label: 'ব্যাকআপ ও পুনরুদ্ধার', icon: 'database', hint: 'শ্রেণি বা সম্পূর্ণ ব্যাকআপ' },
];
