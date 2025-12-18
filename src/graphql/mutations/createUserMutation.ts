import { gql } from '@apollo/client';

const CREATE_USER_MUTATION = gql`
  mutation CreateUser(
    $name: String!
    $email: String!
    $password: String!
    $status: String
    $appId: Int
    $userType: String
    $shopifyDomain: String
  ) {
    createUser(
      name: $name
      email: $email
      password: $password
      status: $status
      app_id: $appId
      user_type: $userType
      shopify_domain: $shopifyDomain
    ) {
      user {
        shopify_domain
        name
        id
        email
        user_type
        updated_at
        timezone
        status
        created_at
        app_id
      }
      store {
        access_token
        country
        currency
        created_at
        user_id
        updated_at
        timezone
        status
        shopify_domain
        shop_owner
        shop_name
        plan_name
        id
      }
      message
    }
  }
`;

export default CREATE_USER_MUTATION;
