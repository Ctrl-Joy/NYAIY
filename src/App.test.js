import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as api from './lib/api';

jest.mock('./lib/api', () => ({
  AppError: class AppError extends Error {
    constructor(code, message) {
      super(message || code);
      this.code = code;
    }
  },
  checkHealth: jest.fn(),
  classifyDocument: jest.fn(),
  analyseDocument: jest.fn(),
  askQuestion: jest.fn(),
}));

const analysis = {
  summary: 'A one-sided rental agreement.',
  pass1: { clauses: [{ clause: 'Deposit is non-refundable.', risk: 'High', explanation: 'Unfair to the tenant.' }] },
  pass2: { deviations: [] },
  pass3: { laws: [{ clause: 'Deposit', law: 'Model Tenancy Act, 2021', section: 'Section 11', implication: 'Capped.' }] },
  pass4: { redFlags: [], scamScore: 45 },
  rightsCard: [],
  negotiationClauses: [],
};

const sample =
  'This rental agreement is made between the landlord and the tenant for the flat at Indiranagar, Bengaluru.';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.scrollTo = jest.fn();
  api.checkHealth.mockResolvedValue({ reachable: true, configured: true });
  api.classifyDocument.mockResolvedValue({ case_type: 'Civil Law', confidence: '91.00' });
  api.analyseDocument.mockResolvedValue({ analysis, analysedChars: sample.length, truncated: false });
  api.askQuestion.mockResolvedValue('The deposit should be refundable.');
});

test('shows the start screen with the not-legal-advice notice', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/before you sign/i);
  expect(screen.getByText(/not legal advice/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /analyse document/i })).toBeDisabled();
  await waitFor(() => expect(api.checkHealth).toHaveBeenCalled());
});

test('explains when the server has no API key', async () => {
  api.checkHealth.mockResolvedValue({ reachable: true, configured: false });
  render(<App />);
  expect(await screen.findByText(/GROQ_API_KEY/)).toBeInTheDocument();
});

test('analyses pasted text, shows the report and answers a question', async () => {
  render(<App />);
  userEvent.type(screen.getByLabelText(/document text/i), sample);
  userEvent.click(screen.getByRole('button', { name: /analyse document/i }));

  expect(await screen.findByText('A one-sided rental agreement.')).toBeInTheDocument();
  expect(api.analyseDocument).toHaveBeenCalledWith(sample, 'en', 'rental', expect.anything());
  expect(screen.getAllByText('High risk').length).toBeGreaterThan(0);
  expect(screen.getByText('Deposit is non-refundable.')).toBeInTheDocument();
  expect(screen.getByText(/nothing unusual found/i)).toBeInTheDocument();

  userEvent.type(screen.getByLabelText(/ask a question/i), 'Is the deposit refundable?{enter}');
  expect(await screen.findByText('The deposit should be refundable.')).toBeInTheDocument();
  expect(api.askQuestion).toHaveBeenCalledWith(
    expect.objectContaining({ question: 'Is the deposit refundable?', history: [] })
  );

  userEvent.click(screen.getByRole('button', { name: /new document/i }));
  expect(await screen.findByText(/earlier in this session/i)).toBeInTheDocument();
});

test('returns to the start screen with a message when the analysis fails', async () => {
  api.analyseDocument.mockRejectedValue(
    Object.assign(new Error('The AI service is busy right now.'), { code: 'rate_limited' })
  );
  render(<App />);
  userEvent.type(screen.getByLabelText(/document text/i), sample);
  userEvent.click(screen.getByRole('button', { name: /analyse document/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent('The AI service is busy right now.');
  expect(screen.getByLabelText(/document text/i)).toHaveValue(sample);
});

test('rejects unsupported files before anything is sent', async () => {
  const { container } = render(<App />);
  const input = container.querySelector('input[type="file"]');
  userEvent.upload(input, new File(['x'], 'archive.zip', { type: 'application/zip' }), { applyAccept: false });
  expect(await screen.findByRole('alert')).toHaveTextContent(/not supported/i);
  expect(api.classifyDocument).not.toHaveBeenCalled();
});
