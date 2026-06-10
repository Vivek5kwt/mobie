# Builder Analytics API Handover

This app tracks analytics per app. The Builder must always request analytics with an `appId`; do not load analytics without an app scope, otherwise data from multiple apps can be mixed.

## Mobile Event Scope

Every tracked mobile event includes these Firebase event params:

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `app_id` | string | yes | The Builder app id. This is the primary analytics partition key. |
| `store_id` | string | recommended | Store id resolved from the app/store DSL config. |
| `user_type` | string | no | Customer/user type when available. |
| `shopify_domain` | string | no | Shopify domain when store config is loaded. |
| `store_currency` | string | no | Store/user currency when available. |

The app id is resolved from:

1. Caller/session value.
2. `app.json.appId`.
3. `src/generated/brandAssets.json.appId`.
4. Build env `REACT_APP_APP_ID` / `APP_ID`.
5. Local fallback only for development.

## Events Currently Tracked

| Event | When it fires |
| --- | --- |
| `app_open` | App starts. |
| `screen_view` | Screen/page route changes and DSL page renders. |
| `login` | User logs in with email. |
| `sign_up` | User creates an account. |
| `logout` | User logs out. |
| `view_item` | Product detail page opens. |
| `add_to_cart` | Product is added to cart. |
| `remove_from_cart` | Product is removed from cart or quantity decreases. |
| `add_to_wishlist` | Product is added to wishlist. |
| `remove_from_wishlist` | Product is removed from wishlist. |
| `begin_checkout` | Checkout flow starts. |
| `purchase` | Checkout/order completion is detected. |

## Existing GraphQL API

The current code uses the existing BigQuery proxy GraphQL query:

```graphql
query RunBigQueryQuery(
  $query: String!
  $projectId: String
  $datasetId: String
  $location: String
) {
  runBigQueryQuery(
    query: $query
    projectId: $projectId
    datasetId: $datasetId
    location: $location
  ) {
    rows
    totalRows
    error
  }
}
```

Builder frontend can call the helper service:

```js
import {
  fetchBuilderAnalyticsDashboard,
  fetchBuilderAnalyticsOverview,
  fetchBuilderAnalyticsSummary,
  fetchBuilderAnalyticsDaily,
  fetchBuilderAnalyticsScreens,
  fetchBuilderAnalyticsEcommerce,
} from "../services/builderAnalyticsService";
```

Required input:

```js
{
  projectId: "firebase-or-bigquery-project-id", // optional if backend uses default project
  datasetId: "analytics_XXXXXXXXX",             // required
  location: "US",                               // optional
  appId: "132",                                 // required, never omit
  storeId: "73",                                // optional but recommended
  dateFrom: "2026-06-01",                       // optional, defaults to last 30 days
  dateTo: "2026-06-10"                          // optional, defaults to today
}
```

Main dashboard call:

```js
const data = await fetchBuilderAnalyticsDashboard({
  projectId,
  datasetId,
  location,
  appId,
  storeId,
  dateFrom,
  dateTo,
});
```

Response shape:

```js
{
  loading: false,
  empty: false,
  overview: {
    totalEvents,
    activeUsers,
    sessions,
    purchases,
    revenue
  },
  events: [
    { eventName, eventCount, userCount }
  ],
  daily: [
    { date, eventCount, userCount }
  ],
  screens: [
    { screenName, viewCount, userCount }
  ],
  ecommerce: [
    { eventName, eventCount, userCount, value }
  ]
}
```

## Recommended Backend API For Builder

If the Builder team wants a clean backend endpoint instead of sending SQL from the frontend, expose this GraphQL query:

```graphql
query GetAppAnalyticsDashboard(
  $appId: ID!
  $storeId: ID
  $dateFrom: String
  $dateTo: String
  $timezone: String
) {
  appAnalyticsDashboard(
    appId: $appId
    storeId: $storeId
    dateFrom: $dateFrom
    dateTo: $dateTo
    timezone: $timezone
  ) {
    overview {
      totalEvents
      activeUsers
      sessions
      purchases
      revenue
    }
    events {
      eventName
      eventCount
      userCount
    }
    daily {
      date
      eventCount
      userCount
    }
    screens {
      screenName
      viewCount
      userCount
    }
    ecommerce {
      eventName
      eventCount
      userCount
      value
    }
  }
}
```

Backend rule: `appId` must be required and must be applied in every query using the Firebase event param `app_id`. `storeId` can be applied as an additional filter when present.

## Builder UI States

Use these states in the Builder analytics page:

- Loading: show skeleton cards/charts while the dashboard request is running.
- Empty: show "No analytics data yet for this app" when all returned arrays are empty.
- Error: show a friendly message and a retry button; do not show raw BigQuery/Firebase errors to the user.
- Scoped header: display the selected app name/app id/date range so the user can see which app analytics they are viewing.

## Important Isolation Notes

- Never cache analytics only by `storeId`; cache by `appId + storeId + dateFrom + dateTo`.
- Never render global analytics as a fallback when an app-wise query fails.
- Keep `app_id` as a string in Firebase params and Builder filters. The query helper also handles older events where Firebase stored the value as an integer.
- For multi-app stores, the same `storeId` may have multiple app ids, so `appId` remains the primary partition key.
