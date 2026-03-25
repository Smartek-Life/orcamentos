import type { ExtraBudgetModule, PriceCatalogItem } from '../types';

interface ExtraBudgetModulesPanelProps {
  modules: ExtraBudgetModule[];
  products: PriceCatalogItem[];
  loadingProducts?: boolean;
  productsError?: string | null;
  onCreateModule: () => void;
  onDeleteModule: (moduleId: string) => void;
  onRenameModule: (moduleId: string, name: string) => void;
  onAddItem: (moduleId: string) => void;
  onDeleteItem: (moduleId: string, itemId: string) => void;
  onSelectProduct: (moduleId: string, itemId: string, productId: string) => void;
  onQuantityChange: (moduleId: string, itemId: string, quantity: number) => void;
}

export function ExtraBudgetModulesPanel({
  modules,
  products,
  loadingProducts = false,
  productsError = null,
  onCreateModule,
  onDeleteModule,
  onRenameModule,
  onAddItem,
  onDeleteItem,
  onSelectProduct,
  onQuantityChange,
}: ExtraBudgetModulesPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Modulos extras do orçamento</p>
          <h3 className="mt-2 text-xl font-semibold text-slateink">Produtos fora de Wi‑Fi, cameras e som</h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Crie modulos adicionais como controle de acesso facial, fechaduras, painel de LED ou qualquer outro item
            que nao precise de croqui tecnico.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateModule}
          className="rounded-2xl bg-tide px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#124f8f]"
        >
          Novo modulo
        </button>
      </div>

      {productsError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{productsError}</p> : null}

      {loadingProducts ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Carregando catalogo de produtos...
        </div>
      ) : null}

      {!loadingProducts && modules.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Nenhum modulo extra criado ainda.
        </div>
      ) : null}

      {modules.length > 0 ? (
        <div className="mt-5 space-y-4">
          {modules.map((module) => (
            <article key={module.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slateink">Nome do modulo</span>
                    <input
                      value={module.name}
                      onChange={(event) => onRenameModule(module.id, event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                      placeholder="Ex.: Controle de acesso facial"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteModule(module.id)}
                  className="rounded-full border border-rose-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-50"
                >
                  Excluir modulo
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {module.items.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 xl:grid-cols-[minmax(0,1.3fr)_140px_120px_auto]">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Produto</span>
                      <select
                        value={item.catalogProductId ?? ''}
                        onChange={(event) => onSelectProduct(module.id, item.id, event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                      >
                        <option value="">Selecione um produto</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.productName} ({product.sku})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">SKU</span>
                      <p className="text-sm text-slate-700">{item.sku || '-'}</p>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Quantidade</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => onQuantityChange(module.id, item.id, Number(event.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                      />
                    </label>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => onDeleteItem(module.id, item.id)}
                        className="w-full rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        Excluir item
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onAddItem(module.id)}
                className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
              >
                Adicionar produto
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
