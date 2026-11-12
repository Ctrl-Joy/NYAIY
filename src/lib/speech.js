/**
 * Read-aloud support. Legal text is full of things a speech engine gets wrong
 * (Rs. 1,50,000, u/s 420, 45/100, Sec. 11, quotes and brackets), so the text is
 * rewritten for the ear first, spoken sentence by sentence, and matched to a
 * voice in the right language.
 */
export const canSpeak =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

const WORDS = {
  en: {
    rupees: 'rupees', section: 'Section', sections: 'Sections', under: 'under section', outOf: 'out of',
    and: 'and', versus: 'versus', number: 'number', article: 'Article', percent: 'percent',
    lakh: 'lakh', crore: 'crore', to: 'to',
  },
  hi: {
    rupees: 'रुपये', section: 'धारा', sections: 'धाराएँ', under: 'धारा', outOf: 'में से',
    and: 'और', versus: 'बनाम', number: 'संख्या', article: 'अनुच्छेद', percent: 'प्रतिशत',
    lakh: 'लाख', crore: 'करोड़', to: 'से',
  },
};

// Acronyms that engines try to pronounce as words; spelled out letter by letter.
const SPELL = ['FIR', 'IPC', 'CrPC', 'CPC', 'BNS', 'BNSS', 'NDA', 'GST', 'TDS', 'PAN', 'RERA', 'NCLT', 'PIL', 'MoU', 'KYC', 'EMI'];

/** Rewrite text so a speech engine reads it the way a person would. */
export const prepareForSpeech = (text, lang = 'en') => {
  const w = WORDS[lang] || WORDS.en;
  let s = String(text || '');

  // Markdown and typographic noise.
  s = s
    .replace(/\*\*|__|`|#{1,6}\s/g, '')
    .replace(/[“”„"«»]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[\[\]{}<>|]/g, ' ')
    .replace(/\s*[–—]\s*/g, ', ')
    .replace(/…/g, '. ')
    .replace(/[•·▪●]/g, ', ');

  // Indian digit grouping (1,50,000) is read as separate numbers, so the commas go.
  s = s.replace(/\d{1,3}(?:,\d{2,3})+(?:\.\d+)?/g, (m) => m.replace(/,/g, ''));

  // Money: "Rs. 30000", "Rs 30000/-", "₹30000", "INR 30000" -> "30000 rupees".
  s = s.replace(/(?:₹|\bRs\.?|\bINR)\s*(\d+(?:\.\d+)?)(?:\s*\/-)?(\s*(?:lakhs?|crores?|लाख|करोड़))?/gi, (_, n, unit) => {
    const u = unit ? ` ${/crore|करोड़/i.test(unit) ? w.crore : w.lakh}` : '';
    return `${n}${u} ${w.rupees}`;
  });
  s = s.replace(/(\d)\s*\/-/g, '$1');
  s = s.replace(/₹|\bRs\.?(?=\s|$)|\bINR\b/g, w.rupees);

  // Scores and ratios, percentages, ranges.
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, `$1 ${w.outOf} $2`);
  s = s.replace(/(\d)\s*%/g, `$1 ${w.percent}`);
  s = s.replace(/(\d)\s*-\s*(\d)/g, `$1 ${w.to} $2`);

  // Legal shorthand.
  s = s
    .replace(/\bu\/s\.?\s*/gi, `${w.under} `)
    .replace(/\bSecs\.\s*/g, `${w.sections} `)
    .replace(/\b(?:Sec|S)\.\s*(?=\d)/g, `${w.section} `)
    .replace(/§\s*/g, `${w.section} `)
    .replace(/\bArt\.\s*(?=\d)/g, `${w.article} `)
    .replace(/\bNo\.\s*(?=\d)/g, `${w.number} `)
    .replace(/\bv(?:s)?\.?\s+(?=[A-Zऀ-ॿ])/g, `${w.versus} `)
    .replace(/\s&\s/g, ` ${w.and} `)
    .replace(/\band\/or\b/gi, lang === 'hi' ? 'या' : 'and or')
    .replace(/\bi\.e\.,?/gi, lang === 'hi' ? 'यानी' : 'that is,')
    .replace(/\be\.g\.,?/gi, lang === 'hi' ? 'जैसे' : 'for example,')
    .replace(/\betc\.?/gi, lang === 'hi' ? 'आदि' : 'etcetera')
    .replace(/\bw\.e\.f\.?/gi, lang === 'hi' ? 'से प्रभावी' : 'with effect from')
    .replace(/\bHon'?ble\b/gi, 'Honourable')
    .replace(/\bLtd\.?/g, 'Limited')
    .replace(/\bPvt\.?/g, 'Private')
    .replace(/\bGovt\.?/g, 'Government');

  // "Section 11(2)(a)" -> "Section 11, 2, a" rather than a run of brackets.
  s = s.replace(/(\d)\(([\da-z]{1,3})\)/gi, '$1, $2').replace(/\)\(/g, ', ');
  s = s.replace(/[()]/g, ', ');

  for (const a of SPELL) {
    s = s.replace(new RegExp(`\\b${a}\\b`, 'g'), a.toUpperCase().split('').join(' '));
  }

  return s
    .replace(/\s*\/\s*/g, ', ')
    .replace(/\s+([,.;:!?।])/g, '$1')
    .replace(/,(\s*,)+/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/** Short pieces: engines cut off or stall on long utterances. */
export const splitForSpeech = (text, max = 180) => {
  const sentences = text.match(/[^.!?।\n]+[.!?।]*/g) || [];
  const out = [];
  for (const raw of sentences) {
    let part = raw.trim();
    if (!part) continue;
    while (part.length > max) {
      const cut = Math.max(part.lastIndexOf(', ', max), part.lastIndexOf(' ', max));
      const at = cut > 40 ? cut + 1 : max;
      out.push(part.slice(0, at).trim());
      part = part.slice(at).trim();
    }
    if (part) out.push(part);
  }
  return out;
};

/** Best installed voice for the language, or null when the device has none. */
export const pickVoice = (voices, lang) => {
  const wanted = lang === 'hi' ? ['hi-IN', 'hi'] : ['en-IN', 'en-GB', 'en-US', 'en'];
  const norm = (v) => v.lang.replace('_', '-').toLowerCase();
  for (const code of wanted) {
    const matches = voices.filter((v) => norm(v) === code.toLowerCase() || norm(v).startsWith(`${code.toLowerCase()}-`));
    if (matches.length) {
      return matches.find((v) => /natural|google|neural|online/i.test(v.name)) || matches.find((v) => v.localService) || matches[0];
    }
  }
  return null;
};

const loadVoices = () =>
  new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    return setTimeout(done, 1200);
  });

let session = 0;

export const stopSpeaking = () => {
  session += 1;
  if (canSpeak) window.speechSynthesis.cancel();
};

/**
 * Speak text in the given language. Resolves 'done', 'stopped' or 'no-voice'
 * (the device has no voice for that language, so nothing was read).
 */
export const speak = async (text, lang) => {
  if (!canSpeak) return 'no-voice';
  stopSpeaking();
  const mine = session;
  const synth = window.speechSynthesis;
  const voice = pickVoice(await loadVoices(), lang);
  if (mine !== session) return 'stopped';
  if (!voice) return 'no-voice';

  const parts = splitForSpeech(prepareForSpeech(text, lang));
  for (const part of parts) {
    if (mine !== session) return 'stopped';
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(part);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = lang === 'hi' ? 0.9 : 0.95;
      u.onend = resolve;
      u.onerror = resolve;
      synth.speak(u);
    });
  }
  return mine === session ? 'done' : 'stopped';
};
