import { client } from "../apollo/client";
import { LAYOUT_VERSION_QUERY } from "../apollo/queries";

export async function fetchLayoutDSL(appId) {
  try {
    console.log(`🆔 Using app_id for backend request: ${appId}`);
    const response = await client.query({
      query: LAYOUT_VERSION_QUERY,
      variables: { appId },
      fetchPolicy: "no-cache",
    });

    const arr = response?.data?.layout?.layout_versions;

    if (Array.isArray(arr) && arr.length > 0) {
      return arr[0]?.dsl || null;  // latest version DSL
    }

    return null;

  } catch (error) {
    console.log("Error fetching DSL:", error);
    return null;
  }
}
