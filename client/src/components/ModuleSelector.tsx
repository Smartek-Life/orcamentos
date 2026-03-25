import type { ProjectModule } from '../types';

interface ModuleSelectorProps {
  value: ProjectModule;
  savedModules?: Partial<Record<ProjectModule, boolean>>;
  onChange: (value: ProjectModule) => void;
}

const modules: Array<{
  value: ProjectModule;
  title: string;
  description: string;
  available: boolean;
}> = [
  {
    value: 'wifi',
    title: 'Wi-Fi',
    description: 'Planejamento de Access Points, area coberta, heatmap e ajuste fino da rede sem fio.',
    available: true,
  },
  {
    value: 'audio',
    title: 'Sonorizacao',
    description: 'Posicione caixas sobre a planta e organize zonas de audio com leitura inicial de amplificacao.',
    available: true,
  },
  {
    value: 'cctv',
    title: 'Cameras',
    description: 'Base para posicionamento de cameras, angulos de visao e identificacao de pontos cegos.',
    available: true,
  },
];

export function ModuleSelector({ value, savedModules, onChange }: ModuleSelectorProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Modulos</p>
        <h3 className="mt-2 text-lg font-semibold text-slateink">Escolha a disciplina do orcamento</h3>
        <p className="mt-2 text-sm text-slate-500">
          A calibracao da planta vira a base comum do projeto. Depois disso, cada disciplina consome a mesma geometria.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {modules.map((module) => {
          const active = value === module.value;
          const saved = Boolean(savedModules?.[module.value]);
          const clickable = module.available && !saved;

          return (
            <button
              key={module.value}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onChange(module.value)}
              className={[
                'rounded-2xl border px-4 py-4 text-left transition',
                clickable
                  ? active
                    ? 'border-tide bg-gradient-to-br from-tide/10 to-pine/10 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-tide/40 hover:bg-slate-50'
                  : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-75',
              ].join(' ')}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-base font-semibold text-slateink">{module.title}</span>
                <span
                  className={[
                    'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
                    saved
                      ? 'bg-pine/10 text-pine'
                      : module.available
                        ? 'bg-tide/10 text-tide'
                        : 'bg-slate-200 text-slate-500',
                  ].join(' ')}
                >
                  {saved ? 'Concluido' : module.available ? 'Disponivel' : 'Em breve'}
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-600">{module.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
