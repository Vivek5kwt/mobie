import client from '../apollo/client';
import GET_NOTIFICATIONS_QUERY from '../graphql/queries/getNotificationsQuery';

/**
 * Fetch all notifications for a given app + user from the backend.
 *
 * @param {object} params
 * @param {number|string} params.appId  - Required app ID
 * @param {number|string|null} params.userId - Logged-in user ID (null = guest)
 * @returns {Promise<Array>} Array of notification objects (empty on error)
 */
export const fetchNotifications = async ({ appId, userId }) => {
  if (!appId) {
    console.warn('[notificationFetchService] appId is required');
    return [];
  }

  try {
    const { data, errors } = await client.query({
      query: GET_NOTIFICATIONS_QUERY,
      variables: {
        appId: Number(appId),
        userId: userId ? Number(userId) : null,
      },
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    });

    if (errors?.length) {
      console.warn('[notificationFetchService] GraphQL errors:', errors.map(e => e.message).join(', '));
    }

    const items = data?.notifications ?? [];
    // Sort newest first
    return [...items].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  } catch (err) {
    console.log('[notificationFetchService] Fetch failed:', err?.message);
    return [];
  }
};
