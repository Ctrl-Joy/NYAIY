# NyAIy — Your Legal Copilot

AI-assisted Indian legal document analysis (informational only — **not legal advice**).

## Setup

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```
2. Add your [Groq API key](https://console.groq.com/) to `.env`:
   ```
   GROQ_API_KEY=gsk_...
   ```
3. Install and run (API server + React client):
   ```bash
   npm install
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Express API on :3001 + CRA on :3000 |
| `npm run server` | API only |
| `npm run client` | Frontend only (needs server for AI) |
| `npm run build` | Production React build |
| `npm run start:prod` | Serve `build/` + API (set `NODE_ENV=production` in `.env`) |

## Security

- **Never** put `GROQ_API_KEY` in `REACT_APP_*` variables — keys stay on the server.
- `.env` is gitignored; do not commit secrets.

## Optional

- `HF_API_TOKEN` — Hugging Face token for NyaiyBERT classification (rate limits).

## Troubleshooting

**"fetch failed" when analyzing**

1. Use `npm run dev` (not `npm start` alone) so the API server runs on port 3001.
2. On Windows with Node 22+, SSL errors to Groq are fixed by `--use-system-ca` (already in `npm run server`). If you still see certificate errors, add to `.env`:
   ```
   NODE_OPTIONS=--use-system-ca
   ```
3. Restart the dev terminal after changing `.env`.

## Stack

- React, Tailwind, pdf.js, Tesseract (OCR fallback)
- Express proxy for Groq + classification
- NyAIyBERT (Hugging Face) + Groq `llama-3.3-70b-versatile`
