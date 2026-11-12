export const DOC_TYPES = [
  'rental', 'employment', 'nda', 'fir', 'court', 'property', 'constitution', 'general',
];

const has = (t, words) => words.some((w) => t.includes(w));

/** Rough document type from its text. Sent to the server as a hint for the analysis prompt. */
export const detectDocType = (text = '', fileName = '') => {
  const name = fileName.toLowerCase();
  if (/(^|[^a-z])fir([^a-z]|$)|police/.test(name)) return 'fir';
  if (/_vs_|_v_|versus|judg(e)?ment/.test(name)) return 'court';

  const t = text.toLowerCase();
  if (/\bfir\b/.test(t) || has(t, ['first information report', 'police station'])) return 'fir';
  if (has(t, ['tenant', 'landlord', 'lease', 'rental agreement', 'किराया', 'किरायेदार'])) return 'rental';
  if (has(t, ['employment', 'employee', 'employer', 'salary', 'रोजगार', 'वेतन'])) return 'employment';
  if (has(t, ['non-disclosure', 'confidential information']) || /\bnda\b/.test(t)) return 'nda';
  if (has(t, ['supreme court', 'high court', 'judgment', 'petitioner', 'appellant']) || /\bvs?\.\s/.test(t)) {
    return 'court';
  }
  if (has(t, ['sale deed', 'property', 'ownership', 'conveyance'])) return 'property';
  if (has(t, ['constitution', 'article 21', 'fundamental rights'])) return 'constitution';
  return 'general';
};

export const SAMPLE_DOCUMENT = `RESIDENTIAL RENTAL AGREEMENT

This Rental Agreement is made at Bengaluru on 1 October 2026 between Mr. Ramesh Kumar (the Landlord) and Ms. Anita Sharma (the Tenant).

1. The Landlord lets the flat at 14, 2nd Cross, Indiranagar, Bengaluru to the Tenant for a period of eleven months at a monthly rent of Rs. 30,000, payable on or before the 5th day of each month.

2. The Tenant has paid a security deposit of Rs. 1,50,000, which is non-refundable under any circumstances.

3. The Landlord may enter and inspect the premises at any time without prior notice.

4. Rent shall increase by 15% every year.

5. The Tenant must give 90 days notice to vacate. The Landlord may terminate this agreement by giving 15 days notice.

6. The Tenant waives the right to approach any court or rent authority in respect of this agreement.

Signed by both parties in the presence of two witnesses.`;
