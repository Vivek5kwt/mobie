import client from '../apollo/client';
import REGISTER_CUSTOMER_MUTATION from '../graphql/mutations/registerCustomerMutation';
import LOGIN_CUSTOMER_MUTATION from '../graphql/mutations/loginCustomerMutation';

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
    const { data } = await client.mutate({
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
    const { data } = await client.mutate({
      mutation: LOGIN_CUSTOMER_MUTATION,
      variables: {
        email,
        password,
        store_id,
      },
      errorPolicy: 'all',
    });

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
