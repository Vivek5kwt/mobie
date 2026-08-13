import { gql } from '@apollo/client';

const TRIGGER_CAMPAIGN_MUTATION = gql`
  mutation TriggerCampaign($store_id: Int!, $userid: Int!, $auto_type: String!, $appid: Int!) {
    triggerCampaign(store_id: $store_id, userid: $userid, auto_type: $auto_type, appid: $appid) {
      success
      message
      campaign_id
    }
  }
`;

export default TRIGGER_CAMPAIGN_MUTATION;
