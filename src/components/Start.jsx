import { ChevronRight } from 'lucide-react';
import { formatDate } from '../lib/exportReport';
import Composer from './Composer';
import { Alert, Notice, RiskBadge } from './ui';

/** First screen: add a document. Also lists reports made earlier in this tab. */
export default function Start({
  t, lang, text, file, error, health, reports,
  onText, onFile, onSubmit, onSample, onDismissError, onOpen, onClearHistory,
}) {
  const unavailable = health && (!health.reachable || !health.configured);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-20">
      <h1 className="max-w-2xl font-serif text-[2rem] font-semibold leading-[1.15] tracking-tight sm:text-5xl sm:leading-[1.1]">
        {t.heroTitle}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed sm:mt-5 sm:text-lg text-muted">{t.heroBody}</p>

      <div className="mt-8 space-y-4 sm:mt-10">
        {unavailable && <Notice>{health.reachable ? t.notConfigured : t.offline}</Notice>}
        {error && (
          <Alert title={t.errTitle} onDismiss={onDismissError} dismissLabel={t.dismiss}>
            {error}
          </Alert>
        )}
        <Composer
          t={t}
          lang={lang}
          text={text}
          file={file}
          disabled={Boolean(unavailable)}
          onText={onText}
          onFile={onFile}
          onSubmit={onSubmit}
        />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-sm">
          <p className="max-w-md text-muted">
            {t.disclaimer} {t.privacy}
          </p>
          {!file && !text && (
            <button
              type="button"
              onClick={onSample}
              className="-my-2.5 inline-flex min-h-[2.75rem] items-center rounded text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
            >
              {t.trySample}
            </button>
          )}
        </div>
      </div>

      {reports.length > 0 && (
        <section className="mt-16" aria-labelledby="history-title">
          <div className="flex items-baseline justify-between">
            <h2 id="history-title" className="eyebrow">{t.historyTitle}</h2>
            <button type="button" onClick={onClearHistory} className="-my-2.5 inline-flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-end rounded text-sm text-muted hover:text-ink">
              {t.historyClear}
            </button>
          </div>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {reports.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="group flex w-full items-center gap-3 py-3.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium group-hover:text-accent">{r.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {t['doc_' + r.docType]} · {formatDate(r.createdAt, lang)}
                    </span>
                  </span>
                  <RiskBadge level={r.risk.level} label={t['riskShort_' + r.risk.level]} />
                  <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
