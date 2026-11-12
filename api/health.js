const { route, groqKey, hfToken } = require('./_groq');

module.exports = route('GET', async () => ({
  ok: true,
  groqConfigured: Boolean(groqKey()),
  hfConfigured: Boolean(hfToken()),
}));
