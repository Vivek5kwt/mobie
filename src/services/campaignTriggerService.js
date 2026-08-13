import client from '../apollo/client';
import TRIGGER_CAMPAIGN_MUTATION from '../graphql/mutations/triggerCampaignMutation';

/**
 * Fires the store's active automated campaign (by auto_type, e.g. "welcome")
 * for one specific user. Resolves quietly (never throws) on the expected
 * non-error outcomes — no ACTIVE campaign of that type, or no FCM token
 * saved yet for this user/app — since those are normal, not failures.
 */
export const triggerCampaign = async ({ storeId, userId, autoType, appId }) => {
  if (!storeId || !userId || !autoType || !appId) return null;

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
    console.warn('[campaignTrigger] GraphQL errors:', errors.map((e) => e.message).join(' | '));
    return null;
  }

  return data?.triggerCampaign ?? null;
};
