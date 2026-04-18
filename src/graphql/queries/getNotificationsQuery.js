import { gql } from '@apollo/client';

const GET_NOTIFICATIONS_QUERY = gql`
  query GetNotifications($appId: Int, $userId: Int) {
    notifications(app_id: $appId, user_id: $userId) {
      id
      title
      body
      type
      created_at
      order_id
      app_id
      user_id
    }
  }
`;

export default GET_NOTIFICATIONS_QUERY;
