const { sanitizeText, classifyDocument, setCors } = require('./_groq');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const text = sanitizeText(req.body?.text);
    const docTypeHint = req.body?.docTypeHint || 'general';
    if (text.length < 20) {
      return res.status(400).json({ error: 'Document text too short to classify.' });
    }
    const result = await classifyDocument(text, docTypeHint);
    res.json(result);
  } catch (err) {
    console.error('classify:', err);
    res.status(500).json({ error: err.message || 'Classification failed' });
  }
};
