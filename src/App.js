import { useCallback, useEffect, useRef, useState } from 'react';
import { strings } from './i18n';
import { analyseDocument, askQuestion, checkHealth, classifyDocument } from './lib/api';
import { detectDocType, SAMPLE_DOCUMENT } from './lib/docTypes';
import { extractText, MAX_DOC_CHARS, MIN_DOC_CHARS, validateFile } from './lib/extract';
import { clearReports, loadReports, saveReport } from './lib/history';
import { overallRisk } from './lib/risk';
import Header from './components/Header';
import Progress from './components/Progress';
import Report from './components/Report';
import Start from './components/Start';

const LANG_KEY = 'nyaiy.lang';
const initialLang = () => {
  try {
    return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
};

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Turn any failure into a sentence in the current language. */
const errorMessage = (err, t) => {
  const byCode = {
    errFileType: t.errFileType,
    errFileSize: t.errFileSize,
    errFileEmpty: t.errFileEmpty,
    errPdfBroken: t.errPdfBroken,
    too_short: t.errTooShort,
    timeout: t.errTimeout,
    offline: t.offline,
    not_configured: t.notConfigured,
  };
  // Server messages (rate limits, AI errors) are already written for people.
  return byCode[err?.code] || (err?.code && err.message !== err.code ? err.message : '') || t.errGeneric;
};

export default function App() {
  const [lang, setLang] = useState(initialLang);
  const [view, setView] = useState('start'); // start | working | report
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [reports, setReports] = useState(loadReports);
  const [openId, setOpenId] = useState(null);
  const [progress, setProgress] = useState({ step: 'read', detail: null, name: '' });
  const [chatBusy, setChatBusy] = useState(false);
  const [translating, setTranslating] = useState(false);
  const abortRef = useRef(null);
  const t = strings[lang];
  const report = reports.find((r) => r.id === openId) || null;

  useEffect(() => {
    let alive = true;
    checkHealth().then((h) => alive && setHealth(h));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // Preference just will not persist.
    }
  }, [lang]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, openId]);

  const update = useCallback((next) => setReports((list) => saveReport(list, next)), []);

  const chooseFile = (chosen) => {
    setError('');
    if (!chosen) return setFile(null);
    const problem = validateFile(chosen);
    if (problem) return setError(strings[lang][problem]);
    setText('');
    return setFile(chosen);
  };

  const analyse = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { signal } = ctrl;
    const name = file ? file.name : t.pastedText;
    setError('');
    setProgress({ step: 'read', detail: null, name });
    setView('working');

    try {
      let source = { text: text.trim().slice(0, MAX_DOC_CHARS), truncated: text.trim().length > MAX_DOC_CHARS };
      if (file) {
        source = await extractText(file, {
          lang,
          signal,
          onProgress: (detail) => setProgress((p) => ({ ...p, detail })),
        });
      } else if (source.text.length < MIN_DOC_CHARS) {
        throw Object.assign(new Error(), { code: 'too_short' });
      }

      const docType = detectDocType(source.text, file?.name);
      setProgress({ step: 'classify', detail: null, name });
      const classification = await classifyDocument(source.text, docType, signal);

      setProgress({ step: 'analyse', detail: null, name });
      const result = await analyseDocument(source.text, lang, docType, signal);

      setProgress({ step: 'report', detail: null, name });
      const next = {
        id: newId(),
        name,
        docType,
        lang,
        caseType: classification.case_type,
        confidence: parseFloat(classification.confidence) || 0,
        analysis: result.analysis,
        risk: overallRisk(result.analysis),
        analysedChars: result.analysedChars,
        truncated: Boolean(source.truncated || result.truncated),
        createdAt: new Date().toISOString(),
        text: source.text,
        chat: [],
      };
      update(next);
      setOpenId(next.id);
      setText('');
      setFile(null);
      setView('report');
    } catch (err) {
      if (err.name !== 'AbortError') setError(errorMessage(err, strings[lang]));
      setView('start');
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setView('start');
  };

  const startOver = () => {
    abortRef.current?.abort();
    setError('');
    setOpenId(null);
    setView('start');
  };

  const ask = async (question) => {
    if (!report) return;
    const history = report.chat.filter((m) => !m.error);
    const withQuestion = { ...report, chat: [...report.chat, { role: 'user', text: question }] };
    update(withQuestion);
    setChatBusy(true);
    let reply;
    try {
      const answer = await askQuestion({ question, documentText: report.text, lang, history });
      reply = { role: 'assistant', text: answer };
    } catch (err) {
      reply = { role: 'assistant', text: errorMessage(err, strings[lang]), error: true };
    }
    update({ ...withQuestion, chat: [...withQuestion.chat, reply] });
    setChatBusy(false);
  };

  const translate = async () => {
    if (!report) return;
    setTranslating(true);
    setError('');
    try {
      const result = await analyseDocument(report.text, lang, report.docType);
      update({ ...report, lang, analysis: result.analysis, risk: overallRisk(result.analysis) });
    } catch (err) {
      setError(errorMessage(err, strings[lang]));
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Header
        t={t}
        showNew={view === 'report'}
        onNew={startOver}
        onToggleLang={() => setLang((l) => (l === 'en' ? 'hi' : 'en'))}
      />

      <main id="main" className="flex-1">
        {view === 'working' && (
          <Progress t={t} name={progress.name} step={progress.step} detail={progress.detail} onCancel={cancel} />
        )}
        {view === 'report' && report && (
          <>
            {error && (
              <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
                <p role="alert" className="text-sm text-risk-high">{error}</p>
              </div>
            )}
            <Report
              t={t}
              lang={lang}
              report={report}
              chatBusy={chatBusy}
              translating={translating}
              onAsk={ask}
              onTranslate={translate}
            />
          </>
        )}
        {(view === 'start' || (view === 'report' && !report)) && (
          <Start
            t={t}
            lang={lang}
            text={text}
            file={file}
            error={error}
            health={health}
            reports={reports}
            onText={setText}
            onFile={chooseFile}
            onSubmit={analyse}
            onSample={() => setText(SAMPLE_DOCUMENT)}
            onDismissError={() => setError('')}
            onOpen={(id) => {
              setError('');
              setOpenId(id);
              setView('report');
            }}
            onClearHistory={() => setReports(clearReports())}
          />
        )}
      </main>

      {view !== 'start' && (
      <footer className="no-print border-t border-line">
        <p className={`mx-auto max-w-6xl px-4 pt-5 text-xs text-muted sm:px-6 ${view === 'report' ? 'pb-28 lg:pb-5' : 'pb-5'}`}>
          NyAIy · {t.disclaimer}
        </p>
      </footer>
      )}
    </div>
  );
}
