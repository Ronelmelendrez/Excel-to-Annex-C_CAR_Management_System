import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../shared/supabase';

type Profile = {
  id: string;
  display_name: string | null;
  status: 'active' | 'disabled';
};

type AuthContextType = {
  session: any;
  user: any;
  profile: Profile | null;
  roles: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch profile + roles without committing them to state.
  // Returns raw data so the caller can decide whether to accept the session
  // (e.g. reject if the profile is disabled).
  async function fetchProfileAndRoles(userId: string) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, display_name, status')
      .eq('id', userId)
      .maybeSingle();
    const profile = (profileData ?? null) as Profile | null;

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const userRoles = (rolesData || []).map((r: any) => r.role) as string[];

    return { profile, roles: userRoles };
  }

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        const { profile: p, roles: r } = await fetchProfileAndRoles(session.user.id);
        if (!mounted) return;

        if (p?.status === 'disabled') {
          // CRITICAL: a disabled account must not get a session, even a
          // pre-existing one restored from storage on page load.
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          setProfile(p);
          setRoles(r);
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setRoles([]);
      }
      setLoading(false);
    }
    loadInitial();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (session?.user) {
          const { profile: p, roles: r } = await fetchProfileAndRoles(session.user.id);
          if (!mounted) return;

          // CRITICAL: block disabled accounts on every auth state change.
          if (p?.status === 'disabled') {
            await supabase.auth.signOut();
            return; // Do NOT persist the session in state.
          }

          setSession(session);
          setUser(session?.user ?? null);
          setProfile(p);
          setRoles(r);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, roles, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
