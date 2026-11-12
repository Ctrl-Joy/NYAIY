import { useEffect, useState } from 'react';
import { Check, Copy, Download, Square, Volume2 } from 'lucide-react';
import { fill } from '../i18n';
import { downloadPdf, formatDate, reportToText } from '../lib/exportReport';
import { canSpeak, speak, stopSpeaking } from '../lib/speech';
import AskPanel from './AskPanel';
import { Notice, RiskBadge } from './ui';


function Section({ id, title, sub, count, empty, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="border-t border-line py-10">
      <h2 id={`${id}-title`} className="flex items-baseline gap-2 font-serif text-2xl font-semibold tracking-tight">
        {title}
        <span className="font-sans text-sm font-normal tabular-nums text-muted">{count}</span>
      </h2>
      <p className="mt-1 text-sm text-muted">{sub}</p>
      {count === 0 ? <p className="mt-6 text-muted">{empty}</p> : <ol className="mt-6 space-y-7">{children}</ol>}
    </section>
  );
}

/** A labelled line such as "In the document: …". */
function Pair({ label, children, strong }) {
  if (!children) return null;
  return (
    <p className="mt-2 text-[0.9375rem] leading-relaxed">
      <span className="eyebrow mr-2">{label}</span>
      <span className={strong ? 'text-ink' : 'text-muted'}>{children}</span>
    </p>
  );
}

export default function Report({ t, lang, report, chatBusy, translating, onAsk, onTranslate }) {
  const [copied, setCopied] = useState('');
  const [exporting, setExporting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const [printHint, setPrintHint] = useState(false);
  const a = report.analysis;

  useEffect(
    () => () => {
      stopSpeaking();
      setSpeaking(false);
    },
    [report.id, report.lang]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportToText(report));
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied(''), 2000);
  };

  const exportPdf = async () => {
    // The PDF fonts are Latin only, so Hindi reports use the browser's print-to-PDF.
    if (report.lang === 'hi') {
      setPrintHint(true);
      setTimeout(() => window.print(), 50);
      return;
    }
    setExporting(true);
    try {
      await downloadPdf(report);
    } finally {
      setExporting(false);
    }
  };

  const toggleSpeech = async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setNoVoice(false);
    setSpeaking(true);
    const outcome = await speak(a.summary, report.lang);
    if (outcome === 'no-voice') setNoVoice(true);
    if (outcome !== 'stopped') setSpeaking(false);
  };

  const sections = [
    { id: 'clauses', nav: t.navClauses, count: a.pass1.clauses.length },
    { id: 'deviations', nav: t.navDeviations, count: a.pass2.deviations.length },
    { id: 'laws', nav: t.navLaws, count: a.pass3.laws.length },
    { id: 'flags', nav: t.navFlags, count: a.pass4.redFlags.length },
    { id: 'rights', nav: t.navRights, count: a.rightsCard.length },
    { id: 'negotiate', nav: t.navNegotiate, count: a.negotiationClauses.length },
  ];

  return (
    <div className="rise mx-auto grid max-w-6xl gap-x-12 px-4 pb-10 pt-8 sm:px-6 lg:pb-20 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pt-12 print-full">
      <article className="min-w-0 max-w-prose">
        <header>
          <p className="eyebrow">
            {t['doc_' + report.docType]} · {formatDate(report.createdAt, lang)}
          </p>
          <h1 className="mt-2 break-words font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {report.name}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <RiskBadge level={report.risk.level} label={t['risk_' + report.risk.level]} large />
            <span>
              {t['case_' + report.caseType] || report.caseType}
              <span className="mx-1.5" aria-hidden="true">·</span>
              {Math.round(report.confidence)}% {t.confidence}
            </span>
            <span title={t.flagScoreHelp} className="cursor-help underline decoration-dotted underline-offset-4">
              {t.flagScore} <span className="tabular-nums text-ink">{report.risk.score}/100</span>
            </span>
          </div>

          <p className="reading mt-6 text-[1.1875rem]">{a.summary}</p>

          <div className="no-print mt-6 flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportPdf} disabled={exporting} className="btn-secondary">
              <Download size={16} aria-hidden="true" />
              {exporting ? t.preparingPdf : t.downloadPdf}
            </button>
            <button type="button" onClick={copy} className="btn-secondary">
              {copied === 'ok' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              <span aria-live="polite">{copied === 'ok' ? t.copied : copied === 'fail' ? t.copyFailed : t.copy}</span>
            </button>
            {canSpeak && a.summary && (
              <button type="button" onClick={toggleSpeech} className="btn-ghost" aria-pressed={speaking}>
                {speaking ? <Square size={14} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
                {speaking ? t.stopListening : t.listen}
              </button>
            )}
          </div>
          {noVoice && (
            <p role="status" className="no-print mt-2 text-sm text-muted">
              {fill(t.noVoice, { lang: t['langName_' + report.lang] })}
            </p>
          )}
          {printHint && <p className="no-print mt-2 text-sm text-muted">{t.printHint}</p>}

          <div className="no-print mt-6 space-y-3 empty:hidden">
            {report.lang !== lang && (
              <Notice>
                {fill(t.translatePrompt, { from: t['langName_' + report.lang] })}{' '}
                <button
                  type="button"
                  onClick={onTranslate}
                  disabled={translating}
                  className="-my-2.5 inline-flex min-h-[2.75rem] items-center font-medium text-accent underline underline-offset-4 disabled:opacity-60"
                >
                  {translating ? t.askThinking : fill(t.translateAction, { to: t['langName_' + lang] })}
                </button>
              </Notice>
            )}
            {report.truncated && (
              <Notice>{fill(t.truncatedNote, { n: report.analysedChars.toLocaleString('en-IN') })}</Notice>
            )}
          </div>

          <nav aria-label={t.onThisPage} className="no-print mt-4 sm:mt-6">
            <ul className="-mx-1.5 flex flex-wrap text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="inline-flex min-h-[2.75rem] min-w-[2.75rem] items-center gap-1 rounded px-1.5 text-muted hover:text-accent">
                    {s.nav} <span className="tabular-nums text-muted/70">{s.count}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <div className="mt-8">
          <Section id="clauses" title={t.secClauses} sub={t.secClausesSub} count={a.pass1.clauses.length} empty={t.emptyClauses}>
            {a.pass1.clauses.map((c, i) => (
              <li key={i}>
                <RiskBadge level={c.risk} label={t['risk_' + c.risk]} />
                <p className="reading mt-2">{c.clause}</p>
                <p className="mt-1.5 text-base leading-relaxed text-muted sm:text-[0.9375rem]">{c.explanation}</p>
              </li>
            ))}
          </Section>

          <Section id="deviations" title={t.secDeviations} sub={t.secDeviationsSub} count={a.pass2.deviations.length} empty={t.emptyDeviations}>
            {a.pass2.deviations.map((d, i) => (
              <li key={i}>
                <RiskBadge level={d.severity} label={t['risk_' + d.severity]} />
                <h3 className="mt-2 font-serif text-lg font-semibold">{d.issue}</h3>
                <Pair label={t.found}>{d.found}</Pair>
                <Pair label={t.standard} strong>{d.standard}</Pair>
              </li>
            ))}
          </Section>

          <Section id="laws" title={t.secLaws} sub={t.secLawsSub} count={a.pass3.laws.length} empty={t.emptyLaws}>
            {a.pass3.laws.map((l, i) => (
              <li key={i}>
                <h3 className="font-serif text-lg font-semibold">
                  {l.law}
                  {l.section && <span className="font-sans text-sm font-normal text-muted"> · {l.section}</span>}
                </h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed">{l.implication}</p>
                {l.clause && <p className="mt-1 text-sm text-muted">{l.clause}</p>}
              </li>
            ))}
          </Section>

          <Section id="flags" title={t.secFlags} sub={t.secFlagsSub} count={a.pass4.redFlags.length} empty={t.emptyFlags}>
            {a.pass4.redFlags.map((f, i) => (
              <li key={i} className="border-l-2 border-risk-high pl-4">
                <h3 className="font-serif text-lg font-semibold">{f.pattern}</h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed">{f.warning}</p>
                <Pair label={t.found}>{f.found}</Pair>
              </li>
            ))}
          </Section>

          <Section id="rights" title={t.secRights} sub={t.secRightsSub} count={a.rightsCard.length} empty={t.emptyRights}>
            {a.rightsCard.map((r, i) => (
              <li key={i}>
                <h3 className="font-serif text-lg font-semibold">{r.right}</h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed">{r.description}</p>
                {r.law && <p className="mt-1 text-sm text-muted">{r.law}</p>}
              </li>
            ))}
          </Section>

          <Section id="negotiate" title={t.secNegotiate} sub={t.secNegotiateSub} count={a.negotiationClauses.length} empty={t.emptyNegotiate}>
            {a.negotiationClauses.map((n, i) => (
              <li key={i}>
                <h3 className="font-serif text-lg font-semibold">{n.issue}</h3>
                <Pair label={t.original}>{n.original}</Pair>
                <Pair label={t.suggested} strong>{n.suggested}</Pair>
              </li>
            ))}
          </Section>
        </div>

        <p className="hidden border-t border-line pt-6 text-sm text-muted print:block">{t.disclaimer}</p>
      </article>

      <aside className="lg:sticky lg:top-[5.5rem] lg:self-start">
        <AskPanel t={t} messages={report.chat} busy={chatBusy} onAsk={onAsk} />
      </aside>
    </div>
  );
}
