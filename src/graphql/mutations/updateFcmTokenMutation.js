import { gql } from '@apollo/client';

const UPDATE_FCM_TOKEN_MUTATION = gql`
  mutation UpdateFcmToken($updateFcmTokenId: ID!, $userid: Int, $token: String, $appid: Int) {
    updateFcmToken(id: $updateFcmTokenId, userid: $userid, token: $token, appid: $appid) {
      id
      userid
      appid
      token
      created_at
      updated_at
    }
  }
`;

export default UPDATE_FCM_TOKEN_MUTATION;
