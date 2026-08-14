import { gql } from "@apollo/client";

// accessToken is resolved server-side by getShopifyCurrencies (it looks the
// store's token up itself — see appmobidrag/server/graphql/resolvers.js), so
// the client only ever needs to send `shop`. This used to also declare
// $accessToken as a *required* variable that nothing ever supplied
// (currencyService.js only ever sent `shop`), which made every call fail at
// the GraphQL variable-coercion stage before the resolver even ran — mirrors
// appmobidrag/builder/src/api/currency.ts's GET_SHOPIFY_CURRENCIES, which
// only ever declared $shop.
const GET_SHOPIFY_CURRENCIES = gql`
  query GetCurrencies($shop: String!) {
    getShopifyCurrencies(shop: $shop) {
      success
      currencies
      markets {
        currencyCode
        countryCode
        countryName
        marketName
        primary
      }
    }
  }
`;

export default GET_SHOPIFY_CURRENCIES;
