import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../apollo/client';
import CREATE_USER_MUTATION from '../graphql/mutations/createUserMutation';
import LOGIN_USER_MUTATION from '../graphql/mutations/loginUserMutation';
import { resolveAppId } from '../utils/appId';
import { fetchStoreConfig } from './storeService';
import { loginCustomer } from './customerService';
import { registerCustomer } from './customerService';

type UserProfile = {
  id?: number;
  email: string;
  name?: string;
  appId?: number;
  storeId?: number;
  storeUserId?: number;
  userType?: string;
  shopifyDomain?: string;
  storefrontAccessToken?: string;
  storeAccessToken?: string;
  shopName?: string;
  currency?: string;
  country?: string;
  planName?: string;
  onboarding?: boolean;
  status?: string;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
  userToken?: string;
};

export type AuthSession = {
  token: string;
  user: UserProfile;
};

const TOKEN_KEY = '@auth_jwt_token';
const USER_KEY = '@auth_user_profile';
const DEFAULT_USER_TYPE = 'mobile';
const DEFAULT_STATUS = 'active';
const generateToken = () => `jwt-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const wait = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

const saveSession = async (session: AuthSession) => {
  await AsyncStorage.setItem(TOKEN_KEY, session.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(session.user));
};

type CreateUserResponse = {
  createUser?: {
    message?: string;
    store?: {
      user_id?: number;
      updated_at?: string;
      timezone?: string;
      status?: string;
    };
    user?: {
      id?: string;
      app_id?: number;
      email?: string;
      name?: string;
      shopify_domain?: string;
      status?: string;
      timezone?: string;
      user_type?: string;
      created_at?: string;
      updated_at?: string;
    };
  };
};

type LoginUserResponse = {
  loginUser?: {
    token?: string;
    user?: {
      id?: number;
      email?: string;
      name?: string;
      app_id?: number;
      user_type?: string;
      timezone?: string;
      shopify_domain?: string;
      status?: string;
      token?: string;
      created_at?: string;
      updated_at?: string;
    };
  };
};

export const restoreSession = async (): Promise<AuthSession | null> => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const userRaw = await AsyncStorage.getItem(USER_KEY);

  if (!token) return null;

  let user: UserProfile = { email: '' };
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as UserProfile;
    } catch (error) {
      user = { email: '' };
    }
  }

  return { token, user };
};

export const clearSession = async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
};  


export const login = async (email: string, password: string): Promise<AuthSession> => {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const liveStore = await fetchStoreConfig();
  try {
    const { data } = await client.mutate<LoginUserResponse>({
      mutation: LOGIN_USER_MUTATION,
      variables: { email, password },
    });

    const payload = data?.loginUser;
    const user = payload?.user;

    if (!user?.email) {
      throw new Error('Invalid email or password.');
    }

    const sessionToken = payload?.token || generateToken();

    const session: AuthSession = {
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        appId: user.app_id ?? resolveAppId(),
        storeId: liveStore?.id ? Number(liveStore.id) : undefined,
        storeUserId: liveStore?.user_id ? Number(liveStore.user_id) : undefined,
        userType: user.user_type,
        timezone: user.timezone ?? liveStore?.timezone,
        shopifyDomain: user.shopify_domain ?? liveStore?.shopify_domain,
        storefrontAccessToken: liveStore?.storefront_access_token,
        storeAccessToken: liveStore?.access_token,
        shopName: liveStore?.shop_name,
        currency: liveStore?.currency,
        country: liveStore?.country,
        planName: liveStore?.plan_name,
        onboarding: Boolean(liveStore?.onboarding),
        status: user.status ?? liveStore?.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        userToken: user.token,
      },
    };

    await saveSession(session);
    return session;
  } catch (error) {
    const resolvedStoreId = liveStore?.id ? Number(liveStore.id) : 0;
    if (resolvedStoreId > 0) {
      try {
        const customerPayload = await loginCustomer({
          email,
          password,
          store_id: resolvedStoreId,
        });
        const customer = customerPayload?.customer || {};
        const fallbackToken = customerPayload?.token || generateToken();
        const firstName = customer?.first_name || '';
        const lastName = customer?.last_name || '';
        const session: AuthSession = {
          token: fallbackToken,
          user: {
            id: customer?.id ? Number(customer.id) : undefined,
            email: customer?.email || email,
            name: `${firstName} ${lastName}`.trim() || customer?.email || email,
            appId: customer?.app_id ?? resolveAppId(),
            storeId: resolvedStoreId,
            storeUserId: liveStore?.user_id ? Number(liveStore.user_id) : undefined,
            userType: 'customer',
            timezone: liveStore?.timezone,
            shopifyDomain: customerPayload?.store?.shopify_domain ?? liveStore?.shopify_domain,
            storefrontAccessToken: liveStore?.storefront_access_token,
            storeAccessToken: liveStore?.access_token,
            shopName: customerPayload?.store?.shop_name ?? liveStore?.shop_name,
            currency: liveStore?.currency,
            country: liveStore?.country,
            planName: customerPayload?.store?.plan_name ?? liveStore?.plan_name,
            onboarding: Boolean(liveStore?.onboarding),
            status: liveStore?.status,
            userToken: customerPayload?.token,
          },
        };
        await saveSession(session);
        return session;
      } catch (_customerLoginError) {
        // fall through to common error handling
      }
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to login.');
  }
};

export const signup = async (
  email: string,
  password: string,
  fullName?: string
): Promise<AuthSession> => {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const name = fullName?.trim() || email.split('@')[0];

  try {
    const liveStore = await fetchStoreConfig();
    const resolvedShopifyDomain = liveStore?.shopify_domain || undefined;
    const resolvedAppId = resolveAppId();
    const resolvedStoreId = liveStore?.id ? Number(liveStore.id) : 0;

    if (resolvedStoreId > 0) {
      const parts = name.split(/\s+/).filter(Boolean);
      const firstName = parts[0] || name;
      const lastName = parts.slice(1).join(' ') || '.';
      try {
        await registerCustomer({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          store_id: resolvedStoreId,
          app_id: resolvedAppId,
        });
      } catch (_customerRegisterError) {
        // Keep app signup path resilient even if customer registration is already present.
      }
    }

    const { data } = await client.mutate<CreateUserResponse>({
      mutation: CREATE_USER_MUTATION,
      variables: {
        name,
        email,
        password,
        status:         DEFAULT_STATUS,
        appId:          resolvedAppId,
        userType:       DEFAULT_USER_TYPE,
        shopifyDomain:  resolvedShopifyDomain,
      },
    });

    const payload = data?.createUser;

    // Mutation must return a success message and a user with an id
    if (!payload?.message) {
      throw new Error('Unable to create account.');
    }
    if (!payload?.user?.id) {
      throw new Error('Registration succeeded but no user ID was returned.');
    }

    const returnedUser = payload.user;

    const session: AuthSession = {
      token: generateToken(),
      user: {
        id:             Number(returnedUser.id),
        email:          returnedUser.email  || email,
        name:           returnedUser.name   || name,
        appId:          returnedUser.app_id ?? resolvedAppId,
        storeId:        liveStore?.id ? Number(liveStore.id) : undefined,
        storeUserId:    liveStore?.user_id ? Number(liveStore.user_id) : undefined,
        userType:       returnedUser.user_type,
        shopifyDomain:  returnedUser.shopify_domain || resolvedShopifyDomain,
        storefrontAccessToken: liveStore?.storefront_access_token,
        storeAccessToken: liveStore?.access_token,
        shopName:       liveStore?.shop_name,
        currency:       liveStore?.currency,
        country:        liveStore?.country,
        planName:       liveStore?.plan_name,
        onboarding:     Boolean(liveStore?.onboarding),
        status:         returnedUser.status ?? liveStore?.status,
        timezone:       returnedUser.timezone ?? liveStore?.timezone,
        createdAt:      returnedUser.created_at,
        updatedAt:      returnedUser.updated_at,
      },
    };

    await saveSession(session);

    console.log(
      `✅ User created — id: ${session.user.id}, email: ${session.user.email}, appId: ${session.user.appId}`,
    );

    return session;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to create account.');
  }
};
