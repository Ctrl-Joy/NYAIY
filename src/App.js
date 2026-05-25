import { useState, useRef, useEffect } from 'react';
import {
  Upload, FileText, Mic, MicOff,
  Download, AlertCircle, Globe,
  Shield, Scale, AlertTriangle,
  MessageCircle, ChevronRight, X
} from 'lucide-react';
import {
  classifyDocument, computeRiskLevel,
  fourPassAnalysis, askChatbot,
  translations, getPdfTextSample, checkApiHealth
} from './api';
import { generatePDF } from './generatePDF';
import { MAX_FILE_BYTES, FOUR_PASS_PROGRESS, PDF_READ_STEP } from './constants';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const riskColors = {
  High:   'bg-red-100 text-red-800 border-red-300',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Low:    'bg-green-100 text-green-800 border-green-300'
};

const riskBadge = {
  High:   'bg-red-500',
  Medium: 'bg-yellow-500',
  Low:    'bg-green-500'
};

const DOC_TYPES = {
  rental:       { label: 'Rental Agreement',     icon: '🏠' },
  employment:   { label: 'Employment Contract',  icon: '💼' },
  nda:          { label: 'NDA Agreement',         icon: '🔒' },
  fir:          { label: 'FIR / Police Report',  icon: '🚔' },
  court:        { label: 'Court Judgment',        icon: '⚖️' },
  property:     { label: 'Property Document',    icon: '🏗️' },
  constitution: { label: 'Constitutional Matter',icon: '📜' },
  general:      { label: 'General Legal Document',icon: '📄' },
};

const detectDocType = (text) => {
  const t = text.toLowerCase();
  if (t.includes('rent') || t.includes('tenant') || t.includes('landlord') || t.includes('lease')) return 'rental';
  if (t.includes('employment') || t.includes('salary') || t.includes('employee') || t.includes('employer')) return 'employment';
  if (t.includes('nda') || t.includes('non-disclosure') || t.includes('confidential')) return 'nda';
  if (/\bfir\b/.test(t) || t.includes('first information report') || t.includes('police station')) return 'fir';
  if (t.includes('supreme court') || t.includes('high court') || t.includes('judgment') ||
      t.includes('petitioner') || t.includes('appellant') || /\bvs\.?\b/.test(t)) return 'court';
  if (t.includes('property') || t.includes('sale deed') || t.includes('ownership')) return 'property';
  if (t.includes('constitution') || t.includes('article 21') || t.includes('fundamental rights')) return 'constitution';
  return 'general';
};

const detectDocTypeFromFile = (file, sampleText = '') => {
  const name = file.name.toLowerCase();
  if (name.includes('fir') || name.includes('police')) return 'fir';
  if (/_vs_|_v_|versus/.test(name) || name.includes('judgment') || name.includes('court')) return 'court';
  return detectDocType(sampleText || name);
};

export default function App() {
  const [lang, setLang]             = useState('en');
  const [text, setText]             = useState('');
  const [documentText, setDocumentText] = useState('');
  const [pdfFile, setPdfFile]       = useState(null);
  const [fileName, setFileName]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [listening, setListening]   = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState('');
  const [activeTab, setActiveTab]   = useState('pass1');
  const [chatInput, setChatInput]   = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [passStatus, setPassStatus] = useState({});
  const [docType, setDocType]       = useState(null);
  const [apiReady, setApiReady]     = useState(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const fileRef   = useRef();
  const chatEndRef = useRef();
  const abortRef  = useRef(null);
  const analyzeGenRef = useRef(0);
  const recognitionRef = useRef(null);
  const t = translations[lang];

  useEffect(() => {
    checkApiHealth()
      .then((h) => setApiReady(h.groqConfigured))
      .catch(() => setApiReady(false));
  }, []);

  useEffect(() => {
    if (result && documentText && !loading) {
      const gen = ++analyzeGenRef.current;
      setLoading(true);
      setPassStatus({
        read: 'done',
        classify: 'done',
        pass1: 'loading',
        pass2: 'loading',
        pass3: 'loading',
        pass4: 'loading',
      });
      
      const detectedType = result.docType || docType || 'general';

      fourPassAnalysis(documentText, lang, detectedType, abortRef.current?.signal)
        .then(async (analysis) => {
          if (gen !== analyzeGenRef.current) return;
          
          setPassStatus({
            read: 'done',
            classify: 'done',
            pass1: 'done',
            pass2: 'done',
            pass3: 'done',
            pass4: 'done',
          });
          
          const { riskLevel, scamScore } = computeRiskLevel(documentText, analysis, detectedType);
          
          setResult(prev => ({
            ...prev,
            riskLevel,
            scamScore,
            analysis,
            timestamp: new Date().toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN'),
          }));
          setLoading(false);
          setPassStatus({});
        })
        .catch(err => {
          if (err.name === 'AbortError') return;
          console.error('Failed to translate results:', err);
          setLoading(false);
          setPassStatus({});
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const validateFile = (file) => {
    if (!file) return 'No file selected.';
    if (file.size > MAX_FILE_BYTES) {
      return `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB).`;
    }
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    const isTxt = file.type === 'text/plain' || file.name.endsWith('.txt');
    if (!isPdf && !isTxt) {
      return 'Only PDF and plain text (.txt) files are supported.';
    }
    return null;
  };

  const cancelAnalysis = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setPassStatus({});
  };

  // ── File Upload ───────────────────────────
  const handleFile = async (file) => {
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    if (apiReady === false) {
      setError(t.apiNotConfigured);
      return;
    }

    setFileName(file.name);
    setError('');
    setResult(null);
    setPdfFile(null);
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const content = await file.text();
      setText(content);
      setDocumentText(content);
      setDocType(detectDocType(content));
    } else if (
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')
    ) {
      setText('');
      setPdfFile(file);
      setDocType(detectDocTypeFromFile(file));
      if (sessionStorage.getItem('nyaiy_disclaimer') === '1') {
        await handleAnalyze(file);
      } else {
        setDisclaimerOpen(true);
      }
    }
  };

  // ── Voice Input ───────────────────────────
  const handleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Use Chrome browser for voice input.');
      return;
    }

    const recognition = new SR();
    recognition.lang       = lang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      setListening(true);
    };
    
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setPdfFile(null);
      setText(prev => prev ? prev + ' ' + transcript : transcript);
      setDocumentText(prev => prev ? prev + ' ' + transcript : transcript);
      setDocType(detectDocType(text + ' ' + transcript));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // ── Main Analysis ─────────────────────────
  const handleAnalyze = async (fileOverride = null) => {
    if (apiReady === false) {
      setError(t.apiNotConfigured);
      return;
    }
    if (!sessionStorage.getItem('nyaiy_disclaimer')) {
      setDisclaimerOpen(true);
      return;
    }

    const gen = ++analyzeGenRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const abortSignal = ac.signal;

    const pdf = fileOverride || pdfFile;
    let sourceText = text.trim();
    setError('');
    setLoading(true);
    setResult(null);
    setPassStatus({ read: pdf ? 'loading' : 'done' });
    setActiveTab('pass1');
    setChatHistory([]);

    try {
      if (pdf) {
        const sample = await getPdfTextSample(pdf, abortSignal);
        if (gen !== analyzeGenRef.current) return;
        if (!sample) {
          setPdfFile(null);
          throw new Error(
            'Could not read PDF. Try a text-based PDF or paste content manually.'
          );
        }
        sourceText = sample.text;
        setDocumentText(sourceText);
        setDocType(detectDocTypeFromFile(pdf, sourceText));
      } else if (sourceText) {
        setDocumentText(sourceText);
      }

      if (!sourceText) {
        throw new Error('Please upload a file or enter text.');
      }

      setPassStatus({ read: 'done', classify: 'loading' });
      const detectedType = detectDocType(sourceText) || docType || 'general';
      setDocType(detectedType);

      const modelResult = await classifyDocument(
        sourceText, detectedType, abortSignal
      );
      if (gen !== analyzeGenRef.current) return;

      setPassStatus({
        read: 'done',
        classify: 'done',
        pass1: 'loading',
        pass2: 'loading',
        pass3: 'loading',
        pass4: 'loading',
      });

      const analysis = await fourPassAnalysis(
        sourceText, lang, detectedType, abortSignal
      );
      if (gen !== analyzeGenRef.current) return;

      if (!analysis?.pass1 || !analysis?.summary) {
        throw new Error('AI analysis returned incomplete data. Please try again.');
      }

      const baseDone = { read: 'done', classify: 'done' };
      setPassStatus({ ...baseDone, pass1: 'done', pass2: 'loading', pass3: 'loading', pass4: 'loading' });
      await delay(350);
      if (gen !== analyzeGenRef.current) return;
      setPassStatus({ ...baseDone, pass1: 'done', pass2: 'done', pass3: 'loading', pass4: 'loading' });
      await delay(350);
      if (gen !== analyzeGenRef.current) return;
      setPassStatus({ ...baseDone, pass1: 'done', pass2: 'done', pass3: 'done', pass4: 'loading' });
      await delay(350);
      if (gen !== analyzeGenRef.current) return;
      setPassStatus({ ...baseDone, pass1: 'done', pass2: 'done', pass3: 'done', pass4: 'done' });

      const { riskLevel, scamScore } = computeRiskLevel(
        sourceText, analysis, detectedType
      );

      setResult({
        ...modelResult,
        riskLevel,
        scamScore,
        docType: detectedType,
        analysis,
        fileName: fileName || 'document',
        timestamp: new Date().toLocaleString('en-IN'),
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Analysis failed. Check server and API key.');
      setResult(null);
      console.error(err);
    } finally {
      if (gen === analyzeGenRef.current) {
        setLoading(false);
        setPassStatus({});
        abortRef.current = null;
      }
    }
  };

  const acceptDisclaimer = () => {
    sessionStorage.setItem('nyaiy_disclaimer', '1');
    setDisclaimerOpen(false);
    if (pdfFile && !loading && !result) {
      handleAnalyze(pdfFile);
    }
  };

  // ── Chatbot with Memory ───────────────────
  const handleChat = async () => {
    if (!chatInput.trim() || !result) return;
    const question = chatInput;
    setChatInput('');
    const newHistory = [...chatHistory, { role: 'user', text: question }];
    setChatHistory(newHistory);
    setChatLoading(true);

    try {
      const answer = await askChatbot(
        question, documentText || text, lang, newHistory
      );
      setChatHistory((h) => [...h, { role: 'bot', text: answer }]);
    } catch (err) {
      setChatHistory((h) => [
        ...h,
        {
          role: 'bot',
          text: err.message || 'Sorry, could not process your question.',
        },
      ]);
    }
    setChatLoading(false);
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // ── Text to Speech ────────────────────────
  const speakText = (content) => {
    window.speechSynthesis.cancel();
    const msg  = new SpeechSynthesisUtterance(content);
    msg.lang   = lang === 'hi' ? 'hi-IN' : 'en-IN';
    msg.rate   = 0.9;
    window.speechSynthesis.speak(msg);
  };

  const translateCaseType = (caseType) => {
    if (caseType === 'Civil Law') return t.case_civil;
    if (caseType === 'Criminal Law') return t.case_criminal;
    if (caseType === 'Constitutional Law') return t.case_constitutional;
    return caseType;
  };

  const tabs = [
    { id: 'pass1',       label: t.tabClauses,    icon: FileText      },
    { id: 'pass2',       label: t.tabDeviations, icon: Scale         },
    { id: 'pass3',       label: t.tabLaws,       icon: Shield        },
    { id: 'pass4',       label: t.tabScams,      icon: AlertTriangle },
    { id: 'rights',      label: t.tabRights,     icon: Shield        },
    { id: 'negotiation', label: t.tabNegotiate,  icon: Scale         },
    { id: 'chatbot',     label: t.tabChatbot,    icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Navbar ── */}
      <nav className="bg-[#0d1b3e] text-white px-6 py-4
                      flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">
              NyAIy
            </h1>
            <p className="text-xs text-gray-300">
              Your Legal Copilot
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {docType && (
            <span className="bg-yellow-400 text-[#0d1b3e]
                           px-3 py-1 rounded-full text-xs font-bold">
              {DOC_TYPES[docType]?.icon} {DOC_TYPES[docType]?.label}
            </span>
          )}
          <button
            onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')}
            className="flex items-center gap-2 bg-yellow-400
                       text-[#0d1b3e] px-3 py-2 rounded-lg
                       font-bold text-sm hover:bg-yellow-300"
          >
            <Globe size={16}/>
            {lang === 'en' ? 'हिंदी' : 'English'}
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {apiReady === false && (
          <div className="mb-4 flex items-center gap-2 text-amber-800
                         bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
            <AlertCircle size={16}/>
            {t.apiNotConfigured}
          </div>
        )}

        {/* ── Upload Card ── */}
        <div className="bg-white rounded-2xl shadow-md p-8 mb-6">
          <h2 className="text-xl font-bold text-[#0d1b3e] mb-6">
            {t.upload}
          </h2>

          {/* Drop Zone */}
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className="border-2 border-dashed border-[#0d1b3e]
                       rounded-xl p-10 text-center cursor-pointer
                       hover:bg-blue-50 transition mb-4"
          >
            <Upload className="mx-auto mb-3 text-[#0d1b3e]"
                    size={40}/>
            <p className="text-gray-600 mb-2">{t.dragdrop}</p>
            <span className="bg-[#0d1b3e] text-white px-5 py-2
                            rounded-lg text-sm font-medium">
              {t.browse}
            </span>
            {fileName && (
              <p className="mt-3 text-green-600 text-sm font-medium">
                ✅ {fileName}
                {docType && (
                  <span className="ml-2 text-blue-600">
                    — {DOC_TYPES[docType]?.icon}
                    {DOC_TYPES[docType]?.label}
                  </span>
                )}
              </p>
            )}
          </div>

          <input ref={fileRef} type="file"
                 accept=".txt,.pdf,application/pdf,text/plain"
                 className="hidden"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) handleFile(f);
                   e.target.value = '';
                 }}/>

          {/* Text Area — manual paste only; PDFs analyze without filling this */}
          <textarea
            value={pdfFile ? '' : text}
            onChange={(e) => {
              setPdfFile(null);
              setText(e.target.value);
              setDocumentText(e.target.value);
              setDocType(detectDocType(e.target.value));
            }}
            placeholder={
              pdfFile
                ? `📄 ${fileName} — analyzing document...`
                : t.placeholder
            }
            readOnly={!!pdfFile || loading}
            rows={5}
            className="w-full border border-gray-200 rounded-xl
                       p-4 text-sm text-gray-700 resize-none
                       focus:outline-none focus:ring-2
                       focus:ring-[#0d1b3e] mb-4
                       disabled:bg-gray-50"
          />

          {!pdfFile && text.length > 0 && (
            <p className="text-xs text-gray-400 mb-4 text-right">
              {text.length} characters
              {text.length < 100 && (
                <span className="text-yellow-500 ml-2">
                  — add more text for better results
                </span>
              )}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleVoice}
              className={`flex items-center gap-2 px-4 py-2
                         rounded-lg text-sm font-medium border-2
                         transition ${listening
                ? 'bg-red-50 border-red-400 text-red-600 animate-pulse'
                : 'border-[#0d1b3e] text-[#0d1b3e] hover:bg-blue-50'
              }`}
            >
              {listening
                ? <><MicOff size={16}/>{t.listening}</>
                : <><Mic size={16}/>{t.voiceInput}</>
              }
            </button>

            {loading ? (
              <button
                type="button"
                onClick={cancelAnalysis}
                className="px-4 py-2 rounded-lg text-sm font-medium border-2
                           border-red-400 text-red-600 hover:bg-red-50"
              >
                {t.cancel}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => handleAnalyze()}
              disabled={loading || apiReady === false || (!text.trim() && !pdfFile)}
              className="flex-1 bg-[#0d1b3e] text-white py-2
                         rounded-lg font-bold text-sm
                         hover:bg-blue-900 disabled:opacity-60
                         transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4"
                       viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12"
                            r="10" stroke="white" strokeWidth="4"/>
                    <path className="opacity-75" fill="white"
                          d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {t.analyzing}
                </span>
              ) : t.analyze}
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2
                           text-red-600 bg-red-50 p-3
                           rounded-lg text-sm">
              <AlertCircle size={16}/> {error}
            </div>
          )}
        </div>

        {/* ── Loading Progress — 4-Pass ── */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <h3 className="font-bold text-[#0d1b3e] mb-4">
              {lang === 'hi' ? '🔍 4-पास विश्लेषण चल रहा है...' : '🔍 Running 4-Pass Analysis...'}
            </h3>
            {[
              ...(pdfFile ? [PDF_READ_STEP(t)] : []),
              ...FOUR_PASS_PROGRESS(t),
            ].map((p) => (
              <div key={p.key}
                   className="flex items-center gap-3 mb-3">
                <div className={`w-4 h-4 rounded-full flex-shrink-0
                               transition-all ${
                  passStatus[p.key] === 'done'
                    ? 'bg-green-500'
                    : passStatus[p.key] === 'loading'
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-gray-200'
                }`}/>
                <span className={`text-sm ${
                  passStatus[p.key] === 'done'
                    ? 'text-green-600 font-medium'
                    : passStatus[p.key] === 'loading'
                    ? 'text-yellow-600 font-medium'
                    : 'text-gray-400'
                }`}>
                  {p.label}
                </span>
                {passStatus[p.key] === 'done' && (
                  <span className="text-green-500 text-xs">✓</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div className="bg-white rounded-2xl shadow-md p-8">

            {/* Document Type Banner */}
            <div className="bg-[#0d1b3e] text-white rounded-xl
                           p-4 mb-6 flex items-center gap-3">
              <span className="text-2xl">
                {DOC_TYPES[result.docType]?.icon}
              </span>
              <div>
                <p className="font-bold">
                  {t['doc_' + result.docType] || DOC_TYPES[result.docType]?.label}
                </p>
                <p className="text-xs text-gray-300">
                  {t.docTypeBanner || 'Auto-detected document type'}
                </p>
              </div>
            </div>

            {/* Classification Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{t.caseType}</p>
                <p className="text-lg font-bold text-[#0d1b3e]">{translateCaseType(result.case_type)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{t.confidence}</p>
                <p className="text-lg font-bold text-[#0d1b3e]">{result.confidence}%</p>
              </div>
              <div className={`border rounded-xl p-4 ${riskColors[result.riskLevel]}`}>
                <p className="text-xs mb-1 font-medium">{t.riskLevel}</p>
                <p className="text-lg font-bold">{t['risk_' + result.riskLevel.toLowerCase()] || result.riskLevel}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{t.scamScore}</p>
                <p className={`text-lg font-bold ${
                  result.scamScore >= 60 ? 'text-red-600'
                    : result.scamScore >= 30 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {result.scamScore}/100
                </p>
              </div>
            </div>

            {/* Summary */}
            {result.analysis?.summary && (
              <div className="bg-blue-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold
                               text-[#0d1b3e] mb-1">
                    📋 {lang === 'hi' ? 'सारांश' : 'Summary'}
                  </p>
                  <button
                    onClick={() => speakText(result.analysis.summary)}
                    className="text-xs text-[#0d1b3e] border
                               border-[#0d1b3e] px-2 py-1
                               rounded hover:bg-blue-100"
                  >
                    🔊 {lang === 'hi' ? 'सुनें' : 'Listen'}
                  </button>
                </div>
                <p className="text-sm text-gray-700">
                  {result.analysis.summary}
                </p>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap mb-6">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-3 py-2
                             rounded-lg text-xs font-medium
                             transition ${activeTab === tab.id
                    ? 'bg-[#0d1b3e] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <tab.icon size={12}/>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-gray-50 rounded-xl p-5 mb-6 min-h-48">

              {/* Pass 1 */}
              {activeTab === 'pass1' && (
                <div>
                  <h3 className="font-bold text-[#0d1b3e] mb-4">
                    {t.pass1}
                  </h3>
                  {result.analysis?.pass1?.clauses?.length > 0
                    ? result.analysis.pass1.clauses.map((c, i) => (
                      <div key={i}
                           className="bg-white rounded-lg p-4
                                      mb-3 border border-gray-200">
                        <div className="flex justify-between
                                        items-start mb-2">
                          <p className="text-sm text-gray-800 flex-1">
                            {c.clause}
                          </p>
                          <span className={`ml-2 px-2 py-1 rounded
                                          text-xs font-bold text-white
                                          flex-shrink-0
                                          ${riskBadge[c.risk]
                                            || 'bg-gray-400'}`}>
                            {t['risk_' + c.risk.toLowerCase()] || c.risk}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {c.explanation}
                        </p>
                      </div>
                    ))
                    : <p className="text-gray-400 text-sm">
                        {t.noClauses}
                      </p>
                  }
                </div>
              )}

              {/* Pass 2 */}
              {activeTab === 'pass2' && (
                <div>
                  <h3 className="font-bold text-[#0d1b3e] mb-4">
                    {t.pass2}
                  </h3>
                  {result.analysis?.pass2?.deviations?.length > 0
                    ? result.analysis.pass2.deviations.map((d, i) => (
                      <div key={i}
                           className="bg-white rounded-lg p-4 mb-3
                                      border-l-4 border-yellow-400">
                        <p className="font-semibold text-sm
                                      text-gray-800 mb-2">
                          ⚠️ {d.issue}
                        </p>
                        <p className="text-xs text-red-600 mb-1">
                          {lang === 'hi' ? 'मिला: ' : 'Found: '}{d.found}
                        </p>
                        <p className="text-xs text-green-600 mb-1">
                          {lang === 'hi' ? 'मानक: ' : 'Standard: '}{d.standard}
                        </p>
                        <span className={`text-xs px-2 py-0.5
                                        rounded font-medium
                                        text-white
                                        ${riskBadge[d.severity]
                                          || 'bg-gray-400'}`}>
                          {t['risk_' + d.severity.toLowerCase()] || d.severity}
                        </span>
                      </div>
                    ))
                    : <p className="text-gray-400 text-sm">
                        {t.noDeviations}
                      </p>
                  }
                </div>
              )}

              {/* Pass 3 */}
              {activeTab === 'pass3' && (
                <div>
                  <h3 className="font-bold text-[#0d1b3e] mb-4">
                    {t.pass3}
                  </h3>
                  {result.analysis?.pass3?.laws?.length > 0
                    ? result.analysis.pass3.laws.map((l, i) => (
                      <div key={i}
                           className="bg-white rounded-lg p-4 mb-3
                                      border border-gray-200">
                        <p className="font-semibold text-sm
                                      text-[#0d1b3e] mb-1">
                          ⚖️ {l.law}
                        </p>
                        <p className="text-xs text-gray-500 mb-1">
                          {lang === 'hi' ? 'धारा: ' : 'Section: '}{l.section}
                        </p>
                        <p className="text-xs text-gray-700">
                          {l.implication}
                        </p>
                      </div>
                    ))
                    : <p className="text-gray-400 text-sm">
                        {t.noLaws}
                      </p>
                  }
                </div>
              )}

              {/* Pass 4 */}
              {activeTab === 'pass4' && (
                <div>
                  <h3 className="font-bold text-[#0d1b3e] mb-4">
                    {t.pass4}
                  </h3>
                  {result.analysis?.pass4?.redFlags?.length > 0
                    ? result.analysis.pass4.redFlags.map((f, i) => (
                      <div key={i}
                           className="bg-white rounded-lg p-4 mb-3
                                      border-l-4 border-red-400">
                        <p className="font-semibold text-sm
                                      text-red-700 mb-1">
                          🚩 {f.pattern}
                        </p>
                        <p className="text-xs text-gray-600 mb-1">
                          {lang === 'hi' ? 'मिला: ' : 'Found: '}{f.found}
                        </p>
                        <p className="text-xs text-red-500">
                          ⚠️ {f.warning}
                        </p>
                      </div>
                    ))
                    : <p className="text-gray-400 text-sm">
                        {t.noScams}
                      </p>
                  }
                </div>
              )}

              {/* Rights Card */}
              {activeTab === 'rights' && (
                <div>
                  <h3 className="font-bold text-[#0d1b3e] mb-4">
                    {t.rights}
                  </h3>
                  {result.analysis?.rightsCard?.length > 0
                    ? result.analysis.rightsCard.map((r, i) => (
                      <div key={i}
                           className="bg-white rounded-lg p-4 mb-3
                                      border-l-4 border-green-400">
                        <div className="flex justify-between">
                          <p className="font-semibold text-sm
                                        text-green-700 mb-1">
                            ✅ {r.right}
                          </p>
                          <button
                            onClick={() => speakText(
                              `${r.right}. ${r.description}`
                            )}
                            className="text-xs text-gray-400
                                       hover:text-gray-600"
                          >
                            🔊
                          </button>
                        </div>
                        <p className="text-xs text-gray-700 mb-1">
                          {r.description}
                        </p>
                        <p className="text-xs text-blue-600 font-medium">
                          📚 {r.law}
                        </p>
                      </div>
                    ))
                    : <p className="text-gray-400 text-sm">
                        {t.noRights}
                      </p>
                  }
                </div>
              )}

              {/* Negotiation */}
              {activeTab === 'negotiation' && (
                <div>
                  <h3 className="font-bold text-[#0d1b3e] mb-4">
                    {t.negotiation}
                  </h3>
                  {result.analysis?.negotiationClauses?.length > 0
                    ? result.analysis.negotiationClauses.map((n, i) => (
                      <div key={i}
                           className="bg-white rounded-lg p-4 mb-3
                                      border border-gray-200">
                        <p className="font-semibold text-sm
                                      text-gray-800 mb-2">
                          📝 {n.issue}
                        </p>
                        <div className="bg-red-50 rounded p-2 mb-2">
                          <p className="text-xs text-red-600">
                            ❌ {lang === 'hi' ? 'मूल: ' : 'Original: '}{n.original}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded p-2">
                          <p className="text-xs text-green-700 font-medium">
                            ✅ {lang === 'hi' ? 'सुझाया गया: ' : 'Suggested: '}{n.suggested}
                          </p>
                        </div>
                      </div>
                    ))
                    : <p className="text-gray-400 text-sm">
                        {t.noNegotiations}
                      </p>
                  }
                </div>
              )}

              {/* Chatbot */}
              {activeTab === 'chatbot' && (
                <div>
                  <h3 className="font-bold text-[#0d1b3e] mb-4">
                    {t.chatbot}
                  </h3>
                  <div className="bg-white rounded-lg p-4 mb-4
                                 h-48 overflow-y-auto">
                    {chatHistory.length === 0 && (
                      <p className="text-gray-400 text-sm text-center mt-8">
                        {t.chatbotWelcome}
                      </p>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div key={i}
                           className={`mb-3 flex ${
                             msg.role === 'user'
                               ? 'justify-end'
                               : 'justify-start'
                           }`}>
                        <div className={`px-3 py-2 rounded-lg
                                        text-sm max-w-xs ${
                          msg.role === 'user'
                            ? 'bg-[#0d1b3e] text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {msg.role === 'bot' && (
                            <span className="mr-1">🤖</span>
                          )}
                          {msg.text}
                          {msg.role === 'bot' && (
                            <button
                              onClick={() => speakText(msg.text)}
                              className="ml-2 text-gray-400
                                         hover:text-gray-600 text-xs"
                            >
                              🔊
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start mb-3">
                        <div className="bg-gray-100 px-3 py-2
                                       rounded-lg text-sm">
                          {t.chatbotThinking}
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef}/>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleChat();
                      }}
                      placeholder={t.askQuestion}
                      className="flex-1 border border-gray-200
                                 rounded-lg px-3 py-2 text-sm
                                 focus:outline-none focus:ring-2
                                 focus:ring-[#0d1b3e]"
                    />
                    <button
                      onClick={handleChat}
                      disabled={chatLoading}
                      className="bg-[#0d1b3e] text-white px-4
                                 py-2 rounded-lg text-sm font-medium
                                 hover:bg-blue-900 disabled:opacity-60
                                 flex items-center gap-1"
                    >
                      <ChevronRight size={16}/>
                      {t.send}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Download PDF */}
            <button
              onClick={async () => {
                setPdfLoading(true);
                try {
                  await generatePDF({
                    fileName:   result.fileName,
                    caseType:   translateCaseType(result.case_type),
                    confidence: result.confidence,
                    riskLevel:  t['risk_' + result.riskLevel.toLowerCase()] || result.riskLevel,
                    analysis:   result.analysis,
                    timestamp:  result.timestamp,
                    scamScore:  result.scamScore,
                    docType:    t['doc_' + result.docType] || DOC_TYPES[result.docType]?.label,
                    lang:       lang
                  });
                } catch (e) {
                  console.error(e);
                } finally {
                  setPdfLoading(false);
                }
              }}
              disabled={pdfLoading}
              className="w-full flex items-center justify-center
                         gap-2 bg-yellow-400 text-[#0d1b3e] py-4
                         rounded-xl font-bold text-lg
                         hover:bg-yellow-300 transition mt-2 disabled:opacity-60"
            >
              <Download size={20}/> {pdfLoading ? (lang === 'hi' ? 'रिपोर्ट तैयार हो रही है...' : 'Generating Report...') : t.download}
            </button>
          </div>
        )}
      </div>

      {/* Disclaimer modal */}
      {disclaimerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-[#0d1b3e] text-lg">
                {t.disclaimerTitle}
              </h3>
              <button
                type="button"
                onClick={() => setDisclaimerOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20}/>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">{t.disclaimerBody}</p>
            <button
              type="button"
              onClick={acceptDisclaimer}
              className="w-full bg-[#0d1b3e] text-white py-3 rounded-lg font-bold"
            >
              {t.disclaimerAccept}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#0d1b3e] text-gray-400 text-center
                        text-xs py-4 mt-10">
        NyAIy — AI-generated legal information only. Not legal advice.
        | Central University of Jammu | Built with ❤️ for Indian Citizens
      </footer>
    </div>
  );
}