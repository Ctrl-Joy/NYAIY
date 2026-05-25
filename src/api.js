import * as pdfjsLib from 'pdfjs-dist';

const API_BASE = process.env.REACT_APP_API_URL || '';
const workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const MIN_TEXT_LENGTH = 50;
const PDF_SAMPLE_PAGES = 5;
const PDF_SAMPLE_MAX_CHARS = 4000;

const apiFetch = async (path, body, signal) => {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(
      'Cannot reach NyAIy API server. Run npm run dev (starts server on port 3001 + app on 3000).'
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
};

export const checkApiHealth = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.json();
  } catch {
    return { ok: false, groqConfigured: false };
  }
};

// ── PDF sample (client-side only) ───────────
const extractTextLayer = async (pdf, maxPages = pdf.numPages) => {
  let fullText = '';
  const pages = Math.min(pdf.numPages, maxPages);
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item) => item.str).filter(Boolean).join(' ') + '\n';
    if (fullText.length >= PDF_SAMPLE_MAX_CHARS) break;
  }
  return fullText.trim().slice(0, PDF_SAMPLE_MAX_CHARS);
};

const extractTextViaOCR = async (pdf, maxPages = 2) => {
  const { createWorker } = await import('tesseract.js');
  const ocrWorker = await createWorker('eng');
  let fullText = '';
  const pages = Math.min(pdf.numPages, maxPages);
  try {
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const { data: { text } } = await ocrWorker.recognize(canvas);
      fullText += text + '\n';
      if (fullText.length >= PDF_SAMPLE_MAX_CHARS) break;
    }
  } finally {
    await ocrWorker.terminate();
  }
  return fullText.trim().slice(0, PDF_SAMPLE_MAX_CHARS);
};

export const getPdfTextSample = async (file, signal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useSystemFonts: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
  }).promise;

  let text = await extractTextLayer(pdf, PDF_SAMPLE_PAGES);
  if (text.length < MIN_TEXT_LENGTH) {
    text = await extractTextViaOCR(pdf, 2);
  }
  return text.length >= MIN_TEXT_LENGTH
    ? { text, partial: pdf.numPages > PDF_SAMPLE_PAGES }
    : null;
};

// ── Translations ──────────────────────────
export const translations = {
  en: {
    title: 'NyAIy',
    tagline: 'Your Legal Copilot',
    upload: 'Upload Legal Document',
    analyze: 'Analyze Document',
    analyzing: 'Analyzing...',
    cancel: 'Cancel',
    pass1: 'Pass 1 — Clause Extraction & Risk Scoring',
    pass2: 'Pass 2 — Deviation Analysis vs Indian Baselines',
    pass3: 'Pass 3 — Indian Law Reference Mapping',
    pass4: 'Pass 4 — Scam Pattern Detection',
    rights: 'Your Rights Card',
    negotiation: 'Negotiation Clauses',
    chatbot: 'Legal Q&A Chatbot',
    download: 'Download PDF Report',
    placeholder: 'Or paste legal text here...',
    voiceInput: 'Voice Input',
    listening: 'Listening...',
    dragdrop: 'Drag & drop PDF here or',
    browse: 'Browse File',
    askQuestion: 'Ask a legal question...',
    send: 'Send',
    riskLevel: 'Risk Level',
    caseType: 'Case Type',
    confidence: 'Confidence',
    scamScore: 'Scam Score',
    confidenceHelp:
      'Model certainty for Civil / Criminal / Constitutional classification (NyaiyBERT or AI).',
    riskHelp:
      'High if scam score ≥60, ≥30 medium, else from risky clauses or legal keywords in the text.',
    scamHelp:
      'Pass 4 score (0–100): unfair terms, hidden fees, rights waivers. Higher = more red flags.',
    high: 'High Risk',
    medium: 'Medium Risk',
    low: 'Low Risk',
    disclaimerTitle: 'Important notice',
    disclaimerBody:
      'NyAIy provides AI-generated legal information only — not legal advice. ' +
      'Always verify with a qualified advocate.',
    disclaimerAccept: 'I understand — continue',
    apiNotConfigured: 'Server API not configured. Run npm run dev and set GROQ_API_KEY in .env',
    
    // Additional Translation Keys for Full Multilingual Coverage
    tabClauses: 'Clauses',
    tabDeviations: 'Deviations',
    tabLaws: 'Laws',
    tabScams: 'Scams',
    tabRights: 'Rights',
    tabNegotiate: 'Negotiate',
    tabChatbot: 'Chatbot',
    
    classifyProgress: '🧠 NyaiyBERT Classification',
    readPdfProgress: '📄 Reading PDF',
    docTypeBanner: 'Auto-detected document type',
    
    doc_rental: 'Rental Agreement',
    doc_employment: 'Employment Contract',
    doc_nda: 'NDA Agreement',
    doc_fir: 'FIR / Police Report',
    doc_court: 'Court Judgment',
    doc_property: 'Property Document',
    doc_constitution: 'Constitutional Matter',
    doc_general: 'General Legal Document',
    
    case_civil: 'Civil Law',
    case_criminal: 'Criminal Law',
    case_constitutional: 'Constitutional Law',
    
    risk_high: 'High',
    risk_medium: 'Medium',
    risk_low: 'Low',
    
    noRights: 'No rights information available.',
    noNegotiations: 'No negotiation suggestions available.',
    noDeviations: 'No deviations found. Document appears standard.',
    noClauses: 'No clauses found.',
    noLaws: 'No specific laws mapped.',
    noScams: 'No scam patterns detected.',
    chatbotWelcome: '💬 Ask anything about your document...',
    chatbotThinking: '🤖 Thinking...',
  },
  hi: {
    title: 'न्याय',
    tagline: 'आपका कानूनी सहायक',
    upload: 'कानूनी दस्तावेज़ अपलोड करें',
    analyze: 'विश्लेषण करें',
    analyzing: 'विश्लेषण किया जा रहा है...',
    cancel: 'रद्द करें',
    pass1: 'चरण 1 — खंड निष्कर्षण और जोखिम स्कोरिंग',
    pass2: 'चरण 2 — विचलन विश्लेषण बनाम भारतीय मानक',
    pass3: 'चरण 3 — भारतीय कानून संदर्भ मैपिंग',
    pass4: 'चरण 4 — धोखाधड़ी और संदिग्ध पैटर्न पहचान',
    rights: 'आपका अधिकार कार्ड',
    negotiation: 'वार्ता खंड',
    chatbot: 'कानूनी प्रश्नोत्तर',
    download: 'PDF रिपोर्ट डाउनलोड करें',
    placeholder: 'या यहाँ कानूनी टेक्स्ट पेस्ट करें...',
    voiceInput: 'बोलकर इनपुट करें',
    listening: 'सुन रहा हूँ...',
    dragdrop: 'यहाँ पीडीएफ (PDF) फाइल खींचें या',
    browse: 'दस्तावेज़ चुनें',
    askQuestion: 'कानूनी प्रश्न पूछें...',
    send: 'भेजें',
    riskLevel: 'जोखिम स्तर',
    caseType: 'केस प्रकार',
    confidence: 'सटीकता',
    scamScore: 'स्कैम स्कोर',
    confidenceHelp: 'मॉडल की निश्चितता — नागरिक / आपराधिक / संवैधानिक वर्गीकरण के लिए।',
    riskHelp: 'स्कैम स्कोर ≥60 होने पर उच्च जोखिम, ≥30 होने पर मध्यम जोखिम, अन्यथा संदिग्ध खंडों या शब्दों के आधार पर।',
    scamHelp: 'चरण 4 का स्कोर (0-100): अनुचित शर्तें, छिपी हुई फीस, अधिकार समर्पण। अधिक स्कोर = अधिक लाल झंडे (रेड फ्लैग)।',
    high: 'उच्च जोखिम',
    medium: 'मध्यम जोखिम',
    low: 'कम जोखिम',
    disclaimerTitle: 'महत्वपूर्ण सूचना',
    disclaimerBody:
      'NyAIy केवल एआई-जनित कानूनी जानकारी प्रदान करता है — यह पेशेवर कानूनी सलाह का विकल्प नहीं है।',
    disclaimerAccept: 'मैं समझता हूँ — आगे बढ़ें',
    apiNotConfigured: 'एपीआई सर्वर कॉन्फ़िगर नहीं है। कृपया .env फ़ाइल में GROQ_API_KEY सेट करें।',

    // Additional Translation Keys for Full Multilingual Coverage
    tabClauses: 'खंड (क्लॉज)',
    tabDeviations: 'विचलन (डेविएशन)',
    tabLaws: 'कानून मैपिंग',
    tabScams: 'धोखाधड़ी/स्कैम',
    tabRights: 'अधिकार कार्ड',
    tabNegotiate: 'वार्ता खंड',
    tabChatbot: 'कानूनी चैटबॉट',

    classifyProgress: '🧠 NyaiyBERT द्वारा वर्गीकरण किया जा रहा है',
    readPdfProgress: '📄 पीडीएफ (PDF) दस्तावेज़ का पाठ निकाला जा रहा है',
    docTypeBanner: 'स्वचालित रूप से पहचाना गया दस्तावेज़ का प्रकार',

    doc_rental: 'किराया समझौता (रेंटल एग्रीमेंट)',
    doc_employment: 'रोजगार अनुबंध (एम्प्लॉयमेंट कॉन्ट्रैक्ट)',
    doc_nda: 'गैर-प्रकटीकरण समझौता (NDA)',
    doc_fir: 'एफआईआर / पुलिस रिपोर्ट',
    doc_court: 'अदालत का फैसला / निर्णय',
    doc_property: 'संपत्ति का दस्तावेज़',
    doc_constitution: 'संवैधानिक मामला',
    doc_general: 'सामान्य कानूनी दस्तावेज़',

    case_civil: 'नागरिक कानून (Civil Law)',
    case_criminal: 'आपराधिक कानून (Criminal Law)',
    case_constitutional: 'संवैधानिक कानून (Constitutional Law)',

    risk_high: 'उच्च जोखिम',
    risk_medium: 'मध्यम जोखिम',
    risk_low: 'कम जोखिम',

    noRights: 'कोई अधिकार जानकारी उपलब्ध नहीं है।',
    noNegotiations: 'कोई वार्ता सुझाव उपलब्ध नहीं हैं।',
    noDeviations: 'कोई विचलन नहीं मिला। दस्तावेज़ मानक प्रतीत होता है।',
    noClauses: 'कोई खंड नहीं मिला।',
    noLaws: 'कोई विशिष्ट कानून मैप नहीं किए गए।',
    noScams: 'कोई स्कैम पैटर्न नहीं मिला।',
    chatbotWelcome: '💬 अपने दस्तावेज़ के बारे में कुछ भी पूछें...',
    chatbotThinking: '🤖 सोच रहा हूँ...',
  },
};

export const classifyDocument = (text, docTypeHint, signal) =>
  apiFetch('/api/classify', { text, docTypeHint }, signal);

export const fourPassAnalysis = (text, lang, docType, signal) =>
  apiFetch('/api/analyze', { text, lang, docType }, signal).then((d) => d.analysis);

export const askChatbot = (question, documentText, lang, history, signal) =>
  apiFetch('/api/chat', { question, documentText, lang, history }, signal).then(
    (d) => d.answer
  );

// ── Risk (client-side heuristic + AI clauses) ──
export const getRiskLevel = (text, docType = 'general') => {
  const t = text.toLowerCase();
  const isCourt = docType === 'court';

  const high = [
    'section 302', 'section 376', 'section 307',
    'murder', 'rape', 'terrorism', 'kidnap',
    'death penalty', 'life imprisonment',
    'non-refundable', 'nonrefundable', 'forfeit', 'forfeiture',
    'waives the right', 'waiver of rights',
    'inspect at any time', 'enter at any time',
  ];
  const medium = [
    'section 420', 'section 379', 'section 498',
    'theft', 'fraud', 'cheating', 'harassment',
    'termination without notice', 'maintenance charges',
    '60 days', '90 days', 'security deposit',
  ];

  if (!isCourt) {
    high.push('without notice', 'without prior notice');
    medium.push('bail', 'penalty', 'fine', 'eviction');
  }

  for (const w of high) if (t.includes(w)) return 'High';
  for (const w of medium) if (t.includes(w)) return 'Medium';
  return 'Low';
};

export const computeRiskLevel = (text, analysis, docType = 'general') => {
  const scamScore = parseInt(analysis?.pass4?.scamScore || '0', 10) || 0;
  if (scamScore >= 60) return { riskLevel: 'High', scamScore };
  if (scamScore >= 30) return { riskLevel: 'Medium', scamScore };

  const clauses = analysis?.pass1?.clauses || [];
  if (clauses.some((c) => c.risk === 'High')) return { riskLevel: 'High', scamScore };
  if (clauses.some((c) => c.risk === 'Medium')) return { riskLevel: 'Medium', scamScore };

  return { riskLevel: getRiskLevel(text, docType), scamScore };
};
