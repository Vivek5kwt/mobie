import { gql } from '@apollo/client';

const LOGIN_USER_MUTATION = gql`
  mutation LoginUser($email: String!, $password: String!) {
    loginUser(email: $email, password: $password) {
      user {
        id
        name
        email
        app_id
        user_type
        timezone
        shopify_domain
        status
        created_at
        updated_at
      }
    }
  }
`;

export default LOGIN_USER_MUTATION;
