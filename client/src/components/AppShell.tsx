import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  getCurrentSession,
  isWebAuthEnabled,
  onAuthStateChange,
  signInWithPassword,
  signOutCurrentUser,
  signUpWithPassword,
} from '../lib/auth';
import { deleteUserProject, listUserProjects, type ProjectSummary } from '../lib/projects';
import { buildProjectReportHtml } from '../lib/reporting';
import { loadProjectState } from '../lib/projectStorage';
import { getSavedModuleBoard } from '../lib/planState';
import type { ProjectModule } from '../types';
import { LoginPage } from './LoginPage';
import { ProjectLibraryPanel } from './ProjectLibraryPanel';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isWebAuthEnabled());
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isWebAuthEnabled()) {
      setLoading(false);
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        const nextSession = await getCurrentSession();
        if (mounted) {
          setSession(nextSession);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    const unsubscribe = onAuthStateChange((nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    const refreshHandler = () => {
      void loadProjects();
    };

    window.addEventListener('codex-projects-changed', refreshHandler);

    return () => {
      mounted = false;
      window.removeEventListener('codex-projects-changed', refreshHandler);
      unsubscribe();
    };
  }, []);

  const handleLogin = async ({
    email,
    password,
    mode,
  }: {
    email: string;
    password: string;
    mode: 'signin' | 'signup';
  }) => {
    setLoginError(null);
    setLoginNotice(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const nextSession = await signUpWithPassword(email, password);
        if (nextSession) {
          setSession(nextSession);
          setLoginNotice('Conta criada com sucesso. Voce ja esta conectado.');
        } else {
          setLoginNotice('Conta criada. Se o Supabase pedir confirmacao por email, valide sua caixa de entrada.');
        }
      } else {
        const nextSession = await signInWithPassword(email, password);
        setSession(nextSession);
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutCurrentUser();
      setSession(null);
      setProjects([]);
      setProjectsError(null);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Falha ao sair.');
    }
  };

  const loadProjects = async () => {
    setProjectsLoading(true);
    setProjectsError(null);

    try {
      const nextProjects = await listUserProjects();
      setProjects(nextProjects);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : 'Falha ao carregar a biblioteca web.');
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadProjects();
  }, [session]);

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteUserProject(projectId);
      await loadProjects();
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : 'Falha ao excluir projeto.');
    }
  };

  const handleOpenProjectReport = async (projectKey: string) => {
    try {
      const persisted = await loadProjectState(projectKey);
      if (!persisted) {
        setProjectsError('Projeto nao encontrado para gerar o relatorio.');
        return;
      }

      const selectedPages = persisted.selectedPages ?? [];
      const moduleOrder: ProjectModule[] = ['wifi', 'cctv', 'audio'];
      const savedBoards = moduleOrder.flatMap((module) =>
        selectedPages
          .map((pageNum) => {
            const plan = persisted.plans?.[pageNum];
            if (!plan) {
              return null;
            }

            const board = getSavedModuleBoard(plan, module);
            if (!board) {
              return null;
            }

            return {
              module,
              floorLabel: plan.floorLabel || `Planta ${pageNum}`,
              pageNum,
              board,
              plan,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      );

      if (savedBoards.length === 0) {
        setProjectsError('Este projeto ainda nao tem pranchas salvas para relatorio.');
        return;
      }

      const html = buildProjectReportHtml({
        preparedPlantsCount: selectedPages.length,
        savedBoards,
        commercialBudgetSections: persisted.commercialBudgetSections ?? [],
      });

      const reportWindow = window.open('', '_blank', 'width=1280,height=900');
      if (!reportWindow) {
        setProjectsError('Nao foi possivel abrir a janela do relatorio.');
        return;
      }

      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
      setProjectsError(null);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : 'Falha ao abrir relatorio do projeto.');
    }
  };

  if (!isWebAuthEnabled()) {
    return <>{children}</>;
  }

  if (loading && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-shell px-6 py-8 text-slateink">
        <div className="rounded-[24px] border border-slate-200 bg-white px-8 py-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Carregando sessao</p>
          <p className="mt-2 text-sm text-slate-500">Verificando seu acesso ao modo web...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage loading={loading} error={loginError} notice={loginNotice} onSubmit={handleLogin} />;
  }

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur lg:px-10">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-tide">Modo web</p>
            <p className="text-sm text-slate-500">{session.user.email ?? 'Usuario autenticado'}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
          >
            Sair
          </button>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1680px] gap-6 px-6 py-6 lg:px-10 xl:grid-cols-[340px_minmax(0,1fr)]">
        <ProjectLibraryPanel
          projects={projects}
          loading={projectsLoading}
          error={projectsError}
          onRefresh={() => void loadProjects()}
          onOpenReport={handleOpenProjectReport}
          onDeleteProject={handleDeleteProject}
        />
        <div>{children}</div>
      </div>
    </>
  );
}
