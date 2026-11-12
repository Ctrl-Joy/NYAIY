const {
  ApiError, route, sanitizeText, pickDocType, classifyDocument, MIN_DOC_CHARS,
} = require('./_groq');

module.exports = route('POST', async (body) => {
  const text = sanitizeText(body.text);
  if (text.length < MIN_DOC_CHARS) {
    throw new ApiError(400, 'too_short', 'The document is too short to analyse. Add at least a few sentences.');
  }
  return classifyDocument(text, pickDocType(body.docTypeHint));
});
