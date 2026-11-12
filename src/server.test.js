/**
 * @jest-environment node
 */
// Tests for the API handlers shared by Vercel (api/*.js) and the local Express server.
const groq = require('../api/_groq');
const analyze = require('../api/analyze');
const chat = require('../api/chat');
const health = require('../api/health');

const call = async (handler, { method = 'POST', body } = {}) => {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; },
  };
  await handler({ method, body, url: '/api/test' }, res);
  return res;
};

const savedKey = process.env.GROQ_API_KEY;
beforeEach(() => {
  delete process.env.GROQ_API_KEY;
  delete process.env.REACT_APP_GROQ_KEY;
});
afterAll(() => {
  if (savedKey) process.env.GROQ_API_KEY = savedKey;
});

test('health reports whether the key is configured without revealing it', async () => {
  expect((await call(health, { method: 'GET' })).body).toEqual({ ok: true, groqConfigured: false, hfConfigured: false });
  process.env.GROQ_API_KEY = 'secret-value';
  const res = await call(health, { method: 'GET' });
  expect(res.body.groqConfigured).toBe(true);
  expect(JSON.stringify(res.body)).not.toContain('secret-value');
});

test('rejects the wrong method and short documents', async () => {
  expect((await call(analyze, { method: 'GET' })).statusCode).toBe(405);
  const res = await call(analyze, { body: { text: 'too short' } });
  expect(res.statusCode).toBe(400);
  expect(res.body.code).toBe('too_short');
});

test('answers 503 with a clear code when the key is missing', async () => {
  const text = 'This rental agreement is made between the landlord and the tenant for a flat.';
  const res = await call(analyze, { body: { text } });
  expect(res.statusCode).toBe(503);
  expect(res.body.code).toBe('not_configured');
  expect((await call(chat, { body: { question: 'Why?', documentText: text } })).statusCode).toBe(503);
});

test('chat needs a question and a document', async () => {
  expect((await call(chat, { body: { documentText: 'x' } })).body.code).toBe('no_question');
  expect((await call(chat, { body: { question: 'Why?' } })).body.code).toBe('no_document');
});

test('normalises whatever the model returns into a fixed shape', () => {
  const out = groq.normalizeAnalysis({
    summary: '  Fine. ',
    pass1: { clauses: [{ clause: 'A', risk: 'उच्च' }, { clause: '', risk: 'Low' }, 'junk', { clause: 'B', risk: 'weird' }] },
    pass4: { scamScore: '140%', redFlags: null },
    rightsCard: 'nope',
  });
  expect(out.summary).toBe('Fine.');
  expect(out.pass1.clauses).toEqual([
    { clause: 'A', risk: 'High', explanation: '' },
    { clause: 'B', risk: 'Medium', explanation: '' },
  ]);
  expect(out.pass2.deviations).toEqual([]);
  expect(out.pass4).toEqual({ redFlags: [], scamScore: 100 });
  expect(out.rightsCard).toEqual([]);
  expect(groq.normalizeAnalysis(null).pass3.laws).toEqual([]);
});

test('keyword classification is a modest guess', () => {
  const fir = groq.fallbackClassify('First Information Report lodged at the police station against the accused');
  expect(fir.case_type).toBe('Criminal Law');
  expect(parseFloat(fir.confidence)).toBeLessThanOrEqual(75);
  expect(groq.fallbackClassify('nothing relevant').case_type).toBe('Civil Law');
});
