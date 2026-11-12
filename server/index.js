/**
 * Local API server. It mounts the same handlers that Vercel runs from /api,
 * so local development and production behave identically.
 */
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const { groqKey } = require('../api/_groq');

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 3001;

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((err, _req, res, next) => {
  if (!err) return next();
  const tooBig = err.type === 'entity.too.large';
  return res
    .status(tooBig ? 413 : 400)
    .json({
      error: tooBig ? 'The document is too large to send.' : 'Invalid request body.',
      code: tooBig ? 'too_large' : 'bad_request',
    });
});

app.all('/api/health', require('../api/health'));
app.all('/api/classify', require('../api/classify'));
app.all('/api/analyze', require('../api/analyze'));
app.all('/api/chat', require('../api/chat'));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found', code: 'not_found' }));

// Serve the production build when it exists (npm run build && npm run start:prod).
const buildPath = path.join(__dirname, '..', 'build');
if (fs.existsSync(path.join(buildPath, 'index.html'))) {
  app.use(express.static(buildPath));
  app.get('*', (_req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`NyAIy API on http://localhost:${PORT}`);
  if (!groqKey()) console.warn('GROQ_API_KEY is not set. AI features are disabled until it is.');
});
