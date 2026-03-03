import { gql } from '@apollo/client';

const REGISTER_CUSTOMER_MUTATION = gql`
  mutation RegisterCustomer(
    $first_name: String!
    $last_name: String!
    $email: String!
    $password: String!
    $store_id: Int!
    $app_id: Int!
    $device_token: String
  ) {
    registerCustomer(
      first_name: $first_name
      last_name: $last_name
      email: $email
      password: $password
      store_id: $store_id
      app_id: $app_id
      device_token: $device_token
    ) {
      id
      first_name
      last_name
      email
      store_id
      app_id
      shopify_customer_id
    }
  }
`;

export default REGISTER_CUSTOMER_MUTATION;
