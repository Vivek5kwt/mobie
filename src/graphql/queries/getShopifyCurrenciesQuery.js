import { gql } from "@apollo/client";

const GET_SHOPIFY_CURRENCIES = gql`
  query GetCurrencies($shop: String!, $accessToken: String!) {
    getShopifyCurrencies(shop: $shop, accessToken: $accessToken) {
      success
      currencies
    }
  }
`;

export default GET_SHOPIFY_CURRENCIES;
