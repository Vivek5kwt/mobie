import client from '../apollo/client';
import CREATE_FCM_TOKEN_MUTATION from '../graphql/mutations/createFcmTokenMutation';

export const createFcmToken = async ({ token, userid, appid }) => {
  try {
    // Validate required fields before making the request
    if (!token) {
      throw new Error('FCM token is required');
    }
    
    if (!userid) {
      throw new Error('userid is required for FCM token creation');
    }

    const { data } = await client.mutate({
      mutation: CREATE_FCM_TOKEN_MUTATION,
      variables: {
        token,
        userid,
        appid
      },
      // Don't throw errors - let the caller handle them
      errorPolicy: 'all'
    });

    return data?.createFcmToken;
  } catch (error) {
    // Re-throw with more context
    console.log('❌ createFcmToken service error:', error.message);
    throw error;
  }
};
