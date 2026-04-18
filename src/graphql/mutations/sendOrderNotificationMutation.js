import { gql } from '@apollo/client';

/**
 * Triggers an order notification via the backend.
 * The backend uses the stored FCM token to push to the device.
 *
 * Fields: app_id, user_id, title, body, type, order_id
 * type values: 'order_placed' | 'order_purchased' | 'order_canceled'
 */
const CREATE_NOTIFICATION_MUTATION = gql`
  mutation CreateNotification(
    $appId: Int!
    $userId: Int
    $title: String!
    $body: String!
    $type: String!
    $orderId: String
  ) {
    createNotification(
      app_id: $appId
      user_id: $userId
      title: $title
      body: $body
      type: $type
      order_id: $orderId
    ) {
      id
      title
      body
      type
      created_at
    }
  }
`;

export default CREATE_NOTIFICATION_MUTATION;
