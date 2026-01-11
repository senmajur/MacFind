/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { hasSupabase, supabase } from '../lib/supabase';
import { ensureUserRow } from '../lib/appUser';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
  isDemo: boolean;
  signIn: (redirectTo?: string) => Promise<void>;
  submitEmail: (email: string) => Promise<void>;
  authDialogOpen: boolean;
  closeAuthDialog: () => void;
  signOut: () => Promise<void>;
  requireLogin: (redirectTo?: string) => boolean;
}

const demoUser: UserProfile = {
  id: 'demo-user',
  email: 'demo@mcmaster.ca',
  name: 'Demo User',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Set to false to temporarily allow any email domain (e.g., for testing)
const enforceMcMasterEmail = true;
const siteUrl =
  (import.meta.env.VITE_SITE_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SITE_URL as string | undefined) ||
  '';

const formatAuthErrorMessage = (raw: unknown) => {
  const fallback = 'Authentication failed. Please try again.';
  if (!raw) return fallback;
  if (typeof raw === 'string') return raw;

  const maybeMessage = (raw as { message?: unknown }).message;
  if (typeof maybeMessage === 'string') {
    try {
      const parsed = JSON.parse(maybeMessage) as { msg?: unknown };
      if (typeof parsed?.msg === 'string') return parsed.msg;
    } catch {
      // ignore non-JSON messages
    }
    return maybeMessage;
  }
  return fallback;
};

const makeHelpfulAuthMessage = (message: string) => {
  if (message.toLowerCase().includes('unsupported provider')) {
    return "Supabase Auth provider isn't enabled. Enable Email auth in Supabase Dashboard -> Authentication -> Providers -> Email, then try again.";
  }
  return message;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const mapSessionUser = (sessionUser: unknown): UserProfile | null => {
  if (!isRecord(sessionUser)) return null;
  const id = typeof sessionUser.id === 'string' ? sessionUser.id : null;
  if (!id) return null;
  const email = typeof sessionUser.email === 'string' ? sessionUser.email : '';

  let name: string | null = null;
  if (isRecord(sessionUser.user_metadata)) {
    const fullName = sessionUser.user_metadata.full_name;
    const shortName = sessionUser.user_metadata.name;
    if (typeof fullName === 'string') name = fullName;
    else if (typeof shortName === 'string') name = shortName;
  }

  return {
    id,
    email,
    name: name ?? email,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(!hasSupabase);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [pendingRedirectTo, setPendingRedirectTo] = useState<string | null>(
    null,
  );
  const ensuredUserIdsRef = useRef(new Set<string>());
  const ensureAttemptedAtRef = useRef(new Map<string, number>());

  const ensureAppUser = useCallback(async (profile: UserProfile | null) => {
    if (!supabase || !profile?.id) return;
    if (ensuredUserIdsRef.current.has(profile.id)) return;

    const now = Date.now();
    const lastAttempt = ensureAttemptedAtRef.current.get(profile.id) ?? 0;
    if (now - lastAttempt < 10_000) return;
    ensureAttemptedAtRef.current.set(profile.id, now);

    const ok = await ensureUserRow(supabase, profile, 'users');
    if (ok) ensuredUserIdsRef.current.add(profile.id);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const bootstrap = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const client = supabase;

      const sessionResult = await client.auth.getSession();
      const sessionUser = sessionResult.data.session?.user ?? null;
      const nextUser = mapSessionUser(sessionUser);

      if (
        enforceMcMasterEmail &&
        nextUser &&
        !nextUser.email.toLowerCase().endsWith('@mcmaster.ca')
      ) {
        setError('McMaster email required (MacID@mcmaster.ca).');
        await client.auth.signOut();
        setUser(null);
      } else {
        setUser(nextUser);
        void ensureAppUser(nextUser);
      }
      setLoading(false);

      const { data: authListener } = client.auth.onAuthStateChange(
        async (_event, session) => {
          const latestUser = mapSessionUser(session?.user ?? null);
          if (
            enforceMcMasterEmail &&
            latestUser &&
            !latestUser.email.toLowerCase().endsWith('@mcmaster.ca')
          ) {
            setError('McMaster email required (MacID@mcmaster.ca).');
            await client.auth.signOut();
            setUser(null);
            return;
          }
          setUser(latestUser);
          void ensureAppUser(latestUser);
        },
      );

      cleanup = () => authListener?.subscription.unsubscribe();
    };

    void bootstrap();
    return () => cleanup?.();
  }, [ensureAppUser]);

  const buildRedirectUrl = useCallback((redirectTo?: string) => {
    const base = window.location.origin;
    const redirectParam = redirectTo
      ? `?redirect=${encodeURIComponent(redirectTo)}`
      : '';
    return `${base}/${redirectParam}`;
  }, []);

  const signIn = useCallback(
    async (redirectTo?: string) => {
      setError(null);
      setNotice(null);
      if (!supabase) {
        setUser(demoUser);
        setIsDemo(true);
        return;
      }
      setPendingRedirectTo(redirectTo ?? null);
      setAuthDialogOpen(true);
    },
    [],
  );

  const closeAuthDialog = useCallback(() => {
    setAuthDialogOpen(false);
    setPendingRedirectTo(null);
  }, []);

  const submitEmail = useCallback(
    async (email: string) => {
      setError(null);
      setNotice(null);

      const cleanedEmail = email.trim().toLowerCase();
      if (!cleanedEmail) return;
      if (enforceMcMasterEmail && !cleanedEmail.endsWith('@mcmaster.ca')) {
        setError('McMaster email required (MacID@mcmaster.ca).');
        return;
      }

      if (!supabase) {
        setUser({
          id: crypto.randomUUID(),
          email: cleanedEmail,
          name: cleanedEmail,
        });
        setIsDemo(true);
        closeAuthDialog();
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanedEmail,
        options: {
          emailRedirectTo: buildRedirectUrl(pendingRedirectTo ?? undefined),
        },
      });

      if (otpError) {
        const raw = formatAuthErrorMessage(otpError);
        setError(makeHelpfulAuthMessage(raw));
        return;
      }

      setNotice(
        `Magic link sent to ${cleanedEmail}. Check your email to finish sign-in.`,
      );
      closeAuthDialog();
    },
    [buildRedirectUrl, closeAuthDialog, pendingRedirectTo],
  );

  const signOut = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!supabase) {
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const requireLogin = useCallback(
    (redirectTo?: string) => {
      if (!user) {
        if (!supabase) {
          setUser(demoUser);
          setIsDemo(true);
          return true;
        }
        void signIn(redirectTo);
        return false;
      }
      return true;
    },
    [signIn, user],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      notice,
      isDemo,
      signIn,
      submitEmail,
      authDialogOpen,
      closeAuthDialog,
      signOut,
      requireLogin,
    }),
    [
      user,
      loading,
      error,
      notice,
      isDemo,
      signIn,
      submitEmail,
      authDialogOpen,
      closeAuthDialog,
      signOut,
      requireLogin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
