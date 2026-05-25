export const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** 4-pass analysis progress (matches results tabs) */
export const FOUR_PASS_PROGRESS = (t) => [
  { key: 'classify', label: t.classifyProgress || '🧠 NyaiyBERT Classification' },
  { key: 'pass1', label: t.pass1 },
  { key: 'pass2', label: t.pass2 },
  { key: 'pass3', label: t.pass3 },
  { key: 'pass4', label: t.pass4 },
];

export const PDF_READ_STEP = (t) => ({ key: 'read', label: t.readPdfProgress || '📄 Reading PDF' });
