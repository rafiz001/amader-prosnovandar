export const KINDS = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'true_false', label: 'True/False' },
  { value: 'text', label: 'Text' },
];

export const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export const DIFFICULTY_TONE = { easy: 'emerald', medium: 'amber', hard: 'rose' };

export const KIND_TONE = { mcq: 'indigo', true_false: 'emerald', text: 'violet' };

export const KIND_LABEL = { mcq: 'MCQ', true_false: 'True/False', text: 'Text' };

export const NAV_ITEMS = [
  { key: 'institute', label: 'Institute', icon: 'building', hint: 'Name, location & logo' },
  { key: 'classes', label: 'Classes', icon: 'layers', hint: 'Classes, subjects & chapters' },
  { key: 'generate', label: 'Generate', icon: 'sparkles', hint: 'Build a question paper' },
  { key: 'papers', label: 'Papers', icon: 'file', hint: 'Saved papers' },
];
