import client from '../apollo/client';
import CREATE_NOTIFICATION_MUTATION from '../graphql/mutations/sendOrderNotificationMutation';

// ── Order event type constants ────────────────────────────────────────────────
export const ORDER_EVENTS = {
  ORDER_PLACED: 'order_placed',
  ORDER_PURCHASED: 'order_purchased',
  ORDER_CANCELED: 'order_canceled',
};

// ── User-facing copy for each event ──────────────────────────────────────────
const TEMPLATES = {
  [ORDER_EVENTS.ORDER_PLACED]: (orderNumber) => ({
    title: 'Order Placed!',
    body: orderNumber
      ? `Your order ${orderNumber} has been placed successfully.`
      : 'Your order has been placed successfully.',
  }),
  [ORDER_EVENTS.ORDER_PURCHASED]: (orderNumber) => ({
    title: 'Purchase Confirmed!',
    body: orderNumber
      ? `Thank you! Order ${orderNumber} is being processed.`
      : 'Thank you! Your purchase is being processed.',
  }),
  [ORDER_EVENTS.ORDER_CANCELED]: (orderNumber) => ({
    title: 'Order Canceled',
    body: orderNumber
      ? `Order ${orderNumber} has been canceled.`
      : 'Your order has been canceled.',
  }),
};

/**
 * Calls the CreateNotification mutation so the backend can push an FCM
 * notification to the device.
 *
 * @param {object} params
 * @param {string} params.type        - One of ORDER_EVENTS values
 * @param {string} [params.orderNumber] - Human-readable order number, e.g. "#1042"
 * @param {string} [params.orderId]   - Raw order ID passed as data payload
 * @param {number} params.appId       - Resolved app ID
 * @param {number|null} [params.userId] - Logged-in user id (null when guest)
 *
 * @returns {Promise<object|null>} The createNotification response or null on error
 */
export const triggerOrderNotification = async ({
  type,
  orderNumber = '',
  orderId = null,
  appId,
  userId = null,
}) => {
  const templateFn = TEMPLATES[type];
  if (!templateFn) {
    console.warn(`[notificationService] Unknown event type: ${type}`);
    return null;
  }

  if (!appId) {
    console.warn('[notificationService] appId is required — skipping notification');
    return null;
  }

  const { title, body } = templateFn(orderNumber);

  try {
    const { data, errors } = await client.mutate({
      mutation: CREATE_NOTIFICATION_MUTATION,
      variables: {
        appId: Number(appId),
        userId: userId ? Number(userId) : null,
        title,
        body,
        type,
        orderId: orderId ? String(orderId) : null,
      },
      errorPolicy: 'all',
    });

    if (data?.createNotification?.id) {
      console.log(
        `✅ [notificationService] ${type} sent — id: ${data.createNotification.id}`,
      );
    } else if (errors?.length) {
      console.warn(
        `⚠️ [notificationService] ${type} errors: ${errors.map((e) => e.message).join(', ')}`,
      );
    }

    return data?.createNotification ?? null;
  } catch (err) {
    // Notification failure must never break the order flow
    console.log(`❌ [notificationService] Failed to trigger ${type}: ${err?.message}`);
    return null;
  }
};
