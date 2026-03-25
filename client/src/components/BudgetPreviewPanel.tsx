import type { CommercialBudgetSection } from '../types';

interface BudgetPreviewPanelProps {
  open: boolean;
  sections: CommercialBudgetSection[];
  onClose: () => void;
  onQuantityChange: (sectionId: string, lineIndex: number, quantity: number) => void;
  onUnitPriceChange: (sectionId: string, lineIndex: number, unitPrice: number) => void;
  onResetFromTechnicalBase: () => void;
}

function getSectionTotal(section: CommercialBudgetSection) {
  return section.lines.reduce((sum, line) => sum + (line.totalPrice ?? 0), 0);
}

function getGrandTotal(sections: CommercialBudgetSection[]) {
  return sections.reduce((sum, section) => sum + getSectionTotal(section), 0);
}

export function BudgetPreviewPanel({ open, sections, onClose, onQuantityChange, onUnitPriceChange, onResetFromTechnicalBase }: BudgetPreviewPanelProps) {
  if (!open) {
    return null;
  }

  const grandTotal = getGrandTotal(sections);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slateink/50 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-6xl overflow-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Visualizacao do orcamento</p>
            <h2 className="mt-2 text-2xl font-semibold text-slateink">Produtos atualmente adicionados</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Esta visualizacao consolida os itens vindos dos modulos tecnicos e dos modulos extras do orcamento.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onResetFromTechnicalBase}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
            >
              Atualizar da base tecnica
            </button>
            <button
              type="button"
              onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
          >
            Fechar
            </button>
          </div>
        </div>

        {sections.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <span className="font-semibold">Total consolidado:</span> R$ {grandTotal.toFixed(2)}
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          {sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              Nenhum item encontrado ainda para o orcamento.
            </div>
          ) : (
            sections.map((section) => {
              const sectionTotal = getSectionTotal(section);

              return (
                <section key={section.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-slateink">{section.title}</h3>
                    <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slateink">
                      Total: R$ {sectionTotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="px-3 py-2 font-semibold">Item</th>
                          <th className="px-3 py-2 font-semibold">SKU</th>
                          <th className="px-3 py-2 font-semibold">Qtd</th>
                          <th className="px-3 py-2 font-semibold">Unidade</th>
                          <th className="px-3 py-2 font-semibold">Valor un.</th>
                          <th className="px-3 py-2 font-semibold">Total</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.lines.map((line, index) => (
                          <tr key={`${section.id}-${index}`} className="rounded-2xl bg-white text-slate-700">
                            <td className="rounded-l-2xl px-3 py-3 font-medium text-slateink">{line.label}</td>
                            <td className="px-3 py-3">{line.sku ?? '-'}</td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={line.quantity}
                                onChange={(event) => onQuantityChange(section.id, index, Number(event.target.value))}
                                className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                              />
                            </td>
                            <td className="px-3 py-3">{line.unit ?? '-'}</td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={typeof line.unitPrice === 'number' ? line.unitPrice : 0}
                                onChange={(event) => onUnitPriceChange(section.id, index, Number(event.target.value))}
                                className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                              />
                            </td>
                            <td className="px-3 py-3">
                              {typeof line.totalPrice === 'number' ? `R$ ${line.totalPrice.toFixed(2)}` : '-'}
                            </td>
                            <td className="rounded-r-2xl px-3 py-3">
                              {line.pendingPrice ? (
                                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                                  Pendente de vinculo
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                  Vinculado
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
