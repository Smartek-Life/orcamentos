import type { EnvType } from '../types';

interface ConfigPanelProps {
  value: EnvType;
  onChange: (value: EnvType) => void;
}

const options: Array<{ value: EnvType; title: string; description: string }> = [
  {
    value: 'residencial',
    title: 'Residencial',
    description: 'Prioriza sala, quartos, circulacao domestica e baixa densidade de usuarios simultaneos.',
  },
  {
    value: 'comercial',
    title: 'Comercial',
    description: 'Prioriza recepcao, open space, salas de reuniao e zonas com maior concorrencia de dispositivos.',
  },
];

export function ConfigPanel({ value, onChange }: ConfigPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Wi-Fi</p>
        <h3 className="mt-2 text-lg font-semibold text-slateink">Perfil do ambiente</h3>
        <p className="mt-2 text-sm text-slate-500">
          Esta configuracao vale apenas para o modulo Wi-Fi e influencia a sugestao inicial de APs e a leitura de cobertura.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const active = value === option.value;

          return (
            <button
              type="button"
              key={option.value}
              onClick={() => onChange(option.value)}
              className={[
                'rounded-2xl border px-4 py-4 text-left transition',
                active
                  ? 'border-tide bg-gradient-to-br from-tide/10 to-pine/10 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-tide/40 hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={[
                    'flex h-5 w-5 items-center justify-center rounded-full border',
                    active ? 'border-tide bg-tide' : 'border-slate-300 bg-white',
                  ].join(' ')}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                <span className="text-base font-semibold text-slateink">{option.title}</span>
              </div>
              <p className="text-sm text-slate-600">{option.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
