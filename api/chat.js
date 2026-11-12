const {
  ApiError, route, sanitizeText, pickLang, answerQuestion, MAX_QUESTION_CHARS,
} = require('./_groq');

module.exports = route('POST', async (body) => {
  const documentText = sanitizeText(body.documentText);
  const question = sanitizeText(body.question).slice(0, MAX_QUESTION_CHARS);
  if (!question) throw new ApiError(400, 'no_question', 'Type a question first.');
  if (!documentText) throw new ApiError(400, 'no_document', 'There is no document to ask about.');
  const answer = await answerQuestion({
    documentText,
    question,
    lang: pickLang(body.lang),
    history: body.history,
  });
  return { answer: String(answer).trim() };
});
