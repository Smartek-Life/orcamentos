import { useState } from 'react';

interface LoginPageProps {
  loading?: boolean;
  error?: string | null;
  notice?: string | null;
  onSubmit: (payload: { email: string; password: string; mode: 'signin' | 'signup' }) => Promise<void> | void;
}

export function LoginPage({ loading = false, error, notice = null, onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      email: email.trim(),
      password,
      mode,
    });
  };

  return (
    <div className="min-h-screen bg-shell px-6 py-8 text-slateink lg:px-10">
      <div className="mx-auto max-w-[1680px]">
        <header className="mb-8 overflow-hidden rounded-[32px] border border-white/60 bg-slateink px-8 py-10 text-white shadow-soft">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sand">Modo web autenticado</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight">Entre para acessar seus projetos</h1>
            <p className="mt-4 text-base leading-7 text-slate-200">
              A versao web vai usar login por usuario e persistencia em nuvem. O desktop continua funcionando em paralelo.
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-soft">
          <h2 className="text-2xl font-semibold text-slateink">{mode === 'signin' ? 'Login' : 'Criar conta'}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Use email e senha do Supabase. Voce pode entrar com conta existente ou criar uma conta nova.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === 'signin' ? 'bg-white text-slateink shadow-sm' : 'text-slate-500 hover:text-slateink'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === 'signup' ? 'bg-white text-slateink shadow-sm' : 'text-slate-500 hover:text-slateink'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slateink">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-tide"
                placeholder="voce@empresa.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slateink">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-tide"
                placeholder="Sua senha"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
              />
            </label>

            {notice ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
            {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-tide px-5 py-4 text-base font-semibold text-white transition hover:bg-[#124f8f] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? 'Processando...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
