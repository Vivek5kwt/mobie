import { gql } from "@apollo/client";

const LAYOUT_VERSION_QUERY = gql`
  query Layout($appId: Int) {
    layout(app_id: $appId) {
      app_id
      created_at
      current_version_id
      handle
      id
      updated_at
      template_id
      store_id
      page_name
      is_published
      layout_versions {
        version_number
        updated_at
        store_id
        published_by
        page_name
        metadata
        layout_id
        is_published
        id
        dsl
        created_at
        app_id
      }
    }
  }
`;

export default LAYOUT_VERSION_QUERY;
