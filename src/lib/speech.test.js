import { pickVoice, prepareForSpeech, splitForSpeech } from './speech';

test('money and Indian digit grouping are read as amounts', () => {
  expect(prepareForSpeech('A deposit of Rs. 1,50,000 and rent of ₹30,000/- per month.')).toBe(
    'A deposit of 150000 rupees and rent of 30000 rupees per month.'
  );
  expect(prepareForSpeech('Rs 2.5 lakh penalty, INR 500 fee')).toBe('2.5 lakh rupees penalty, 500 rupees fee');
  expect(prepareForSpeech('जमा राशि ₹1,50,000 है।', 'hi')).toBe('जमा राशि 150000 रुपये है।');
});

test('legal shorthand, scores and symbols are spelled out', () => {
  expect(prepareForSpeech('Charged u/s 420 IPC, see Sec. 11(2)(a) & Art. 21.')).toBe(
    'Charged under section 420 I P C, see Section 11, 2, a, and Article 21.'
  );
  expect(prepareForSpeech('Red-flag score 45/100; rent rises 5-10% (yearly).')).toBe(
    'Red-flag score 45 out of 100; rent rises 5 to 10 percent, yearly.'
  );
  expect(prepareForSpeech('Kumar vs. Sharma, the “non-refundable” **deposit** — unfair.')).toBe(
    'Kumar versus Sharma, the non-refundable deposit, unfair.'
  );
  expect(prepareForSpeech('धारा 11 के अनुसार 45/100 और 15%', 'hi')).toBe('धारा 11 के अनुसार 45 में से 100 और 15 प्रतिशत');
});

test('long text is split into short pieces at sentence and comma boundaries', () => {
  const parts = splitForSpeech(`First sentence. Second one! ${'word, '.repeat(60)}end. तीसरा वाक्य।`);
  expect(parts[0]).toBe('First sentence.');
  expect(parts[1]).toBe('Second one!');
  expect(parts[parts.length - 1]).toBe('तीसरा वाक्य।');
  expect(Math.max(...parts.map((p) => p.length))).toBeLessThanOrEqual(180);
});

test('a voice is only chosen when it matches the language', () => {
  const voices = [
    { name: 'Microsoft David', lang: 'en-US', localService: true },
    { name: 'Google UK English', lang: 'en-GB', localService: false },
    { name: 'Microsoft Heera', lang: 'en_IN', localService: true },
  ];
  expect(pickVoice(voices, 'en').name).toBe('Microsoft Heera');
  expect(pickVoice(voices, 'hi')).toBeNull();
  expect(pickVoice([...voices, { name: 'Google हिन्दी', lang: 'hi-IN' }], 'hi').name).toBe('Google हिन्दी');
});
