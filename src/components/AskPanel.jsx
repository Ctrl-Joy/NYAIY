import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, MessageSquareText, X } from 'lucide-react';
import { useMediaQuery, useVisualViewport } from '../lib/hooks';

function Conversation({ t, messages, busy, onPick }) {
  const logRef = useRef(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  return (
    <div
      ref={logRef}
      className="min-h-[9rem] flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
      aria-live="polite"
    >
      {messages.length === 0 && (
        <div>
          <p className="text-sm leading-relaxed text-muted">{t.askEmpty}</p>
          <ul className="mt-4 space-y-2">
            {t.askSuggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  disabled={busy}
                  className="min-h-[2.75rem] w-full rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-accent hover:bg-accent-soft"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {messages.map((m, i) => (
        <div key={i} data-message={m.role}>
          <p className="eyebrow mb-1">{m.role === 'user' ? t.you : t.assistant}</p>
          <p
            className={`whitespace-pre-wrap break-words text-base leading-relaxed lg:text-[0.9375rem] ${
              m.error ? 'text-risk-high' : m.role === 'user' ? 'font-medium' : ''
            }`}
          >
            {m.text}
          </p>
        </div>
      ))}
      {busy && <p className="animate-pulse text-sm text-muted">{t.askThinking}</p>}
    </div>
  );
}

function AskForm({ t, busy, onSend, onFocus }) {
  const [draft, setDraft] = useState('');
  const send = () => {
    const q = draft.trim();
    if (!q || busy) return;
    setDraft('');
    onSend(q);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex items-end gap-2 p-2.5"
    >
      <label htmlFor="ask-input" className="sr-only">{t.askPlaceholder}</label>
      <textarea
        id="ask-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        rows={1}
        maxLength={1000}
        enterKeyHint="send"
        placeholder={t.askPlaceholder}
        className="max-h-32 min-h-[2.75rem] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-base placeholder:text-muted/80 focus:outline-none"
      />
      <button type="submit" disabled={!draft.trim() || busy} className="btn-primary w-11 px-0" aria-label={t.askSend}>
        <ArrowUp size={18} aria-hidden="true" />
      </button>
    </form>
  );
}

/**
 * Follow-up questions about the open document.
 * Desktop: a panel beside the report. Phone: a bar fixed to the bottom of the
 * screen that opens into a sheet and stays above the on-screen keyboard.
 */
export default function AskPanel({ t, messages, busy, onAsk }) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [open, setOpen] = useState(false);
  const viewport = useVisualViewport(!desktop);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (desktop) {
    return (
      <section
        id="ask"
        aria-labelledby="ask-title"
        className="no-print flex max-h-[calc(100dvh-6.5rem)] flex-col rounded-xl border border-line bg-surface shadow-sm"
      >
        <h2 id="ask-title" className="border-b border-line px-5 py-3 font-medium">{t.askTitle}</h2>
        <Conversation t={t} messages={messages} busy={busy} onPick={onAsk} />
        <div className="border-t border-line">
          <AskForm t={t} busy={busy} onSend={onAsk} />
        </div>
      </section>
    );
  }

  const send = (q) => {
    setOpen(true);
    onAsk(q);
  };
  // Leave room for the header strip, the form and a little of the page behind.
  const sheetMax = viewport.height ? Math.max(180, viewport.height - 150) : undefined;

  // Rendered on <body> so it is fixed to the screen, not to an animated ancestor.
  return createPortal(
    <>
      {open && (
        <button
          type="button"
          aria-label={t.dismiss}
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="no-print fixed inset-0 z-30 bg-ink/30"
        />
      )}
      <section
        id="ask"
        aria-labelledby="ask-title"
        className="no-print fixed inset-x-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
        style={{ bottom: viewport.inset }}
      >
        {open ? (
          <div className="flex flex-col" style={{ maxHeight: sheetMax }}>
            <div className="flex items-center justify-between border-b border-line pl-4 pr-1">
              <h2 id="ask-title" className="font-medium">{t.askTitle}</h2>
              <button type="button" onClick={() => setOpen(false)} className="icon-btn" aria-label={t.dismiss}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <Conversation t={t} messages={messages} busy={busy} onPick={send} />
          </div>
        ) : (
          <h2 id="ask-title" className="sr-only">{t.askTitle}</h2>
        )}
        <div className={`flex items-end ${open ? 'border-t border-line' : ''}`}>
          {!open && messages.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="icon-btn relative mb-2.5 ml-2 text-accent"
              aria-label={`${t.askTitle} (${messages.length})`}
            >
              <MessageSquareText size={20} aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <AskForm t={t} busy={busy} onSend={send} onFocus={() => setOpen(true)} />
          </div>
        </div>
      </section>
    </>,
    document.body
  );
}
