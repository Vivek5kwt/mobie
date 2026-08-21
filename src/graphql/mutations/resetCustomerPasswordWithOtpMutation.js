import { gql } from '@apollo/client';

const RESET_CUSTOMER_PASSWORD_WITH_OTP_MUTATION = gql`
  mutation ResetCustomerPasswordWithOtp(
    $email: String!
    $store_id: Int!
    $otp: String!
    $newPassword: String!
  ) {
    resetCustomerPasswordWithOtp(
      email: $email
      store_id: $store_id
      otp: $otp
      newPassword: $newPassword
    ) {
      success
      message
    }
  }
`;

export default RESET_CUSTOMER_PASSWORD_WITH_OTP_MUTATION;
