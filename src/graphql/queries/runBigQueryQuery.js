import { gql } from "@apollo/client";

const RUN_BIGQUERY_QUERY = gql`
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
`;

export default RUN_BIGQUERY_QUERY;
