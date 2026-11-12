# NyAIy — your legal copilot

NyAIy reads an Indian legal document and explains it in plain language: the clauses to question, where it departs from the norm, the laws that apply, red flags, your rights and wording to negotiate. You can then ask follow-up questions about the document. English and Hindi.

Informational only — **not legal advice**.

Live: https://nyaiy.vercel.app

## How it works

1. **Add a document.** Paste text, attach a PDF, image (PNG, JPG, WebP) or `.txt` file up to 15 MB, drop a file on the page, dictate, or take a photo on a phone.
2. **Read the analysis.** Text is extracted in the browser (pdf.js, with Tesseract OCR for scans and photos), then sent to the API, which classifies the document and asks the model for a structured analysis.
3. **Ask questions.** Answers are based only on the document's text.

Reports can be copied as text or downloaded as a PDF. Reports from the current browser tab are listed on the start screen; they live in `sessionStorage` only and disappear when the tab closes. There are no accounts and no database.

Long documents: the first 8,000 characters are analysed, and the report says so when a document was cut.

## Setup

```bash
cp .env.example .env      # then add your Groq API key
npm install
npm run dev               # API on :3001, app on :3000
```

Get a key at [console.groq.com](https://console.groq.com/). Open http://localhost:3000.

No key? `npm run dev:stub` runs the whole app against a local stand-in for the AI (`server/dev-stub.js`) that returns canned answers, which is enough to try every screen.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | API server and React dev server together |
| `npm run dev:stub` | Same, with the AI replaced by the local stub |
| `npm run server` | API only |
| `npm run client` | React dev server only |
| `npm run build` | Production build into `build/` |
| `npm run start:prod` | Serve `build/` and the API from one port |
| `npm test` | Unit and component tests |

## Environment

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Required. Server side only. |
| `HF_API_TOKEN` | Optional. Enables the NyaiyBERT classifier on Hugging Face; without it the Groq model classifies. |
| `API_PORT` | Port for the local API server (default 3001). |
| `PORT` | Port for the React dev server (default 3000). |
| `CLIENT_ORIGIN` | Optional. Allow one other origin to call the API (CORS). Not needed when the app and API share an origin. |
| `GROQ_SSL_VERIFY` | Set to `false` only to work around local certificate problems. Certificates are verified by default. |

The key never reaches the browser: do not put it in a `REACT_APP_*` variable. `.env` is gitignored.

## Deploying to Vercel

The React build is served statically and the files in `api/` run as serverless functions. Set `GROQ_API_KEY` (and optionally `HF_API_TOKEN`) in the project's environment variables. `GET /api/health` reports whether the key is configured.

## API

The local Express server mounts the same handlers that Vercel runs, so both behave identically.

| Route | Body | Returns |
|-------|------|---------|
| `GET /api/health` | — | `{ ok, groqConfigured, hfConfigured }` |
| `POST /api/classify` | `{ text, docTypeHint }` | `{ case_type, confidence, source }` |
| `POST /api/analyze` | `{ text, lang, docType }` | `{ analysis, analysedChars, truncated }` |
| `POST /api/chat` | `{ question, documentText, lang, history }` | `{ answer }` |

Errors are JSON, `{ error, code }`, with a matching status: `400` bad input, `429` rate limited, `502` AI error, `503` key missing, `504` timeout.

## Project layout

```
api/            Vercel functions; _groq.js holds the shared logic
server/         Local Express server and the development AI stub
src/App.js      App state and the add → analyse → report flow
src/components  Start, Composer, Progress, Report, AskPanel, Header
src/lib         API client, text extraction, export, history, risk
src/i18n.js     English and Hindi interface strings
```

## Notes

- Hindi reports are exported through the browser's print dialog (choose "Save as PDF"), because the built-in PDF fonts are Latin only.
- Voice input and "Listen" depend on browser support and are hidden where unavailable.
- On Windows with Node 22+, `npm run server` passes `--use-system-ca` so calls to Groq use the system certificates.

## Stack

React (Create React App), Tailwind CSS, pdf.js, Tesseract.js, jsPDF, Express, Groq (`llama-3.3-70b-versatile` with fallbacks).
