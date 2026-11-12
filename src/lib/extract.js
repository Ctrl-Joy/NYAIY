import { AppError } from './api';

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
/** The server analyses at most this many characters, so extraction stops there. */
export const MAX_DOC_CHARS = 8000;
export const MIN_DOC_CHARS = 50;

const MAX_PDF_PAGES = 40;
const MAX_OCR_PAGES = 3;

const ext = (name) => (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

export const fileKind = (file) => {
  const e = ext(file.name);
  if (file.type === 'application/pdf' || e === 'pdf') return 'pdf';
  if (file.type === 'text/plain' || e === 'txt') return 'text';
  // Camera photos can arrive without a useful name, so the MIME type is checked first.
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(e)) {
    return 'image';
  }
  return null;
};

/** Returns an error code, or null when the file can be read. */
export const validateFile = (file) => {
  if (!fileKind(file)) return 'errFileType';
  if (file.size > MAX_FILE_BYTES) return 'errFileSize';
  if (file.size === 0) return 'errFileEmpty';
  return null;
};

const tidy = (text) =>
  text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const checkAborted = (signal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
};

const makeOcr = async (lang, onProgress) => {
  const { createWorker } = await import('tesseract.js');
  return createWorker(lang === 'hi' ? ['eng', 'hin'] : 'eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.({ stage: 'ocr', percent: Math.round(m.progress * 100) });
    },
  });
};

const readPdf = async (file, { lang, signal, onProgress }) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;

  let pdf;
  try {
    pdf = await pdfjs.getDocument({
      data: await file.arrayBuffer(),
      useSystemFonts: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    }).promise;
  } catch {
    throw new AppError('errPdfBroken');
  }

  try {
    const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
    let text = '';
    let reachedEnd = true;
    for (let i = 1; i <= pages; i++) {
      checkAborted(signal);
      onProgress?.({ stage: 'pdf', page: i, pages });
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let line = '';
      for (const item of content.items) {
        line += item.str;
        if (item.hasEOL) line += '\n';
        else if (item.str && !item.str.endsWith(' ')) line += ' ';
      }
      text += line + '\n\n';
      if (text.length >= MAX_DOC_CHARS) {
        reachedEnd = i === pdf.numPages;
        break;
      }
    }
    text = tidy(text);
    if (text.length >= MIN_DOC_CHARS) {
      return { text, truncated: !reachedEnd || pdf.numPages > pages || text.length > MAX_DOC_CHARS };
    }

    // No text layer: this is a scan, so read the first pages with OCR.
    const ocrPages = Math.min(pdf.numPages, MAX_OCR_PAGES);
    const worker = await makeOcr(lang, (p) => onProgress?.({ ...p, pages: ocrPages }));
    let ocrText = '';
    try {
      for (let i = 1; i <= ocrPages; i++) {
        checkAborted(signal);
        onProgress?.({ stage: 'ocr', page: i, pages: ocrPages, percent: 0 });
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const { data } = await worker.recognize(canvas);
        ocrText += data.text + '\n\n';
        if (ocrText.length >= MAX_DOC_CHARS) break;
      }
    } finally {
      await worker.terminate();
    }
    return { text: tidy(ocrText), truncated: pdf.numPages > ocrPages, ocr: true };
  } finally {
    pdf.destroy?.();
  }
};

/** Phone photos are far larger than OCR needs; shrinking them keeps recognition fast. */
const MAX_OCR_SIDE = 2200;
const shrinkImage = async (file) => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_OCR_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas;
  } catch {
    return file;
  }
};

const readImage = async (file, { lang, signal, onProgress }) => {
  onProgress?.({ stage: 'ocr', percent: 0 });
  const [worker, image] = await Promise.all([makeOcr(lang, onProgress), shrinkImage(file)]);
  try {
    checkAborted(signal);
    const { data } = await worker.recognize(image);
    return { text: tidy(data.text), truncated: false, ocr: true };
  } finally {
    await worker.terminate();
  }
};

/**
 * Read the text out of a PDF, image or text file, entirely in the browser.
 * Resolves to { text, truncated, ocr } and throws AppError('errFileEmpty') when
 * nothing readable was found.
 */
export const extractText = async (file, options = {}) => {
  const kind = fileKind(file);
  let result;
  if (kind === 'pdf') result = await readPdf(file, options);
  else if (kind === 'image') result = await readImage(file, options);
  else result = { text: tidy(await file.text()), truncated: false };

  checkAborted(options.signal);
  if (result.text.length < MIN_DOC_CHARS) throw new AppError('errFileEmpty');
  if (result.text.length > MAX_DOC_CHARS) {
    result = { ...result, text: result.text.slice(0, MAX_DOC_CHARS), truncated: true };
  }
  return result;
};
