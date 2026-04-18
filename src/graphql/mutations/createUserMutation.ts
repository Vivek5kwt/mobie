import { gql } from '@apollo/client';

const CREATE_USER_MUTATION = gql`
  mutation CreateUser(
    $name: String!
    $email: String!
    $password: String!
    $shopifyDomain: String
    $appId: Int
    $status: String
    $userType: String
  ) {
    createUser(
      name: $name
      email: $email
      password: $password
      shopify_domain: $shopifyDomain
      app_id: $appId
      status: $status
      user_type: $userType
    ) {
      message
      store {
        user_id
        updated_at
        timezone
        status
      }
      user {
        id
        app_id
        email
        name
        shopify_domain
        status
        timezone
        user_type
        created_at
        updated_at
      }
    }
  }
`;

export default CREATE_USER_MUTATION;
