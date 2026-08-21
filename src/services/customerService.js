import client from '../apollo/client';
import REGISTER_CUSTOMER_MUTATION from '../graphql/mutations/registerCustomerMutation';
import LOGIN_CUSTOMER_MUTATION from '../graphql/mutations/loginCustomerMutation';
import REQUEST_CUSTOMER_PASSWORD_OTP_MUTATION from '../graphql/mutations/requestCustomerPasswordOtpMutation';
import RESET_CUSTOMER_PASSWORD_WITH_OTP_MUTATION from '../graphql/mutations/resetCustomerPasswordWithOtpMutation';

/**
 * Register a new customer
 * @param {Object} params - Customer registration parameters
 * @param {string} params.first_name - Customer's first name
 * @param {string} params.last_name - Customer's last name
 * @param {string} params.email - Customer's email address
 * @param {string} params.password - Customer's password
 * @param {number} params.store_id - Store ID
 * @param {number} params.app_id - App ID
 * @param {string} [params.device_token] - Optional FCM device token
 * @returns {Promise<Object>} Registered customer data
 */
export const registerCustomer = async ({
  first_name,
  last_name,
  email,
  password,
  store_id,
  app_id,
  device_token,
}) => {
  if (!first_name || !last_name || !email || !password || !store_id || !app_id) {
    throw new Error('Missing required fields: first_name, last_name, email, password, store_id, and app_id are required.');
  }

  try {
    const { data, errors } = await client.mutate({
      mutation: REGISTER_CUSTOMER_MUTATION,
      variables: {
        first_name,
        last_name,
        email,
        password,
        store_id,
        app_id,
        device_token: device_token || null,
      },
      errorPolicy: 'all',
    });

    // errorPolicy: 'all' returns GraphQL errors in `errors` instead of
    // throwing — reading only `data` and ignoring `errors` meant a real
    // server-thrown message (e.g. "Email already registered") never reached
    // the caller, replaced by the generic message below.
    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message || 'Failed to register customer.');
    }

    if (!data?.registerCustomer) {
      throw new Error('Failed to register customer. No data returned.');
    }

    return data.registerCustomer;
  } catch (error) {
    console.error('❌ registerCustomer error:', error);
    
    // Extract error message from GraphQL error
    if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
      const graphQLError = error.graphQLErrors[0];
      throw new Error(graphQLError.message || 'Failed to register customer.');
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to register customer.');
  }
};

/**
 * Login a customer
 * @param {Object} params - Customer login parameters
 * @param {string} params.email - Customer's email address
 * @param {string} params.password - Customer's password
 * @param {number} params.store_id - Store ID
 * @returns {Promise<Object>} Login response with token, customer data, shopify_customer, and store info
 */
export const loginCustomer = async ({ email, password, store_id }) => {
  if (!email || !password || !store_id) {
    throw new Error('Missing required fields: email, password, and store_id are required.');
  }

  try {
    const { data, errors } = await client.mutate({
      mutation: LOGIN_CUSTOMER_MUTATION,
      variables: {
        email,
        password,
        store_id,
      },
      errorPolicy: 'all',
    });

    // errorPolicy: 'all' returns GraphQL errors in `errors` instead of
    // throwing — reading only `data` and ignoring `errors` meant the
    // server's real message ("Invalid email or password") never reached the
    // caller, replaced by the generic "No data returned" message below.
    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message || 'Failed to login customer.');
    }

    if (!data?.loginCustomer) {
      throw new Error('Failed to login customer. No data returned.');
    }

    const loginResponse = data.loginCustomer;

    // Validate that we have a customer object
    if (!loginResponse.customer) {
      throw new Error(loginResponse.message || 'Login failed. Invalid credentials.');
    }

    return loginResponse;
  } catch (error) {
    console.error('❌ loginCustomer error:', error);
    
    // Extract error message from GraphQL error
    if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
      const graphQLError = error.graphQLErrors[0];
      throw new Error(graphQLError.message || 'Failed to login customer.');
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to login customer.');
  }
};

/**
 * Request a 4-digit password reset OTP (10 min expiry) be emailed to a
 * customer, if one exists for this store. Always resolves (never throws
 * for "no such customer") so the UI can't be used to enumerate emails.
 * @param {Object} params
 * @param {string} params.email - Customer's email address
 * @param {number} params.store_id - Store ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const requestCustomerPasswordOtp = async ({ email, store_id }) => {
  if (!email || !store_id) {
    throw new Error('Missing required fields: email and store_id are required.');
  }

  try {
    const { data, errors } = await client.mutate({
      mutation: REQUEST_CUSTOMER_PASSWORD_OTP_MUTATION,
      variables: { email, store_id },
      errorPolicy: 'all',
    });

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message || 'Failed to send verification code.');
    }

    if (!data?.requestCustomerPasswordOtp) {
      throw new Error('Failed to send verification code. No data returned.');
    }

    return data.requestCustomerPasswordOtp;
  } catch (error) {
    console.error('❌ requestCustomerPasswordOtp error:', error);
    if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
      throw new Error(error.graphQLErrors[0].message || 'Failed to send verification code.');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to send verification code.');
  }
};

/**
 * Verify a password reset OTP and set a new password (hashed server-side).
 * @param {Object} params
 * @param {string} params.email - Customer's email address
 * @param {number} params.store_id - Store ID
 * @param {string} params.otp - 4-digit code from the email
 * @param {string} params.newPassword - New password
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const resetCustomerPasswordWithOtp = async ({ email, store_id, otp, newPassword }) => {
  if (!email || !store_id || !otp || !newPassword) {
    throw new Error('Missing required fields: email, store_id, otp, and newPassword are required.');
  }

  try {
    const { data, errors } = await client.mutate({
      mutation: RESET_CUSTOMER_PASSWORD_WITH_OTP_MUTATION,
      variables: { email, store_id, otp, newPassword },
      errorPolicy: 'all',
    });

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message || 'Failed to reset password.');
    }

    if (!data?.resetCustomerPasswordWithOtp) {
      throw new Error('Failed to reset password. No data returned.');
    }

    return data.resetCustomerPasswordWithOtp;
  } catch (error) {
    console.error('❌ resetCustomerPasswordWithOtp error:', error);
    if (error?.graphQLErrors && error.graphQLErrors.length > 0) {
      throw new Error(error.graphQLErrors[0].message || 'Failed to reset password.');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to reset password.');
  }
};
