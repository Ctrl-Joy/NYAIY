import { useEffect, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { fill } from '../i18n';

const ORDER = ['read', 'classify', 'analyse', 'report'];

/**
 * Shows the real stages of an analysis. `step` is the stage in progress and
 * `detail` carries live extraction progress (page numbers, OCR percentage).
 */
export default function Progress({ t, name, step, detail, onCancel }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const current = ORDER.indexOf(step);
  const labels = {
    read: t.stepRead,
    classify: t.stepClassify,
    analyse: t.stepAnalyse,
    report: t.stepReport,
  };

  let sub = '';
  if (step === 'read' && detail) {
    const where = detail.pages > 1 || detail.stage === 'pdf' ? fill(t.page, { a: detail.page || 1, b: detail.pages || 1 }) : '';
    if (detail.stage === 'pdf') sub = `${t.stepReadPdf} · ${where}`;
    if (detail.stage === 'ocr') {
      sub = [t.stepReadOcr, where, detail.percent ? `${detail.percent}%` : ''].filter(Boolean).join(' · ');
    }
  }
  if (step === 'analyse' && seconds > 20) sub = t.stepSlow;

  return (
    <section className="rise mx-auto max-w-xl px-4 py-16 sm:px-6 sm:py-24" aria-busy="true">
      <p className="eyebrow truncate">{name}</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">{t.workingTitle}</h1>

      <ol className="mt-10 space-y-5" aria-live="polite">
        {ORDER.map((key, i) => {
          const state = i < current ? 'done' : i === current ? 'active' : 'todo';
          return (
            <li key={key} className="flex items-start gap-4" aria-current={state === 'active' ? 'step' : undefined}>
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  state === 'done'
                    ? 'border-accent bg-accent text-white'
                    : state === 'active'
                    ? 'border-accent text-accent'
                    : 'border-line text-transparent'
                }`}
              >
                {state === 'done' && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                {state === 'active' && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <p className={state === 'todo' ? 'text-muted' : state === 'active' ? 'font-medium' : ''}>
                  {labels[key]}
                </p>
                {state === 'active' && sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-12 flex items-center gap-4">
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t.cancel}
        </button>
        <span className="text-sm tabular-nums text-muted" aria-hidden="true">
          {fill(t.elapsed, { s: seconds })}
        </span>
      </div>
    </section>
  );
}
