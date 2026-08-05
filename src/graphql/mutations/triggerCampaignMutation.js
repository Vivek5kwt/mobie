import { gql } from '@apollo/client';

const TRIGGER_CAMPAIGN_MUTATION = gql`
  mutation TriggerCampaign(
    $storeId: Int!
    $userid: Int!
    $autoType: String!
    $appid: Int!
  ) {
    triggerCampaign(
      store_id: $storeId
      userid: $userid
      auto_type: $autoType
      appid: $appid
    ) {
      success
      message
      campaign_id
    }
  }
`;

export default TRIGGER_CAMPAIGN_MUTATION;
