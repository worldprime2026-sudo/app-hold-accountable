import { buildMoneyProfile } from '@/lib/money-profile';
import { supabase } from '@/lib/supabase';
import type { ProfileRow, Questionnaire } from '@/lib/types';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  isLoading: boolean;
  schemaError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside SessionProvider');
  return value;
}

async function loadProfile(userId: string): Promise<{ profile: ProfileRow | null; schemaError: string | null }> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

  if (error) {
    return { profile: null, schemaError: error.message };
  }

  if (!data) {
    const inserted = await supabase.from('profiles').upsert({ id: userId }).select('*').single();
    if (inserted.error) return { profile: null, schemaError: inserted.error.message };
    return { profile: inserted.data as ProfileRow, schemaError: null };
  }

  return { profile: data as ProfileRow, schemaError: null };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    const next = await loadProfile(userId);
    setProfile(next.profile);
    setSchemaError(next.schemaError);
  }, [session?.user.id]);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user.id) {
        const next = await loadProfile(data.session.user.id);
        if (!alive) return;
        setProfile(next.profile);
        setSchemaError(next.schemaError);
      }
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setSchemaError(null);
        setIsLoading(false);
        return;
      }
      loadProfile(nextSession.user.id).then((next) => {
        if (!alive) return;
        setProfile(next.profile);
        setSchemaError(next.schemaError);
      });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      schemaError,
      refreshProfile,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, isLoading, schemaError, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const code = 'code' in error ? String(error.code) : '';
    if (code === '42703' || error.message.includes('does not exist')) {
      return 'Your database is missing new columns. Run supabase/migrate-onboarding.sql in the SQL Editor, then try again.';
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Could not save your profile.';
}

export async function saveOnboarding(userId: string, q: Questionnaire) {
  const moneyProfile = buildMoneyProfile(q);
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    display_name: q.name,
    questionnaire: q,
    money_profile: moneyProfile,
    onboarding_completed: true,
    xp: 120,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(errorMessage(error));
  return moneyProfile;
}

export async function grantLifetimeAccess(userId: string, currentXp: number) {
  const { error } = await supabase
    .from('profiles')
    .update({
      has_lifetime_access: true,
      xp: currentXp + 80,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function consumeQuestion(userId: string, nextAsked: number) {
  const { error } = await supabase
    .from('profiles')
    .update({
      questions_asked: nextAsked,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw new Error(errorMessage(error));
}

export async function saveQuestionnaire(userId: string, q: Questionnaire, xp: number) {
  const moneyProfile = buildMoneyProfile(q);
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: q.name,
      questionnaire: q,
      money_profile: moneyProfile,
      updated_at: new Date().toISOString(),
      xp,
    })
    .eq('id', userId);
  if (error) throw error;
  return moneyProfile;
}
