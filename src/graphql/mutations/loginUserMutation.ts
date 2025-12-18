import { gql } from '@apollo/client';

const LOGIN_USER_MUTATION = gql`
  mutation LoginUser($email: String!, $password: String!) {
    loginUser(email: $email, password: $password) {
      token
      user {
        id
        name
        email
        app_id
        user_type
        shopify_domain
        status
        token
        created_at
        updated_at
      }
    }
  }
`;

export default LOGIN_USER_MUTATION;
