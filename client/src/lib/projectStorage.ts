import type { PersistedProjectState } from '../types';
import { buildProjectKey } from './projectKeys';
import { getSupabaseClient, isDesktopRuntime, isSupabaseConfigured } from './supabase';

const STORAGE_PREFIX = 'smartek.project-base.';

export { buildProjectKey };

export async function loadProjectState(projectKey: string): Promise<PersistedProjectState | null> {
  if (window.desktopApi?.loadProjectState) {
    const loaded = await window.desktopApi.loadProjectState(projectKey);
    if (!loaded || typeof loaded !== 'object') {
      return null;
    }

    const parsed = loaded as PersistedProjectState;
    return parsed.projectKey === projectKey ? parsed : null;
  }

  if (!isDesktopRuntime && isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();

    if (supabase && userId) {
      const { data, error } = await supabase
        .from('projects')
        .select('state')
        .eq('user_id', userId)
        .eq('project_key', projectKey)
        .maybeSingle();

      if (error) {
        throw new Error(`Falha ao carregar o projeto na nuvem. ${error.message}`);
      }

      const parsed = data?.state as PersistedProjectState | null;
      return parsed?.projectKey === projectKey ? parsed : null;
    }
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(projectKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedProjectState;
    return parsed.projectKey === projectKey ? parsed : null;
  } catch (error) {
    throw new Error(
      `Falha ao carregar o projeto salvo. ${error instanceof Error ? error.message : 'Erro desconhecido.'}`,
    );
  }
}

export async function saveProjectState(state: PersistedProjectState) {
  if (window.desktopApi?.saveProjectState) {
    return window.desktopApi.saveProjectState(state);
  }

  if (!isDesktopRuntime && isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();

    if (supabase && userId) {
      const { error } = await supabase.from('projects').upsert(
        {
          user_id: userId,
          project_key: state.projectKey,
          file_name: state.fileName,
          file_hash: state.fileHash ?? null,
          title: state.fileName,
          state,
        },
        {
          onConflict: 'user_id,project_key',
        },
      );

      if (error) {
        throw new Error(`Falha ao salvar o projeto na nuvem. ${error.message}`);
      }

      return { storage: 'supabase' };
    }
  }

  try {
    window.localStorage.setItem(getStorageKey(state.projectKey), JSON.stringify(state));
    return { storage: 'localStorage' };
  } catch (error) {
    throw new Error(
      `Falha ao salvar o projeto no navegador. ${error instanceof Error ? error.message : 'Erro desconhecido.'}`,
    );
  }
}

export async function clearProjectState(projectKey: string) {
  if (window.desktopApi?.clearProjectState) {
    return window.desktopApi.clearProjectState(projectKey);
  }

  if (!isDesktopRuntime && isSupabaseConfigured) {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();

    if (supabase && userId) {
      const { error } = await supabase.from('projects').delete().eq('user_id', userId).eq('project_key', projectKey);
      if (error) {
        throw new Error(`Falha ao limpar o projeto na nuvem. ${error.message}`);
      }

      return { cleared: true };
    }
  }

  try {
    window.localStorage.removeItem(getStorageKey(projectKey));
    return { cleared: true };
  } catch (error) {
    throw new Error(
      `Falha ao limpar o projeto salvo. ${error instanceof Error ? error.message : 'Erro desconhecido.'}`,
    );
  }
}

function getStorageKey(projectKey: string) {
  return `${STORAGE_PREFIX}${projectKey}`;
}

async function getCurrentUserId() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Falha ao identificar o usuario autenticado. ${error.message}`);
  }

  return user?.id ?? null;
}
