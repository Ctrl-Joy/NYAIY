const { sanitizeText, fourPassAnalysis, setCors } = require('./_groq');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const text = sanitizeText(req.body?.text);
    const { lang = 'en', docType = 'general' } = req.body || {};
    if (text.length < 50) {
      return res.status(400).json({ error: 'Document text too short for analysis.' });
    }
    const analysis = await fourPassAnalysis(text, lang, docType);
    res.json({ analysis });
  } catch (err) {
    console.error('analyze:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
};
