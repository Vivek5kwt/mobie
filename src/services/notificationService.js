import client from '../apollo/client';
import TRIGGER_CAMPAIGN_MUTATION from '../graphql/mutations/triggerCampaignMutation';

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
 * Previously called a `createNotification` GraphQL mutation that never
 * existed on the backend (confirmed: zero matches in schema.js/resolvers.js)
 * — every call always failed and was silently swallowed below, so this has
 * never actually notified anyone. Left as a no-op stub (rather than deleted)
 * because its 2 call sites — CheckoutWebViewScreen.js and
 * OrderDetailScreen.js — are being replaced with real triggerCampaign(...)
 * calls in the next phase; removing the call sites is that phase's job, not
 * this bug fix's.
 *
 * @param {object} params
 * @param {string} params.type        - One of ORDER_EVENTS values
 * @param {string} [params.orderNumber] - Human-readable order number, e.g. "#1042"
 * @param {string} [params.orderId]   - Raw order ID passed as data payload
 * @param {number} params.appId       - Resolved app ID
 * @param {number|null} [params.userId] - Logged-in user id (null when guest)
 *
 * @returns {Promise<null>}
 */
export const triggerOrderNotification = async ({ type }) => {
  if (!TEMPLATES[type]) {
    console.warn(`[notificationService] Unknown event type: ${type}`);
  }
  return null;
};

/**
 * Fires one of Builder's "Automation flows" for a single user via the
 * existing triggerCampaign(store_id, userid, auto_type, appid) resolver.
 * Shared by every real-event integration point (checkout success, signup
 * success, ...) so they don't each duplicate the mutation-call/error-swallow
 * logic. Never throws — a notification failure must never interrupt
 * checkout or signup, matching the defensive style already used by
 * triggerOrderNotification's call sites (`.catch(() => {})`).
 *
 * @param {object} params
 * @param {number} params.storeId
 * @param {number} params.userId
 * @param {'welcome'|'postpurchase'|'ordertracking'|'abandant'|'winback'} params.autoType
 * @param {number} params.appId
 * @returns {Promise<boolean>} true if the campaign push was actually sent
 */
export const triggerCampaign = async ({ storeId, userId, autoType, appId }) => {
  const missing = [
    !storeId && 'storeId',
    !userId && 'userId',
    !autoType && 'autoType',
    !appId && 'appId',
  ].filter(Boolean);

  if (missing.length) {
    console.warn(`[notificationService] triggerCampaign(${autoType || '?'}) skipped — missing ${missing.join(', ')}`);
    return false;
  }

  try {
    const { data, errors } = await client.mutate({
      mutation: TRIGGER_CAMPAIGN_MUTATION,
      variables: {
        store_id: Number(storeId),
        userid: Number(userId),
        auto_type: autoType,
        appid: Number(appId),
      },
      errorPolicy: 'all',
    });

    if (errors?.length) {
      console.warn(
        `[notificationService] triggerCampaign(${autoType}) GraphQL errors:`,
        errors.map((e) => e.message).join(' | '),
      );
    }

    const result = data?.triggerCampaign;
    if (result && !result.success) {
      // Expected/benign in many cases — e.g. no ACTIVE campaign configured
      // for this flow yet, or no FCM token registered for this user. Not an
      // app error, so this only logs rather than warns.
      console.log(`[notificationService] triggerCampaign(${autoType}): ${result.message || 'not sent'}`);
    }

    return Boolean(result?.success);
  } catch (err) {
    console.log(`[notificationService] triggerCampaign(${autoType}) failed: ${err?.message}`);
    return false;
  }
};
