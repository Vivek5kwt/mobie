import { gql } from "@apollo/client";

const LAYOUT_VERSION_PAGE_QUERY = gql`
  query GetLayoutVersionPage($app_id: Int!, $store_id: Int, $page_name: String!) {
    layoutVersionPage(app_id: $app_id, store_id: $store_id, page_name: $page_name) {
      version_id
      layout_id
      version_number
      page_name
      page_dsl
      brandKit
      __typename
    }
  }
`;

export default LAYOUT_VERSION_PAGE_QUERY;
