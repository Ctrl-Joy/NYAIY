import { render, screen } from '@testing-library/react';

const mockCheckApiHealth = jest.fn();

jest.mock('./generatePDF', () => ({ generatePDF: jest.fn() }));

jest.mock('./api', () => ({
  checkApiHealth: (...args) => mockCheckApiHealth(...args),
  translations: {
    en: {
      title: 'NyAIy',
      tagline: 'Your Legal Copilot',
      upload: 'Upload Legal Document',
      analyze: 'Analyze Document',
      analyzing: 'Analyzing...',
      cancel: 'Cancel',
      placeholder: 'Or paste legal text here...',
      voiceInput: 'Voice Input',
      listening: 'Listening...',
      dragdrop: 'Drag & drop PDF here or',
      browse: 'Browse File',
      caseType: 'Case Type',
      confidence: 'Confidence',
      scamScore: 'Scam Score',
      confidenceHelp: '',
      riskHelp: '',
      scamHelp: '',
      riskLevel: 'Risk Level',
      disclaimerTitle: 'Important notice',
      disclaimerBody: 'Not legal advice.',
      disclaimerAccept: 'Continue',
      apiNotConfigured: 'API not configured',
      pass1: '', pass2: '', pass3: '', pass4: '',
      rights: '', negotiation: '', chatbot: '',
      download: '', askQuestion: '', send: '',
      high: '', medium: '', low: '',
    },
    hi: {
      title: 'न्याय',
      tagline: '',
      upload: '', analyze: '', analyzing: '', cancel: '',
      placeholder: '', voiceInput: '', listening: '',
      dragdrop: '', browse: '', caseType: '', confidence: '',
      scamScore: '', confidenceHelp: '', riskHelp: '', scamHelp: '',
      riskLevel: '', disclaimerTitle: '', disclaimerBody: '',
      disclaimerAccept: '', apiNotConfigured: '',
      pass1: '', pass2: '', pass3: '', pass4: '',
      rights: '', negotiation: '', chatbot: '',
      download: '', askQuestion: '', send: '',
      high: '', medium: '', low: '',
    },
  },
  classifyDocument: jest.fn(),
  fourPassAnalysis: jest.fn(),
  askChatbot: jest.fn(),
  getPdfTextSample: jest.fn(),
  computeRiskLevel: jest.fn(() => ({ riskLevel: 'Low', scamScore: 0 })),
}));

import App from './App';

beforeEach(() => {
  mockCheckApiHealth.mockResolvedValue({ ok: true, groqConfigured: true });
});

test('renders NyAIy heading', async () => {
  render(<App />);
  expect(await screen.findByText('NyAIy')).toBeInTheDocument();
});
