import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

// Worker via CDN – vermeidet Bundle-Größen-Problem
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  blobUrl: string; // blob: URL oder direkte /uploads/ URL
}

export default function PdfViewer({ blobUrl }: PdfViewerProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTask  = useRef<any>(null);
  const pdfDoc      = useRef<any>(null);

  const [page,     setPage]     = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale,    setScale]    = useState(1.2);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  // PDF laden
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setPage(1);

    pdfjsLib.getDocument(blobUrl).promise
      .then(pdf => {
        if (cancelled) return;
        pdfDoc.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[PdfViewer] Ladefehler:', err);
        setError('PDF konnte nicht geladen werden.');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [blobUrl]);

  // Seite rendern
  useEffect(() => {
    if (!pdfDoc.current || !canvasRef.current || loading) return;

    // Laufenden Render abbrechen
    if (renderTask.current) {
      renderTask.current.cancel();
      renderTask.current = null;
    }

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d')!;

    pdfDoc.current.getPage(page).then((pdfPage: any) => {
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      // Automatisch auf Container-Breite skalieren
      const viewport = pdfPage.getViewport({ scale: 1 });
      const autoScale = (containerWidth / viewport.width) * scale;
      const scaledViewport = pdfPage.getViewport({ scale: autoScale });

      canvas.width  = scaledViewport.width;
      canvas.height = scaledViewport.height;

      renderTask.current = pdfPage.render({ canvasContext: ctx, viewport: scaledViewport });
      renderTask.current.promise.catch(() => {}); // cancelled → ignorieren
    });
  }, [page, scale, loading]);

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-gray-950">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 p-8">
      <p className="text-sm text-center">{error}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        {/* Seitennavigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-gray-300 text-xs tabular-nums">{page} / {numPages}</span>
          <button onClick={() => setPage(p => Math.min(numPages, p + 1))} disabled={page >= numPages}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {/* Zoom */}
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-gray-300 text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.2))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-800 flex justify-center p-2">
        <canvas ref={canvasRef} className="shadow-xl" style={{ maxWidth: '100%', height: 'auto' }} />
      </div>
    </div>
  );
}
