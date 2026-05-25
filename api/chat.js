const { sanitizeText, wrapDocument, groqChat, setCors, MAX_QUESTION_CHARS } = require('./_groq');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const documentText = sanitizeText(req.body?.documentText);
    const question = sanitizeText(req.body?.question).slice(0, MAX_QUESTION_CHARS);
    const { lang = 'en', history = [] } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: 'Question is required.' });
    }
    const langInstruction = lang === 'hi'
      ? 'Respond in grammatically correct, formal legal Hindi. Crucial: Translate "Civil Law" as "नागरिक कानून" (never "दीवानी कानून").'
      : 'Respond in English.';
    const messages = [
      {
        role: 'system',
        content: `You are NyAIy, an Indian legal information assistant. ${langInstruction}
Answer only about the document below. This is not legal advice.
${wrapDocument(documentText.slice(0, 2000))}`,
      },
      ...history.slice(-6).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: String(msg.text || '').slice(0, 1000),
      })),
      { role: 'user', content: question },
    ];
    const answer = await groqChat(messages, 500);
    res.json({ answer });
  } catch (err) {
    console.error('chat:', err);
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
};
