import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, FileText, Image as ImageIcon, Mic, MicOff, Paperclip, X } from 'lucide-react';
import { fill } from '../i18n';
import { fileKind, MAX_DOC_CHARS, MIN_DOC_CHARS } from '../lib/extract';
import { useMediaQuery } from '../lib/hooks';

const formatSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/** The single place a document enters the app: paste, attach, drop or dictate. */
export default function Composer({ t, lang, text, file, disabled, onText, onFile, onSubmit }) {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const touch = useMediaQuery('(pointer: coarse)');
  const recognitionRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e) => {
      const said = Array.from(e.results)
        .slice(e.resultIndex)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim();
      if (said) onText((prev) => (prev ? `${prev} ${said}` : said));
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const length = text.trim().length;
  const ready = Boolean(file) || length >= MIN_DOC_CHARS;
  const FileIcon = file && fileKind(file) === 'image' ? ImageIcon : FileText;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !disabled) onSubmit();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onFile(dropped);
      }}
      className={`relative rounded-xl border bg-surface shadow-sm transition-colors focus-within:border-accent ${
        dragging ? 'border-accent ring-2 ring-accent/20' : 'border-line'
      }`}
    >
      {file ? (
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <FileIcon size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-sm text-muted">{formatSize(file.size)}</p>
          </div>
          <button type="button" onClick={() => onFile(null)} className="icon-btn" aria-label={t.removeFile}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <label htmlFor="doc-text" className="sr-only">{t.pasteLabel}</label>
          <textarea
            id="doc-text"
            value={text}
            onChange={(e) => onText(e.target.value)}
            placeholder={t.pastePlaceholder}
            rows={7}
            className="block w-full resize-y rounded-t-xl bg-transparent p-4 text-base leading-relaxed placeholder:text-muted/80 focus:outline-none sm:p-5"
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line p-2.5 sm:px-3">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) onFile(chosen);
            e.target.value = '';
          }}
        />
        <button type="button" onClick={() => fileRef.current.click()} className="btn-ghost" title={t.attachHint}>
          <Paperclip size={16} aria-hidden="true" />
          {t.attach}
        </button>
        {touch && (
          <>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const shot = e.target.files?.[0];
                if (shot) onFile(shot);
                e.target.value = '';
              }}
            />
            <button type="button" onClick={() => cameraRef.current.click()} className="btn-ghost">
              <Camera size={16} aria-hidden="true" />
              {t.takePhoto}
            </button>
          </>
        )}
        {SpeechRecognition && !file && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={listening}
            aria-label={listening ? t.voiceStop : t.voiceStart}
            title={listening ? t.voiceStop : t.voiceStart}
            className={`icon-btn ${listening ? 'bg-risk-high-soft text-risk-high' : ''}`}
          >
            {listening ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
          </button>
        )}
        <p className="order-last w-full px-1.5 empty:hidden text-xs text-muted sm:order-none sm:ml-1 sm:w-auto sm:min-w-0 sm:flex-1 sm:truncate sm:px-0" aria-live="polite">
          {file
            ? ''
            : length === 0
            ? t.attachHint
            : length < MIN_DOC_CHARS
            ? t.needMore
            : length > MAX_DOC_CHARS
            ? fill(t.longNote, { n: MAX_DOC_CHARS.toLocaleString('en-IN') })
            : `${length.toLocaleString('en-IN')} ${t.characters}`}
        </p>
        <button type="submit" disabled={!ready || disabled} className="btn-primary w-full sm:ml-auto sm:w-auto">
          {t.analyse}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-accent-soft/95 text-sm font-medium text-accent">
          {t.dropHere}
        </div>
      )}
    </form>
  );
}
