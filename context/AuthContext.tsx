import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { User } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordRecovery: (password: string) => Promise<void>;
  cancelVerification: () => void;
  cancelPasswordRecovery: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  verificationPendingEmail: string | null;
  isPasswordRecovery: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const GUEST_SESSION_KEY = 'arcade_guest_session';
const ADMIN_LOGIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '');

const defaultAvatar = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

const removeLegacyPasswordStorage = () => {
  window.localStorage.removeItem('arcade_users');
  window.localStorage.removeItem('arcade_session');
};

const loadPlayer = async (authUser: SupabaseUser): Promise<User> => {
  const supabase = getSupabase();
  const [{ data: profile, error: profileError }, { data: adminAssignment, error: adminError }] = await Promise.all([
    supabase.from('profiles').select('display_name, bio, avatar_url, created_at').eq('id', authUser.id).maybeSingle(),
    supabase.from('admin_users').select('user_id').eq('user_id', authUser.id).maybeSingle(),
  ]);

  if (profileError) throw profileError;
  if (adminError) throw adminError;

  const username = profile?.display_name || String(authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Player');
  return {
    id: authUser.id,
    username,
    email: authUser.email || '',
    isVerified: Boolean(authUser.email_confirmed_at),
    avatar: profile?.avatar_url || defaultAvatar(username),
    bio: profile?.bio || '',
    joinedAt: profile?.created_at || authUser.created_at,
    isAdmin: Boolean(adminAssignment),
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    removeLegacyPasswordStorage();
    const guest = window.localStorage.getItem(GUEST_SESSION_KEY);

    if (!isSupabaseConfigured) {
      if (guest) setUser(JSON.parse(guest));
      setIsLoading(false);
      return;
    }

    const supabase = getSupabase();
    let active = true;

    const applyAuthUser = async (authUser: SupabaseUser | null) => {
      if (!active) return;
      if (!authUser) {
        setUser(guest ? JSON.parse(guest) : null);
        setIsLoading(false);
        return;
      }

      try {
        const player = await loadPlayer(authUser);
        if (active) setUser(player);
      } catch (error) {
        console.error('Unable to load player profile', error);
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) console.error('Unable to restore session', error);
      return applyAuthUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) window.localStorage.removeItem(GUEST_SESSION_KEY);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      void applyAuthUser(session?.user ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const normalized = identifier.trim().toLowerCase();
      if (normalized === 'admin' && !ADMIN_LOGIN_EMAIL) {
        throw new Error('The administrator login alias is not configured.');
      }
      const email = normalized === 'admin' ? ADMIN_LOGIN_EMAIL : normalized;
      if (!email.includes('@')) throw new Error('Use your email address to sign in. The administrator may use “admin”.');

      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Sign in did not return a user.');
      window.localStorage.removeItem(GUEST_SESSION_KEY);
      setUser(await loadPlayer(data.user));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginAsGuest = useCallback(async () => {
    const guestUser: User = {
      id: `guest_${crypto.randomUUID()}`,
      username: 'Guest Player',
      email: '',
      isVerified: true,
      avatar: defaultAvatar(crypto.randomUUID()),
      bio: 'Just passing through...',
      joinedAt: new Date().toISOString(),
      isGuest: true,
      isAdmin: false,
    };
    window.localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guestUser));
    setUser(guestUser);
  }, []);

  const signup = useCallback(async (username: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { display_name: username.trim() }, emailRedirectTo: redirectTo },
      });
      if (error) throw error;

      if (data.session && data.user) {
        setUser(await loadPlayer(data.user));
      } else {
        setVerificationPendingEmail(email.trim().toLowerCase());
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
    const { error } = await getSupabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } });
    if (error) throw error;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    // GitHub Pages serves this app as a static single-page site, so use a query
    // parameter instead of a nested path that would otherwise return a 404.
    const redirectTo = new URL(`${import.meta.env.BASE_URL}?password-recovery=1`, window.location.origin).toString();
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    if (error) throw error;
  }, []);

  const completePasswordRecovery = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw error;
    setIsPasswordRecovery(false);
    const { error: signOutError } = await getSupabase().auth.signOut();
    if (signOutError) console.error('Unable to end password recovery session', signOutError);
    setUser(null);
  }, []);

  const cancelVerification = useCallback(() => setVerificationPendingEmail(null), []);

  const cancelPasswordRecovery = useCallback(async () => {
    setIsPasswordRecovery(false);
    const { error } = await getSupabase().auth.signOut();
    if (error) console.error('Unable to end password recovery session', error);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    window.localStorage.removeItem(GUEST_SESSION_KEY);
    if (isSupabaseConfigured) {
      const { error } = await getSupabase().auth.signOut();
      if (error) console.error('Unable to end Supabase session', error);
    }
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user || user.isGuest) return;
    const updates = {
      display_name: data.username ?? user.username,
      bio: data.bio ?? user.bio ?? null,
      avatar_url: data.avatar ?? user.avatar ?? null,
      last_seen_at: new Date().toISOString(),
    };
    const { error } = await getSupabase().from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;
    setUser((current) => current ? { ...current, ...data } : current);
  }, [user]);

  const changePassword = useCallback(async (password: string) => {
    if (!user || user.isGuest) throw new Error('Guest accounts do not have passwords.');
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw error;
  }, [user]);

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    loginAsGuest,
    signup,
    resendVerification,
    requestPasswordReset,
    completePasswordRecovery,
    cancelVerification,
    cancelPasswordRecovery,
    logout,
    updateProfile,
    changePassword,
    verificationPendingEmail,
    isPasswordRecovery,
  }), [cancelPasswordRecovery, cancelVerification, changePassword, completePasswordRecovery, isLoading, isPasswordRecovery, login, loginAsGuest, logout, requestPasswordReset, resendVerification, signup, updateProfile, user, verificationPendingEmail]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
