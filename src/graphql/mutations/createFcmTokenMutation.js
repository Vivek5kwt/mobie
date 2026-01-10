import { gql } from '@apollo/client';

const CREATE_FCM_TOKEN_MUTATION = gql`
  mutation CreateFcmToken($token: String!, $userid: Int, $appid: Int) {
    createFcmToken(token: $token, userid: $userid, appid: $appid) {
      id
      userid
      appid
      token
      created_at
      updated_at
    }
  }
`;

export default CREATE_FCM_TOKEN_MUTATION;
