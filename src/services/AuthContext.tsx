import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { AuthSession, clearSession, login, recoverPassword, restoreSession, signup } from './authService';
import { clearCart } from '../store/slices/cartSlice';
import { setWishlistUser } from '../store/slices/wishlistSlice';
import tokenLogger from '../utils/tokenLogger';
import { setAnalyticsUser, trackAnalyticsEvent } from './analyticsService';
import { triggerCampaign } from './notificationService';

export type AuthContextValue = {
  session: AuthSession | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  recoverPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const dispatch = useDispatch();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedSession = await restoreSession();
        if (storedSession) {
          setSession(storedSession);
          dispatch(setWishlistUser({ session: storedSession }));
          setAnalyticsUser(storedSession).catch(() => {});
          // customers.id, not users.id — see UserProfile.customerId in
          // authService.ts for why these are different tables.
          if (storedSession?.user?.customerId) {
            tokenLogger
              .updateTokenForUser(storedSession.user.customerId, storedSession.user.appId)
              .catch(() => {});
          }
        } else {
          dispatch(setWishlistUser({ session: null }));
          dispatch(clearCart());
        }
      } finally {
        setInitializing(false);
      }
    };

    bootstrap();
  }, [dispatch]);

  const handleLogin = useCallback(async (email: string, password: string) => {
    const newSession = await login(email, password);
    setSession(newSession);
    dispatch(setWishlistUser({ session: newSession }));
    setAnalyticsUser(newSession).catch(() => {});
    trackAnalyticsEvent('login', {
      method: 'email',
      user_type: newSession?.user?.userType || '',
    }, { session: newSession }).catch(() => {});
    // Associate FCM token with the logged-in customer (customers.id, not
    // users.id — see UserProfile.customerId in authService.ts).
    if (newSession?.user?.customerId) {
      tokenLogger.updateTokenForUser(newSession.user.customerId, newSession.user.appId).catch(() => {});
    }
  }, [dispatch, session]);

  const handleSignup = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const newSession = await signup(email, password, fullName);
      setSession(newSession);
      dispatch(setWishlistUser({ session: newSession }));
      setAnalyticsUser(newSession).catch(() => {});
      trackAnalyticsEvent('sign_up', {
        method: 'email',
        user_type: newSession?.user?.userType || '',
      }, { session: newSession }).catch(() => {});
      // Associate FCM token with the newly registered customer (customers.id,
      // not users.id — see UserProfile.customerId in authService.ts), then
      // fire the store's "welcome" automated campaign for them if one is
      // active. Must wait for the FCM association to land server-side first
      // — triggerCampaign looks up saved tokens by this same customer id,
      // so firing it in parallel would race an empty token list.
      if (newSession?.user?.customerId) {
        await tokenLogger
          .updateTokenForUser(newSession.user.customerId, newSession.user.appId)
          .catch(() => {});
        if (newSession?.user?.storeId) {
          triggerCampaign({
            storeId: newSession.user.storeId,
            userId: newSession.user.customerId,
            autoType: 'welcome',
            appId: newSession.user.appId,
          }).catch(() => {});
        }
      }
    },
    [dispatch]
  );

  const handleRecoverPassword = useCallback(async (email: string) => {
    await recoverPassword(email);
  }, []);

  const handleLogout = useCallback(async () => {
    dispatch(clearCart());
    await clearSession();
    trackAnalyticsEvent('logout', {}, { session }).catch(() => {});
    setAnalyticsUser(null).catch(() => {});
    setSession(null);
    dispatch(setWishlistUser({ session: null }));
    // Clear stored FCM record ID so next login gets a fresh token association
    tokenLogger.clearToken().catch(() => {});
  }, [dispatch, session]);

  const value = useMemo(
    () => ({
      session,
      initializing,
      login: handleLogin,
      signup: handleSignup,
      recoverPassword: handleRecoverPassword,
      logout: handleLogout,
    }),
    [session, initializing, handleLogin, handleSignup, handleRecoverPassword, handleLogout]
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
