import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AuthSession, clearSession, login, restoreSession, signup } from './authService';
import tokenLogger from '../utils/tokenLogger';

export type AuthContextValue = {
  session: AuthSession | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedSession = await restoreSession();
        if (storedSession) {
          setSession(storedSession);
        }
      } finally {
        setInitializing(false);
      }
    };

    bootstrap();
  }, []);

  const handleLogin = useCallback(async (email: string, password: string) => {
    const newSession = await login(email, password);
    setSession(newSession);
    // Associate FCM token with the logged-in user
    if (newSession?.user?.id) {
      tokenLogger.updateTokenForUser(newSession.user.id, newSession.user.appId).catch(() => {});
    }
  }, []);

  const handleSignup = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const newSession = await signup(email, password, fullName);
      setSession(newSession);
      // Associate FCM token with the newly registered user
      if (newSession?.user?.id) {
        tokenLogger.updateTokenForUser(newSession.user.id, newSession.user.appId).catch(() => {});
      }
    },
    []
  );

  const handleLogout = useCallback(async () => {
    await clearSession();
    setSession(null);
    // Clear stored FCM record ID so next login gets a fresh token association
    tokenLogger.clearToken().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ session, initializing, login: handleLogin, signup: handleSignup, logout: handleLogout }),
    [session, initializing, handleLogin, handleSignup, handleLogout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthProvider;
