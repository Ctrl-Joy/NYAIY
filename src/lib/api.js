const API_BASE = process.env.REACT_APP_API_URL || '';
const REQUEST_TIMEOUT_MS = 75000;

/** An error with a stable `code` the interface can translate. */
export class AppError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const request = async (path, { method = 'POST', body, signal } = {}) => {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, REQUEST_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort);
  }

  try {
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      if (timedOut) throw new AppError('timeout');
      if (err.name === 'AbortError') throw err;
      throw new AppError('offline');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      if (res.status === 504) throw new AppError('timeout');
      throw new AppError(data?.code || 'server_error', data?.error);
    }
    return data;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
};

export const checkHealth = async () => {
  try {
    const data = await request('/api/health', { method: 'GET' });
    return { reachable: true, configured: Boolean(data.groqConfigured) };
  } catch {
    return { reachable: false, configured: false };
  }
};

export const classifyDocument = (text, docTypeHint, signal) =>
  request('/api/classify', { body: { text, docTypeHint }, signal });

export const analyseDocument = (text, lang, docType, signal) =>
  request('/api/analyze', { body: { text, lang, docType }, signal });

export const askQuestion = ({ question, documentText, lang, history }, signal) =>
  request('/api/chat', { body: { question, documentText, lang, history }, signal }).then(
    (d) => d.answer
  );
