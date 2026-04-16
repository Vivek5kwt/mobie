import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../apollo/client';
import CREATE_USER_MUTATION from '../graphql/mutations/createUserMutation';
import LOGIN_USER_MUTATION from '../graphql/mutations/loginUserMutation';
import { resolveAppId } from '../utils/appId';

type UserProfile = {
  id?: number;
  email: string;
  name?: string;
  appId?: number;
  userType?: string;
  shopifyDomain?: string;
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
const DEFAULT_SHOPIFY_DOMAIN = '5kwebtech-test.myshopify.com';
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
        appId: user.app_id,
        userType: user.user_type,
        timezone: user.timezone,
        shopifyDomain: user.shopify_domain,
        status: user.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        userToken: user.token,
      },
    };

    await saveSession(session);
    return session;
  } catch (error) {
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
    const { data } = await client.mutate<CreateUserResponse>({
      mutation: CREATE_USER_MUTATION,
      variables: {
        name,
        email,
        password,
        status:         DEFAULT_STATUS,
        appId:          resolveAppId(),   // resolved from app.json / env / default
        userType:       DEFAULT_USER_TYPE,
        shopifyDomain:  DEFAULT_SHOPIFY_DOMAIN,
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
        appId:          returnedUser.app_id ?? resolveAppId(),
        userType:       returnedUser.user_type,
        shopifyDomain:  returnedUser.shopify_domain,
        status:         returnedUser.status,
        timezone:       returnedUser.timezone,
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
