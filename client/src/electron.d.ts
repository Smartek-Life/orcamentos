export {};

declare global {
  interface Window {
    desktopApi?: {
      exportProjectPdf: (payload: { html: string; fileName: string }) => Promise<{ canceled: boolean; filePath?: string }>;
      loadProjectState: (projectKey: string) => Promise<unknown>;
      saveProjectState: (state: unknown) => Promise<{ filePath?: string }>;
      clearProjectState: (projectKey: string) => Promise<{ cleared: boolean }>;
    };
  }
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
