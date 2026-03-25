import { useRef, useState } from 'react';
import { formatBytes } from '../lib/utils';

interface UploadZoneProps {
  fileName: string;
  fileSize: number;
  loading: boolean;
  error: string | null;
  onFileSelect: (file: File) => void | Promise<void>;
  onReset: () => void;
}

export function UploadZone({
  fileName,
  fileSize,
  loading,
  error,
  onFileSelect,
  onReset,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const selected = files?.[0];

    if (!selected) {
      return;
    }

    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      window.alert('Selecione um arquivo PDF valido.');
      return;
    }

    await onFileSelect(selected);
  };

  return (
    <section className="rounded-[28px] border border-white/80 bg-white/85 p-8 shadow-soft backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Base do Projeto</p>
          <h2 className="mt-2 text-2xl font-semibold text-slateink">Upload do PDF</h2>
        </div>
        {fileName ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-tide/20 px-4 py-2 text-sm font-semibold text-tide transition hover:border-tide hover:bg-tide/5"
          >
            Trocar arquivo
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={[
          'relative flex min-h-60 w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-8 text-center transition',
          dragActive ? 'border-tide bg-tide/10' : 'border-slate-300 bg-cloud/80 hover:border-tide/60',
        ].join(' ')}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-tide text-xl font-bold text-white shadow-lg">
          PDF
        </div>
        <p className="text-xl font-semibold text-slateink">Arraste o arquivo aqui ou clique para selecionar</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          O sistema renderiza todas as paginas com pdf.js, prepara a base do pavimento e reaproveita essa geometria para
          Wi-Fi, sonorizacao e cameras.
        </p>
        {loading ? <p className="mt-4 text-sm font-medium text-tide">Renderizando paginas do PDF...</p> : null}
      </button>

      {fileName ? (
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slateink">{fileName}</p>
            <p className="text-sm text-slate-500">{formatBytes(fileSize)}</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-600"
          >
            Remover arquivo
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
