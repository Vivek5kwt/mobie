import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../apollo/client';
import CREATE_USER_MUTATION from '../graphql/mutations/createUserMutation';

type UserProfile = {
  email: string;
  name?: string;
};

export type AuthSession = {
  token: string;
  user: UserProfile;
};

const TOKEN_KEY = '@auth_jwt_token';
const USER_KEY = '@auth_user_profile';
const DEFAULT_APP_ID = 1;
const DEFAULT_USER_TYPE = 'mobile';
const DEFAULT_STATUS = 'active';
const DEFAULT_SHOPIFY_DOMAIN = 'newmobidrag.myshopify.com';

const wait = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

const saveSession = async (session: AuthSession) => {
  await AsyncStorage.setItem(TOKEN_KEY, session.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(session.user));
};

type CreateUserResponse = {
  createUser?: {
    message?: string;
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

const buildSession = (email: string, name?: string): AuthSession => ({
  token: `jwt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  user: {
    email,
    name: name || email.split('@')[0],
  },
});

export const login = async (email: string, password: string): Promise<AuthSession> => {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  await wait(500);
  const session = buildSession(email);
  await saveSession(session);
  return session;
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
    const { data } = await client.mutate<CreateUserResponse>({
      mutation: CREATE_USER_MUTATION,
      variables: {
        name,
        email,
        password,
        status: DEFAULT_STATUS,
        appId: DEFAULT_APP_ID,
        userType: DEFAULT_USER_TYPE,
        shopifyDomain: DEFAULT_SHOPIFY_DOMAIN,
      },
    });

    const payload = data?.createUser;

    if (!payload?.message) {
      throw new Error(payload?.message || 'Unable to create account.');
    }

    const session = buildSession(email, name);

    await saveSession(session);
    return session;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to create account.');
  }
};
