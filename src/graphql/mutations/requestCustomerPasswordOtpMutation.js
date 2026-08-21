import { gql } from '@apollo/client';

const REQUEST_CUSTOMER_PASSWORD_OTP_MUTATION = gql`
  mutation RequestCustomerPasswordOtp($email: String!, $store_id: Int!) {
    requestCustomerPasswordOtp(email: $email, store_id: $store_id) {
      success
      message
    }
  }
`;

export default REQUEST_CUSTOMER_PASSWORD_OTP_MUTATION;
