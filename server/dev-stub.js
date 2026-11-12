/**
 * Development-only stand-in for the Groq API.
 *
 * Loaded with `node -r ./server/dev-stub.js server/index.js` (see `npm run server:stub`).
 * It intercepts outgoing HTTPS requests to api.groq.com and answers them locally with
 * canned content, so the whole flow can be exercised without a GROQ_API_KEY.
 * It is never imported by the app, the Express server or the Vercel functions.
 *
 * Put one of these markers in the document text to simulate a failure:
 *   [[stub:fail]]       Groq returns a 500
 *   [[stub:ratelimit]]  every model is rate limited (429)
 *   [[stub:badjson]]    the model replies with something that is not JSON
 *   [[stub:slow]]       the reply takes 20 seconds
 *   [[stub:hang]]       the reply never arrives
 */
const https = require('https');
const { EventEmitter } = require('events');

if (!process.env.GROQ_API_KEY) process.env.GROQ_API_KEY = 'stub-key';
if (!process.env.STUB_SILENT) console.log('[stub] Groq calls are answered locally. No real AI is used.');

const DELAY = Number(process.env.STUB_DELAY_MS || 1200);

const analysis = (hi) => ({
  pass1: {
    title: 'Clause Extraction & Risk Scoring',
    clauses: [
      {
        clause: hi
          ? 'सुरक्षा जमा राशि ₹1,50,000 किसी भी परिस्थिति में वापस नहीं की जाएगी।'
          : 'The security deposit of Rs. 1,50,000 is non-refundable under any circumstances.',
        risk: 'High',
        explanation: hi
          ? 'गैर-वापसी योग्य जमा राशि किरायेदार के लिए अनुचित है और मॉडल किरायेदारी अधिनियम के विपरीत है।'
          : 'A non-refundable deposit is one-sided. The Model Tenancy Act expects the deposit to be returned at the end of the tenancy, less lawful deductions.',
      },
      {
        clause: hi
          ? 'मकान मालिक बिना सूचना के किसी भी समय परिसर में प्रवेश कर सकता है।'
          : 'The landlord may enter and inspect the premises at any time without prior notice.',
        risk: 'High',
        explanation: hi
          ? 'बिना सूचना प्रवेश किरायेदार की निजता का उल्लंघन है।'
          : 'Entry without notice undermines the tenant\'s right to peaceful possession. 24 hours written notice is the norm.',
      },
      {
        clause: hi
          ? 'किराया हर वर्ष 15% बढ़ाया जाएगा।'
          : 'Rent shall increase by 15% every year.',
        risk: 'Medium',
        explanation: hi
          ? 'वार्षिक वृद्धि बाज़ार के सामान्य 5-10% से अधिक है।'
          : 'Annual escalation of 15% is above the 5 to 10% usually seen in Indian residential leases.',
      },
      {
        clause: hi
          ? 'किराया हर महीने की 5 तारीख तक देय है।'
          : 'Rent is payable on or before the 5th day of each month.',
        risk: 'Low',
        explanation: hi ? 'यह एक सामान्य शर्त है।' : 'A standard payment term.',
      },
    ],
  },
  pass2: {
    title: 'Deviation Analysis',
    deviations: [
      {
        issue: hi ? 'अत्यधिक सुरक्षा जमा' : 'Excessive security deposit',
        found: hi ? 'पांच महीने के किराये के बराबर जमा' : 'Deposit equal to five months of rent',
        standard: hi
          ? 'मॉडल किरायेदारी अधिनियम 2021: आवासीय परिसर के लिए अधिकतम दो महीने'
          : 'Model Tenancy Act 2021 caps residential deposits at two months of rent',
        severity: 'High',
      },
      {
        issue: hi ? 'नोटिस अवधि में असमानता' : 'Unequal notice period',
        found: hi ? 'किरायेदार के लिए 90 दिन, मकान मालिक के लिए 15 दिन' : 'Tenant must give 90 days, landlord only 15 days',
        standard: hi ? 'दोनों पक्षों के लिए समान नोटिस अवधि' : 'Equal notice for both parties, commonly 30 days',
        severity: 'Medium',
      },
    ],
  },
  pass3: {
    title: 'Indian Law Reference Mapping',
    laws: [
      {
        clause: hi ? 'सुरक्षा जमा' : 'Security deposit',
        law: 'Model Tenancy Act, 2021',
        section: 'Section 11',
        implication: hi
          ? 'आवासीय परिसर के लिए जमा दो महीने के किराये से अधिक नहीं हो सकती।'
          : 'Deposit for residential premises cannot exceed two months of rent and must be refunded on vacating.',
      },
      {
        clause: hi ? 'प्रवेश का अधिकार' : 'Right of entry',
        law: 'Model Tenancy Act, 2021',
        section: 'Section 17',
        implication: hi
          ? 'मकान मालिक को प्रवेश से कम से कम 24 घंटे पहले सूचना देनी होगी।'
          : 'The landlord must give at least 24 hours prior notice before entering.',
      },
      {
        clause: hi ? 'अनुचित शर्तें' : 'Unfair terms',
        law: 'Indian Contract Act, 1872',
        section: 'Section 23',
        implication: hi
          ? 'लोक नीति के विरुद्ध शर्तें शून्य हो सकती हैं।'
          : 'Terms opposed to public policy may be void and unenforceable.',
      },
    ],
  },
  pass4: {
    title: 'Scam Pattern Detection',
    redFlags: [
      {
        pattern: hi ? 'गैर-वापसी योग्य जमा' : 'Non-refundable deposit',
        found: hi ? '"किसी भी परिस्थिति में वापस नहीं"' : '"non-refundable under any circumstances"',
        warning: hi
          ? 'यह जमा राशि हड़पने का सामान्य तरीका है।'
          : 'A common way to keep the deposit regardless of the condition of the flat.',
      },
    ],
    scamScore: '45',
  },
  rightsCard: [
    {
      right: hi ? 'जमा राशि की वापसी' : 'Refund of your deposit',
      description: hi
        ? 'परिसर खाली करने पर आपको जमा राशि वापस पाने का अधिकार है।'
        : 'You are entitled to get the deposit back when you vacate, less documented damages.',
      law: 'Model Tenancy Act, 2021',
    },
    {
      right: hi ? 'शांतिपूर्ण कब्ज़ा' : 'Peaceful possession',
      description: hi
        ? 'मकान मालिक बिना सूचना के प्रवेश नहीं कर सकता।'
        : 'The landlord cannot enter without notice or cut off essential services.',
      law: 'Model Tenancy Act, 2021',
    },
  ],
  negotiationClauses: [
    {
      issue: hi ? 'सुरक्षा जमा' : 'Security deposit',
      original: hi
        ? 'सुरक्षा जमा किसी भी परिस्थिति में वापस नहीं की जाएगी।'
        : 'The security deposit is non-refundable under any circumstances.',
      suggested: hi
        ? 'सुरक्षा जमा दो महीने के किराये तक सीमित होगी और खाली करने के 30 दिनों के भीतर वापस की जाएगी।'
        : 'The security deposit shall be limited to two months of rent and refunded within 30 days of vacating, less documented deductions.',
    },
    {
      issue: hi ? 'प्रवेश की सूचना' : 'Notice of entry',
      original: hi
        ? 'मकान मालिक किसी भी समय प्रवेश कर सकता है।'
        : 'The landlord may enter at any time without notice.',
      suggested: hi
        ? 'मकान मालिक 24 घंटे की लिखित सूचना देकर उचित समय पर प्रवेश कर सकता है।'
        : 'The landlord may enter at a reasonable hour after giving 24 hours written notice.',
    },
  ],
  summary: hi
    ? 'यह एक आवासीय किराया समझौता है जो मकान मालिक के पक्ष में झुका हुआ है। जमा राशि गैर-वापसी योग्य है और प्रवेश के लिए कोई सूचना आवश्यक नहीं है। हस्ताक्षर करने से पहले इन शर्तों पर बातचीत करें।'
    : 'This is a residential rental agreement that leans heavily towards the landlord. The deposit is non-refundable and far above the legal cap, and the landlord may enter without notice. Negotiate these terms before signing.',
});

const reply = (body) => {
  const all = (body.messages || []).map((m) => m.content).join('\n');
  const hi = /Hindi/.test(all);
  if (all.includes('Classify this Indian legal document')) {
    return JSON.stringify({ case_type: 'Civil Law', confidence: '91.00' });
  }
  if (all.includes('"pass1"')) {
    if (all.includes('[[stub:badjson]]')) return 'I am sorry, I cannot produce that.';
    return '```json\n' + JSON.stringify(analysis(hi)) + '\n```';
  }
  const q = body.messages[body.messages.length - 1].content;
  return hi
    ? `(स्टब उत्तर) आपने पूछा: "${q}"। दस्तावेज़ के अनुसार जमा राशि वापस नहीं की जाएगी, जो मॉडल किरायेदारी अधिनियम के अनुरूप नहीं है।`
    : `(Stub answer) You asked: "${q}". According to the document the deposit is non-refundable, which is out of line with the Model Tenancy Act, 2021. Ask the landlord to cap it at two months of rent and to refund it within 30 days of vacating.`;
};

const realRequest = https.request;
https.request = function patched(options, cb) {
  const host = options && (options.hostname || options.host);
  if (host !== 'api.groq.com') return realRequest.apply(https, arguments);

  const req = new EventEmitter();
  let raw = '';
  let timer;
  req.write = (chunk) => { raw += chunk; };
  req.destroy = () => clearTimeout(timer);
  req.end = () => {
    let body = {};
    try { body = JSON.parse(raw); } catch { /* ignore */ }
    const all = (body.messages || []).map((m) => m.content).join('\n');
    let status = 200;
    let payload;
    if (all.includes('[[stub:hang]]')) return;
    if (all.includes('[[stub:fail]]')) {
      status = 500;
      payload = { error: { message: 'Internal server error (simulated)' } };
    } else if (all.includes('[[stub:ratelimit]]')) {
      status = 429;
      payload = { error: { message: 'Rate limit reached (simulated)' } };
    } else {
      payload = { choices: [{ message: { role: 'assistant', content: reply(body) } }] };
    }
    const wait = all.includes('[[stub:slow]]') ? 20000 : DELAY;
    timer = setTimeout(() => {
      const res = new EventEmitter();
      res.statusCode = status;
      cb(res);
      res.emit('data', JSON.stringify(payload));
      res.emit('end');
    }, wait);
  };
  return req;
};
