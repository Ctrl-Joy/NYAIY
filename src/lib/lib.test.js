import { detectDocType } from './docTypes';
import { reportToText } from './exportReport';
import { fileKind, validateFile } from './extract';
import { overallRisk } from './risk';

jest.mock('./api', () => ({ AppError: class AppError extends Error {} }));

test('detects common document types', () => {
  expect(detectDocType('The tenant shall pay rent to the landlord')).toBe('rental');
  expect(detectDocType('The employee will receive a salary')).toBe('employment');
  expect(detectDocType('anything', 'FIR_copy.pdf')).toBe('fir');
  expect(detectDocType('Some unrelated words')).toBe('general');
});

test('overall risk follows the score and the riskiest finding', () => {
  const base = { pass1: { clauses: [] }, pass2: { deviations: [] }, pass4: { scamScore: 0 } };
  expect(overallRisk(base)).toEqual({ level: 'Low', score: 0 });
  expect(overallRisk({ ...base, pass4: { scamScore: 35 } }).level).toBe('Medium');
  expect(overallRisk({ ...base, pass1: { clauses: [{ risk: 'High' }] } }).level).toBe('High');
  expect(overallRisk({ ...base, pass2: { deviations: [{ severity: 'Medium' }] } }).level).toBe('Medium');
});

test('validates files by type and size', () => {
  const file = (name, type, size = 10) => Object.defineProperty(new File(['x'], name, { type }), 'size', { value: size });
  expect(fileKind(file('a.PDF', ''))).toBe('pdf');
  expect(fileKind(file('photo', 'image/jpeg'))).toBe('image');
  expect(validateFile(file('a.zip', 'application/zip'))).toBe('errFileType');
  expect(validateFile(file('a.pdf', 'application/pdf', 16 * 1024 * 1024))).toBe('errFileSize');
  expect(validateFile(file('a.txt', 'text/plain', 0))).toBe('errFileEmpty');
  expect(validateFile(file('a.png', 'image/png'))).toBeNull();
});

test('plain-text export contains every section and the notice', () => {
  const text = reportToText({
    name: 'lease.pdf',
    lang: 'en',
    docType: 'rental',
    caseType: 'Civil Law',
    confidence: 91,
    createdAt: '2026-11-12T10:00:00.000Z',
    risk: { level: 'High', score: 45 },
    analysis: {
      summary: 'Summary here.',
      pass1: { clauses: [{ clause: 'Clause A', risk: 'High', explanation: 'Because.' }] },
      pass2: { deviations: [] },
      pass3: { laws: [] },
      pass4: { redFlags: [], scamScore: 45 },
      rightsCard: [],
      negotiationClauses: [{ issue: 'Deposit', original: 'Old', suggested: 'New' }],
    },
  });
  expect(text).toContain('NyAIy: lease.pdf');
  expect(text).toContain('1. [High] Clause A');
  expect(text).toContain('Ask for: New');
  expect(text).toContain('No red flags found.');
  expect(text).toMatch(/not legal advice/i);
});
