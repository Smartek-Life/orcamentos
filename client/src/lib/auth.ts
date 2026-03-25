import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isDesktopRuntime, isSupabaseConfigured } from './supabase';

export function isWebAuthEnabled() {
  return !isDesktopRuntime && isSupabaseConfigured;
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase nao configurado para login web.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signUpWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase nao configurado para cadastro web.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signOutCurrentUser() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => undefined;
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => {
    subscription.unsubscribe();
  };
}
