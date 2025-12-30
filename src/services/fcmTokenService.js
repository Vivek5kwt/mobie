import client from '../apollo/client';
import CREATE_FCM_TOKEN_MUTATION from '../graphql/mutations/createFcmTokenMutation';

export const createFcmToken = async ({ token, userid, appid }) => {
  const { data } = await client.mutate({
    mutation: CREATE_FCM_TOKEN_MUTATION,
    variables: {
      token,
      userid,
      appid
    }
  });

  return data?.createFcmToken;
};
