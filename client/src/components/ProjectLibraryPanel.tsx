import type { ProjectSummary } from '../lib/projects';

interface ProjectLibraryPanelProps {
  projects: ProjectSummary[];
  loading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onOpenReport: (projectKey: string) => Promise<void> | void;
  onDeleteProject: (projectId: string) => Promise<void> | void;
}

export function ProjectLibraryPanel({
  projects,
  loading = false,
  error = null,
  onRefresh,
  onOpenReport,
  onDeleteProject,
}: ProjectLibraryPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Projetos web</p>
          <h2 className="mt-2 text-lg font-semibold text-slateink">Biblioteca do usuario</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Esta lista vem do Supabase. Por enquanto ela serve como validacao da camada web, sem substituir o fluxo atual do app.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      {projects.length === 0 && !loading && !error ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Nenhum projeto encontrado ainda neste usuario.
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div className="mt-4 space-y-3">
          {projects.map((project) => (
            <article key={project.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slateink">
                    {project.title?.trim() || project.fileName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">{project.fileName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Web
                  </span>
                  <button
                    type="button"
                    onClick={() => void onOpenReport(project.projectKey)}
                    className="rounded-full border border-blue-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700 transition hover:bg-blue-50"
                  >
                    Relatorio
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteProject(project.id)}
                    className="rounded-full border border-rose-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                <p>Atualizado: {new Date(project.updatedAt).toLocaleString('pt-BR')}</p>
                <p>Chave: {project.projectKey}</p>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
