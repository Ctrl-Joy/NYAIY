const { GROQ_KEY, HF_TOKEN, setCors } = require('./_groq');

module.exports = (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.json({
    ok: true,
    groqConfigured: Boolean(GROQ_KEY),
    hfConfigured: Boolean(HF_TOKEN),
  });
};
