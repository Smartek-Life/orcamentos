import { getSupabaseClient } from './supabase';

export interface ProjectSummary {
  id: string;
  projectKey: string;
  fileName: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
}

export async function listUserProjects(): Promise<ProjectSummary[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id, project_key, file_name, title, updated_at, created_at')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Falha ao listar projetos. ${error.message}`);
  }

  return (data ?? []).map((item) => ({
    id: item.id as string,
    projectKey: item.project_key as string,
    fileName: item.file_name as string,
    title: (item.title as string | null) ?? null,
    updatedAt: item.updated_at as string,
    createdAt: item.created_at as string,
  }));
}

export async function deleteUserProject(projectId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }

  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) {
    throw new Error(`Falha ao excluir projeto. ${error.message}`);
  }

  return { deleted: true };
}
