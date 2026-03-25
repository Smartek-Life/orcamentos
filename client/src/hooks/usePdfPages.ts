import { useCallback, useState } from 'react';
import { buildProjectFingerprint } from '../lib/projectKeys';
import { pdfjsLib } from '../lib/pdf';
import type { PdfPage } from '../types';

async function renderPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  scale: number,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Não foi possível criar o contexto 2D do canvas.');
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise;

  return canvas;
}

export function usePdfPages() {
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [fileFingerprint, setFileFingerprint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPages([]);
    setFileName('');
    setFileSize(0);
    setFileFingerprint(null);
    setLoading(false);
    setError(null);
  }, []);

  const loadPdf = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const task = pdfjsLib.getDocument({ data: buffer });
      const pdf = await task.promise;
      const nextPages: PdfPage[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const thumbCanvas = await renderPageToCanvas(page, 0.35);
        const hiResCanvas = await renderPageToCanvas(page, 1.5);
        const hiResDataUrl = hiResCanvas.toDataURL('image/jpeg', 0.92);

        nextPages.push({
          pageNum,
          thumbCanvas,
          thumbDataUrl: thumbCanvas.toDataURL('image/png'),
          hiResBase64: hiResDataUrl.replace(/^data:image\/jpeg;base64,/, ''),
          extractedText: textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' '),
          width: hiResCanvas.width,
          height: hiResCanvas.height,
        });
      }

      setPages(nextPages);
      setFileName(file.name);
      setFileSize(file.size);
      try {
        setFileFingerprint(await buildProjectFingerprint(file));
      } catch {
        setFileFingerprint(null);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Falha ao abrir o PDF.';
      setError(message);
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    pages,
    fileName,
    fileSize,
    fileFingerprint,
    loading,
    error,
    loadPdf,
    reset,
  };
}
