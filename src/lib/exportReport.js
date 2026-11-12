import { strings } from '../i18n';

const safeName = (name) =>
  (name || 'document').replace(/\.[a-z0-9]+$/i, '').replace(/[^\wऀ-ॿ-]+/g, '_').slice(0, 60) || 'document';

export const reportFileName = (report) => `NyAIy_${safeName(report.name)}.pdf`;

export const formatDate = (iso, lang) =>
  new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

/** The sections of a report as plain data, shared by the text and PDF exports. */
export const reportSections = (report) => {
  const t = strings[report.lang] || strings.en;
  const a = report.analysis;
  return [
    {
      title: t.secClauses,
      empty: t.emptyClauses,
      items: a.pass1.clauses.map((c) => ({
        heading: `[${t['riskShort_' + c.risk]}] ${c.clause}`,
        lines: [c.explanation],
      })),
    },
    {
      title: t.secDeviations,
      empty: t.emptyDeviations,
      items: a.pass2.deviations.map((d) => ({
        heading: `[${t['riskShort_' + d.severity]}] ${d.issue}`,
        lines: [`${t.found}: ${d.found}`, `${t.standard}: ${d.standard}`],
      })),
    },
    {
      title: t.secLaws,
      empty: t.emptyLaws,
      items: a.pass3.laws.map((l) => ({
        heading: [l.law, l.section].filter(Boolean).join(', '),
        lines: [l.implication],
      })),
    },
    {
      title: t.secFlags,
      empty: t.emptyFlags,
      items: a.pass4.redFlags.map((f) => ({
        heading: f.pattern,
        lines: [f.found && `${t.found}: ${f.found}`, f.warning],
      })),
    },
    {
      title: t.secRights,
      empty: t.emptyRights,
      items: a.rightsCard.map((r) => ({ heading: r.right, lines: [r.description, r.law] })),
    },
    {
      title: t.secNegotiate,
      empty: t.emptyNegotiate,
      items: a.negotiationClauses.map((n) => ({
        heading: n.issue,
        lines: [n.original && `${t.original}: ${n.original}`, `${t.suggested}: ${n.suggested}`],
      })),
    },
  ].map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, lines: i.lines.filter(Boolean) })) }));
};

const metaLines = (report) => {
  const t = strings[report.lang] || strings.en;
  return [
    `${t['doc_' + report.docType]} · ${formatDate(report.createdAt, report.lang)}`,
    `${t.overall}: ${t['risk_' + report.risk.level]}`,
    `${t.caseType}: ${t['case_' + report.caseType] || report.caseType} (${Math.round(report.confidence)}% ${t.confidence})`,
    `${t.flagScore}: ${report.risk.score}/100`,
  ];
};

/** Plain-text version of the report, for the clipboard. */
export const reportToText = (report) => {
  const t = strings[report.lang] || strings.en;
  const out = [`NyAIy: ${report.name}`, ...metaLines(report), '', t.summary.toUpperCase(), report.analysis.summary, ''];
  for (const s of reportSections(report)) {
    out.push(s.title.toUpperCase());
    if (!s.items.length) out.push(s.empty);
    s.items.forEach((item, i) => {
      out.push(`${i + 1}. ${item.heading}`);
      item.lines.forEach((l) => out.push(`   ${l}`));
    });
    out.push('');
  }
  out.push(t.disclaimer);
  return out.join('\n');
};

// The built-in PDF fonts only cover Latin-1, so a few common characters are swapped out.
const latin = (s) =>
  String(s)
    .replace(/₹\s?/g, 'Rs. ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/·/g, '|')
    .replace(/[^\t\n\x20-\x7E\xA0-\xFF]/g, '');

/** Build and download the report as a PDF (Latin-script reports). */
export const downloadPdf = async (report) => {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const t = strings[report.lang] || strings.en;
  const left = 20;
  const width = 170;
  const bottom = 275;
  let y = 24;

  const INK = [26, 29, 33];
  const MUTED = [91, 97, 107];
  const ACCENT = [30, 58, 95];
  const RISK = { High: [180, 35, 24], Medium: [147, 55, 13], Low: [6, 118, 71] };

  const write = (text, { size = 10.5, style = 'normal', color = INK, font = 'times', gap = 1.5, indent = 0 } = {}) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lineHeight = size * 0.3528 * 1.45;
    for (const line of doc.splitTextToSize(latin(text), width - indent)) {
      if (y + lineHeight > bottom) {
        doc.addPage();
        y = 22;
      }
      doc.text(line, left + indent, y);
      y += lineHeight;
    }
    y += gap;
  };

  write('NyAIy', { size: 11, style: 'bold', color: ACCENT, font: 'helvetica', gap: 5 });
  write(report.name, { size: 20, style: 'bold', gap: 2 });
  const [first, , ...rest] = metaLines(report);
  write(first, { size: 9.5, color: MUTED, font: 'helvetica', gap: 5 });
  write(t['risk_' + report.risk.level].toUpperCase(), {
    size: 10, style: 'bold', color: RISK[report.risk.level], font: 'helvetica', gap: 1,
  });
  write(rest.join('   |   '), { size: 9.5, color: MUTED, font: 'helvetica', gap: 5 });
  write(report.analysis.summary, { size: 12, gap: 6 });

  for (const s of reportSections(report)) {
    if (y > bottom - 25) {
      doc.addPage();
      y = 22;
    }
    doc.setDrawColor(229, 226, 218);
    doc.line(left, y - 2, left + width, y - 2);
    y += 5;
    write(s.title, { size: 13, style: 'bold', color: ACCENT, gap: 3 });
    if (!s.items.length) write(s.empty, { color: MUTED, style: 'italic', gap: 4 });
    for (const [i, item] of s.items.entries()) {
      write(`${i + 1}. ${item.heading}`, { style: 'bold', gap: 0.8 });
      for (const l of item.lines) write(l, { size: 10, color: MUTED, indent: 4.5, gap: 0.8 });
      y += 2.5;
    }
    y += 3;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(latin(t.disclaimer), left, 287);
    doc.text(`${i} / ${pages}`, left + width, 287, { align: 'right' });
  }
  doc.save(reportFileName(report));
};
