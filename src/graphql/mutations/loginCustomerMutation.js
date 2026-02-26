import { gql } from '@apollo/client';

const LOGIN_CUSTOMER_MUTATION = gql`
  mutation LoginCustomer(
    $email: String!
    $password: String!
    $store_id: Int!
  ) {
    loginCustomer(
      email: $email
      password: $password
      store_id: $store_id
    ) {
      message
      token
      customer {
        id
        first_name
        last_name
        email
        device_token
        app_id
        shopify_customer_id
      }
      shopify_customer
      store {
        id
        shopify_domain
        shop_name
        plan_name
      }
    }
  }
`;

export default LOGIN_CUSTOMER_MUTATION;
