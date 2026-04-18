import client from '../apollo/client';
import CREATE_FCM_TOKEN_MUTATION from '../graphql/mutations/createFcmTokenMutation';
import UPDATE_FCM_TOKEN_MUTATION from '../graphql/mutations/updateFcmTokenMutation';

/**
 * Call the createFcmToken mutation and return the backend record.
 *
 * Throws an Error (with the server's own message) if:
 *   - token is missing
 *   - the server returns GraphQL errors
 *   - the network request fails
 */
export const createFcmToken = async ({ token, userid = null, appid = null }) => {
  if (!token) {
    throw new Error('[createFcmToken] token is required');
  }

  const variables = {
    token,
    userid: userid ? Number(userid) : null,
    appid:  appid  ? Number(appid)  : null,
  };

  console.log('[FCM] ▶ createFcmToken variables:', JSON.stringify(variables));

  // errorPolicy:'all' means Apollo does NOT throw on GraphQL errors — we must
  // check the `errors` array ourselves.
  const { data, errors } = await client.mutate({
    mutation:    CREATE_FCM_TOKEN_MUTATION,
    variables,
    errorPolicy: 'all',
  });

  // Surface GraphQL errors clearly instead of silently returning null
  if (errors?.length) {
    const msg = errors.map((e) => e.message).join(' | ');
    console.error('[FCM] ✖ createFcmToken GraphQL errors:', msg);
    throw new Error(`createFcmToken failed: ${msg}`);
  }

  if (!data?.createFcmToken) {
    console.warn('[FCM] ⚠ createFcmToken: mutation returned no data');
    return null;
  }

  console.log('[FCM] ✔ createFcmToken response:', JSON.stringify(data.createFcmToken));
  return data.createFcmToken;
};

/**
 * Call the updateFcmToken mutation to patch an existing FCM record
 * (used after login to associate the token with a user id).
 */
export const updateFcmToken = async ({ id, token, userid, appid }) => {
  if (!id) {
    throw new Error('[updateFcmToken] record id is required');
  }

  const variables = {
    updateFcmTokenId: String(id),
    token:  token  || undefined,
    userid: userid ? Number(userid) : null,
    appid:  appid  ? Number(appid)  : null,
  };

  console.log('[FCM] ▶ updateFcmToken variables:', JSON.stringify(variables));

  const { data, errors } = await client.mutate({
    mutation:    UPDATE_FCM_TOKEN_MUTATION,
    variables,
    errorPolicy: 'all',
  });

  if (errors?.length) {
    const msg = errors.map((e) => e.message).join(' | ');
    console.error('[FCM] ✖ updateFcmToken GraphQL errors:', msg);
    throw new Error(`updateFcmToken failed: ${msg}`);
  }

  if (!data?.updateFcmToken) {
    console.warn('[FCM] ⚠ updateFcmToken: mutation returned no data');
    return null;
  }

  console.log('[FCM] ✔ updateFcmToken response:', JSON.stringify(data.updateFcmToken));
  return data.updateFcmToken;
};
