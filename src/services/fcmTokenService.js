import client from '../apollo/client';
import CREATE_FCM_TOKEN_MUTATION from '../graphql/mutations/createFcmTokenMutation';
import UPDATE_FCM_TOKEN_MUTATION from '../graphql/mutations/updateFcmTokenMutation';

/**
 * Create a new FCM token record on the backend.
 * userid is optional (nullable Int) — call this on app launch before the user logs in.
 */
export const createFcmToken = async ({ token, userid = null, appid = null }) => {
  if (!token) {
    throw new Error('FCM token is required');
  }

  const { data } = await client.mutate({
    mutation: CREATE_FCM_TOKEN_MUTATION,
    variables: {
      token,
      userid: userid ? Number(userid) : null,
      appid: appid ? Number(appid) : null,
    },
    errorPolicy: 'all',
  });

  return data?.createFcmToken;
};

/**
 * Update an existing FCM token record with user/app info (call after login).
 * @param {string|number} id  - The FCM record ID returned by createFcmToken
 */
export const updateFcmToken = async ({ id, token, userid, appid }) => {
  if (!id) {
    throw new Error('FCM record id is required for update');
  }

  const { data } = await client.mutate({
    mutation: UPDATE_FCM_TOKEN_MUTATION,
    variables: {
      updateFcmTokenId: String(id),
      token: token || undefined,
      userid: userid ? Number(userid) : null,
      appid: appid ? Number(appid) : null,
    },
    errorPolicy: 'all',
  });

  return data?.updateFcmToken;
};
