import jsPDF from 'jspdf';

export const generatePDF = async (data) => {
  const doc = new jsPDF();
  const {
    fileName, caseType, confidence,
    riskLevel, analysis, timestamp, lang, scamScore
  } = data;

  const isHi = lang === 'hi';
  const fontFamily = isHi ? 'NotoSansDevanagari' : 'helvetica';

  if (isHi) {
    try {
      // Fetch the Devanagari font from jsDelivr CDN
      const fontUrl = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf';
      const res = await fetch(fontUrl);
      const arrayBuffer = await res.arrayBuffer();
      
      // Convert ArrayBuffer to Base64
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Font = window.btoa(binary);
      
      // Register font in VFS for both normal and bold styles to prevent fallback crashes
      doc.addFileToVFS('NotoSansDevanagari.ttf', base64Font);
      doc.addFont('NotoSansDevanagari.ttf', 'NotoSansDevanagari', 'normal');
      doc.addFont('NotoSansDevanagari.ttf', 'NotoSansDevanagari', 'bold');
      doc.setFont('NotoSansDevanagari', 'normal');
    } catch (err) {
      console.warn('Failed to load Noto Sans Devanagari font, falling back to helvetica:', err);
      doc.setFont('helvetica', 'normal');
    }
  } else {
    doc.setFont('helvetica', 'normal');
  }

  // ── Header ──────────────────────────────
  doc.setFillColor(13, 27, 62);
  doc.rect(0, 0, 210, 45, 'F');
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(28);
  doc.setFont(fontFamily, 'bold');
  doc.text('NyAIy', 105, 20, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont(fontFamily, 'normal');
  doc.text(isHi ? 'आपका कानूनी सहायक' : 'Your Legal Copilot', 105, 30, { align: 'center' });
  doc.setFontSize(9);
  doc.text(isHi ? 'एआई कानूनी विश्लेषण रिपोर्ट' : 'AI Legal Analysis Report', 105, 38, { align: 'center' });

  // ── Document Info ────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont(fontFamily, 'normal');
  doc.text(isHi ? `दस्तावेज़ : ${fileName}` : `Document : ${fileName}`, 15, 55);
  doc.text(isHi ? `दिनांक   : ${timestamp}` : `Date     : ${timestamp}`, 15, 62);
  doc.text(isHi ? `NyAIy एआई द्वारा विश्लेषित` : `Analyzed by NyAIy AI`, 15, 69);

  // ── Divider ──────────────────────────────
  doc.setDrawColor(13, 27, 62);
  doc.setLineWidth(0.5);
  doc.line(15, 74, 195, 74);

  // ── Classification ───────────────────────
  doc.setFontSize(14);
  doc.setFont(fontFamily, 'bold');
  doc.setTextColor(13, 27, 62);
  doc.text(isHi ? 'वर्गीकरण के परिणाम' : 'Classification Results', 15, 83);

  doc.setFont(fontFamily, 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(isHi ? `केस प्रकार    : ${caseType}` : `Case Type   : ${caseType}`, 15, 93);
  doc.text(isHi ? `सटीकता       : ${confidence}%` : `Confidence  : ${confidence}%`, 15, 101);
  doc.text(isHi ? `जोखिम स्तर   : ${riskLevel}` : `Risk Level  : ${riskLevel}`, 15, 109);

  // Risk badge
  const colors = {
    High:   [220, 53, 69],
    Medium: [255, 153, 0],
    Low:    [40, 167, 69],
    'उच्च जोखिम': [220, 53, 69],
    'मध्यम जोखिम': [255, 153, 0],
    'कम जोखिम': [40, 167, 69]
  };
  const [r, g, b] = colors[riskLevel] || [128, 128, 128];
  doc.setFillColor(r, g, b);
  doc.roundedRect(150, 103, 40, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(riskLevel.toUpperCase(), 170, 110, { align: 'center' });

  // ── Summary ──────────────────────────────
  doc.setDrawColor(13, 27, 62);
  doc.line(15, 118, 195, 118);
  doc.setTextColor(13, 27, 62);
  doc.setFontSize(14);
  doc.setFont(fontFamily, 'bold');
  doc.text(isHi ? 'सारांश' : 'Summary', 15, 127);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont(fontFamily, 'normal');
  const summaryLines = doc.splitTextToSize(
    analysis?.summary || (isHi ? 'विश्लेषण पूरा हुआ।' : 'Analysis complete.'), 180
  );
  doc.text(summaryLines, 15, 137);

  let y = 137 + summaryLines.length * 6 + 8;

  // ── Pass Results ─────────────────────────
  const passes = isHi ? [
    { title: 'चरण 1 — खंड निष्कर्षण और जोखिम स्कोरिंग', key: 'pass1' },
    { title: 'चरण 2 — विचलन विश्लेषण बनाम भारतीय मानक', key: 'pass2' },
    { title: 'चरण 3 — भारतीय कानून संदर्भ मैपिंग',        key: 'pass3' },
    { title: 'चरण 4 — धोखाधड़ी पैटर्न पहचान',     key: 'pass4' },
  ] : [
    { title: 'Pass 1 — Clause Extraction', key: 'pass1' },
    { title: 'Pass 2 — Deviation Analysis', key: 'pass2' },
    { title: 'Pass 3 — Law Mapping',        key: 'pass3' },
    { title: 'Pass 4 — Scam Detection',     key: 'pass4' },
  ];

  for (const pass of passes) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(13, 27, 62);
    doc.line(15, y, 195, y);
    y += 8;
    doc.setTextColor(13, 27, 62);
    doc.setFontSize(12);
    doc.setFont(fontFamily, 'bold');
    doc.text(pass.title, 15, y);
    y += 8;

    const passData = analysis?.[pass.key];
    if (passData) {
      const items = passData.clauses
        || passData.deviations
        || passData.laws
        || passData.redFlags
        || [];

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);

      for (const item of items.slice(0, 3)) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        if (pass.key === 'pass1') {
          // Pass 1: Clause, Risk, and Explanation
          const riskTrans = isHi ? `जोखिम: ${item.risk === 'High' ? 'उच्च' : item.risk === 'Medium' ? 'मध्यम' : 'कम'}` : `Risk: ${item.risk}`;
          const headLine = `• ${isHi ? 'खंड' : 'Clause'}: "${item.clause}" (${riskTrans})`;
          const explLine = `${isHi ? 'विवरण' : 'Explanation'}: ${item.explanation}`;
          
          doc.setFont(fontFamily, 'bold');
          const linesHead = doc.splitTextToSize(headLine, 175);
          doc.text(linesHead, 20, y);
          y += linesHead.length * 5;
          
          doc.setFont(fontFamily, 'normal');
          const linesExpl = doc.splitTextToSize(explLine, 170);
          doc.text(linesExpl, 25, y);
          y += linesExpl.length * 5 + 2;
        } 
        else if (pass.key === 'pass2') {
          // Pass 2: Deviation, Severity, Found, Standard
          const sevTrans = isHi ? `गंभीरता: ${item.severity === 'High' ? 'उच्च' : item.severity === 'Medium' ? 'मध्यम' : 'कम'}` : `Severity: ${item.severity}`;
          const headLine = `• ${isHi ? 'विचलन' : 'Issue'}: ${item.issue} (${sevTrans})`;
          const foundLine = `${isHi ? 'मिला' : 'Found'}: ${item.found}`;
          const stdLine = `${isHi ? 'मानक' : 'Standard'}: ${item.standard}`;
          
          doc.setFont(fontFamily, 'bold');
          const linesHead = doc.splitTextToSize(headLine, 175);
          doc.text(linesHead, 20, y);
          y += linesHead.length * 5;
          
          doc.setFont(fontFamily, 'normal');
          const linesFound = doc.splitTextToSize(foundLine, 170);
          doc.text(linesFound, 25, y);
          y += linesFound.length * 5;
          
          const linesStd = doc.splitTextToSize(stdLine, 170);
          doc.text(linesStd, 25, y);
          y += linesStd.length * 5 + 2;
        } 
        else if (pass.key === 'pass3') {
          // Pass 3: Law, Section, Implication
          const headLine = `• ${isHi ? 'कानून' : 'Law'}: ${item.law} (${isHi ? 'धारा' : 'Section'}: ${item.section})`;
          const implLine = `${isHi ? 'प्रभाव' : 'Implication'}: ${item.implication}`;
          
          doc.setFont(fontFamily, 'bold');
          const linesHead = doc.splitTextToSize(headLine, 175);
          doc.text(linesHead, 20, y);
          y += linesHead.length * 5;
          
          doc.setFont(fontFamily, 'normal');
          const linesImpl = doc.splitTextToSize(implLine, 170);
          doc.text(linesImpl, 25, y);
          y += linesImpl.length * 5 + 2;
        } 
        else if (pass.key === 'pass4') {
          // Pass 4: Pattern, Found, Warning
          const headLine = `• ${isHi ? 'धोखाधड़ी पैटर्न' : 'Pattern'}: ${item.pattern}`;
          const foundLine = `${isHi ? 'मिला' : 'Found'}: ${item.found}`;
          const warnLine = `${isHi ? 'चेतावनी' : 'Warning'}: ${item.warning}`;
          
          doc.setFont(fontFamily, 'bold');
          const linesHead = doc.splitTextToSize(headLine, 175);
          doc.text(linesHead, 20, y);
          y += linesHead.length * 5;
          
          doc.setFont(fontFamily, 'normal');
          const linesFound = doc.splitTextToSize(foundLine, 170);
          doc.text(linesFound, 25, y);
          y += linesFound.length * 5;
          
          const linesWarn = doc.splitTextToSize(warnLine, 170);
          doc.text(linesWarn, 25, y);
          y += linesWarn.length * 5 + 2;
        }
      }
    }
    y += 5;
  }

  // ── Rights Card ──────────────────────────
  if (y > 240) { doc.addPage(); y = 20; }
  doc.line(15, y, 195, y); y += 8;
  doc.setTextColor(13, 27, 62);
  doc.setFontSize(12);
  doc.setFont(fontFamily, 'bold');
  doc.text(isHi ? 'आपका अधिकार कार्ड' : 'Your Rights Card', 15, y); y += 8;

  const rights = analysis?.rightsCard || [];
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(fontFamily, 'normal');
  for (const right of rights.slice(0, 4)) {
    const lines = doc.splitTextToSize(
      `• ${right.right}: ${right.description} [${right.law}]`, 175
    );
    if (y + lines.length * 5 > 280) { doc.addPage(); y = 20; }
    doc.text(lines, 20, y);
    y += lines.length * 5 + 3;
  }

  // ── Negotiation ───────────────────────────
  y += 5;
  if (y > 240) { doc.addPage(); y = 20; }
  doc.line(15, y, 195, y); y += 8;
  doc.setTextColor(13, 27, 62);
  doc.setFontSize(12);
  doc.setFont(fontFamily, 'bold');
  doc.text(isHi ? 'वार्ता खंड (सुझाव)' : 'Negotiation Clauses', 15, y); y += 8;

  const negotiations = analysis?.negotiationClauses || [];
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(fontFamily, 'normal');
  for (const neg of negotiations.slice(0, 3)) {
    const headText = `• ${isHi ? 'मुद्दा' : 'Issue'}: ${neg.issue}`;
    const origText = `${isHi ? 'मूल खंड' : 'Original'}: ${neg.original}`;
    const sugText = `${isHi ? 'सुझाया गया' : 'Suggested'}: ${neg.suggested}`;

    if (y + 20 > 280) { doc.addPage(); y = 20; }
    
    doc.setFont(fontFamily, 'bold');
    const linesHead = doc.splitTextToSize(headText, 175);
    doc.text(linesHead, 20, y);
    y += linesHead.length * 5;

    doc.setFont(fontFamily, 'normal');
    const linesOrig = doc.splitTextToSize(origText, 170);
    doc.text(linesOrig, 25, y);
    y += linesOrig.length * 5;

    const linesSug = doc.splitTextToSize(sugText, 170);
    doc.text(linesSug, 25, y);
    y += linesSug.length * 5 + 3;
  }

  // ── Conclusion ────────────────────────────
  y += 5;
  if (y > 230) { doc.addPage(); y = 20; }
  doc.line(15, y, 195, y); y += 8;
  doc.setTextColor(13, 27, 62);
  doc.setFontSize(12);
  doc.setFont(fontFamily, 'bold');
  doc.text(isHi ? 'निष्कर्ष' : 'Conclusion', 15, y); y += 8;

  // Choose dynamic conclusion based on risk level
  let conclusionText = '';
  const isHigh = String(riskLevel).toLowerCase().includes('high') || String(riskLevel).includes('उच्च');
  const isMedium = String(riskLevel).toLowerCase().includes('medium') || String(riskLevel).includes('मध्यम');

  if (isHi) {
    if (isHigh) {
      conclusionText = `इस दस्तावेज़ में गंभीर जोखिम और संदिग्ध शर्तें पाई गई हैं। स्कैम स्कोर (${scamScore}/100) अधिक होने के कारण, NyAIy आपको दृढ़ता से सलाह देता है कि इस दस्तावेज़ पर हस्ताक्षर करने या इसे निष्पादित करने से पहले एक योग्य वकील/अधिवक्ता से परामर्श लें।`;
    } else if (isMedium) {
      conclusionText = `दस्तावेज़ में कुछ मध्यम जोखिम वाले खंड और विचलन मिले हैं। यह अनुशंसा की जाती है कि आप इन अनुचित शर्तों को संशोधित करने के लिए वार्ता करें और हस्ताक्षर करने से पहले आवश्यक सावधानी बरतें।`;
    } else {
      conclusionText = `दस्तावेज़ काफी हद तक मानक और सुरक्षित प्रतीत होता है। इसमें कोई गंभीर जोखिम या कपटपूर्ण पैटर्न नहीं पाए गए हैं। फिर भी, हस्ताक्षर करने से पहले सभी सामान्य नियमों को ध्यान से पढ़ लें।`;
    }
  } else {
    if (isHigh) {
      conclusionText = `Critical risks and highly suspicious terms have been detected in this document. Due to the high scam score (${scamScore}/100), NyAIy strongly advises you to consult a qualified legal professional/advocate before signing or executing this document.`;
    } else if (isMedium) {
      conclusionText = `Some medium-risk clauses and deviations have been detected in the document. It is recommended to negotiate these unfair terms and exercise necessary caution before execution.`;
    } else {
      conclusionText = `The document appears largely standard and safe. No high-risk clauses or fraudulent scam patterns were detected. Nonetheless, please read all general terms carefully before executing.`;
    }
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(fontFamily, 'normal');
  const linesConclusion = doc.splitTextToSize(conclusionText, 175);
  doc.text(linesConclusion, 20, y);
  y += linesConclusion.length * 5 + 3;

  // ── Footer ────────────────────────────────
  const ph = doc.internal.pageSize.height;
  doc.setFillColor(13, 27, 62);
  doc.rect(0, ph - 18, 210, 18, 'F');
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(8);
  doc.setFont(fontFamily, 'normal');
  doc.text(
    isHi
      ? 'NyAIy — केवल सूचनात्मक उद्देश्यों के लिए। पेशेवर कानूनी सलाह का विकल्प नहीं है।'
      : 'NyAIy — For informational purposes only. Not a substitute for professional legal advice.',
    105, ph - 7,
    { align: 'center' }
  );

  doc.save(`NyAIy_Report_${fileName}.pdf`);
  console.log('✅ PDF downloaded!');
};