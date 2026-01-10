import { gql } from "@apollo/client";

const LAYOUT_VERSION_QUERY = gql`
  query Layouts($appId: Int) {
    layouts(app_id: $appId) {
      app_id
      layout_versions {
        dsl
        app_id
        layout_id
        created_at
        id
        is_published
        metadata
        page_name
        published_by
        store_id
        updated_at
        version_number
      }
      created_at
      current_version_id
      handle
      id
      is_published
      page_name
      store_id
      template_id
      updated_at
    }
  }
`;

export default LAYOUT_VERSION_QUERY;
