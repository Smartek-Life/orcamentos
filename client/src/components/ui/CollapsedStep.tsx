interface CollapsedStepProps {
  step: string;
  title: string;
  summary: string;
  actionLabel: string;
  onAction: () => void;
}

export function CollapsedStep({
  step,
  title,
  summary,
  actionLabel,
  onAction,
}: CollapsedStepProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">{step}</p>
          <h3 className="mt-2 text-lg font-semibold text-slateink">{title}</h3>
          <p className="mt-2 text-sm text-slate-500">{summary}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
        >
          {actionLabel}
        </button>
      </div>
    </section>
  );
}
