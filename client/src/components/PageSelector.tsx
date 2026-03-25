import type { PdfPage } from '../types';

interface PageSelectorProps {
  pages: PdfPage[];
  selectedPages: number[];
  onTogglePage: (pageNum: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function PageSelector({
  pages,
  selectedPages,
  onTogglePage,
  onSelectAll,
  onClearSelection,
}: PageSelectorProps) {
  const selected = new Set(selectedPages);

  return (
    <section className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-soft backdrop-blur">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Etapa 2</p>
          <h2 className="mt-2 text-2xl font-semibold text-slateink">Seleção manual de plantas</h2>
          <p className="mt-2 text-sm text-slate-500">
            Sem automação nessa etapa: você escolhe exatamente quais páginas representam plantas válidas para análise.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-tide hover:text-tide"
          >
            Selecionar todas
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-600"
          >
            Limpar seleção
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-slateink px-4 py-3 text-sm font-medium text-white">
        {selectedPages.length} página(s) selecionada(s)
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {pages.map((page) => {
          const active = selected.has(page.pageNum);

          return (
            <button
              type="button"
              key={page.pageNum}
              onClick={() => onTogglePage(page.pageNum)}
              className={[
                'group relative overflow-hidden rounded-[24px] border bg-white text-left transition',
                active
                  ? 'border-tide shadow-lg shadow-tide/20 ring-2 ring-tide/20'
                  : 'border-slate-200 hover:border-tide/50 hover:shadow-md',
              ].join(' ')}
            >
              <div className="absolute left-3 top-3 z-10 flex h-8 min-w-8 items-center justify-center rounded-full border border-white/70 bg-white/90 px-2 text-sm font-bold text-tide shadow-sm">
                {active ? '✓' : page.pageNum}
              </div>
              <div className="aspect-[3/4] overflow-hidden bg-slate-100">
                <img
                  src={page.thumbDataUrl}
                  alt={`Miniatura da página ${page.pageNum}`}
                  className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slateink">Pg. {page.pageNum}</p>
                  <p className="text-xs text-slate-500">
                    {page.width} x {page.height}px
                  </p>
                </div>
                <span
                  className={[
                    'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold',
                    active ? 'bg-tide text-white' : 'bg-slate-100 text-slate-500',
                  ].join(' ')}
                >
                  {active ? 'Selecionada' : 'Selecionar'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
