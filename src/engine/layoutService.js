import { client } from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";

export async function fetchLayoutDSL(appId) {
  try {
    const response = await client.query({
      query: LAYOUT_VERSION_QUERY,
      variables: { appId },
      fetchPolicy: "no-cache",
    });

    const layouts = response?.data?.layouts;
    const arr = Array.isArray(layouts) && layouts.length > 0
      ? layouts[0]?.layout_versions
      : null;

    if (Array.isArray(arr) && arr.length > 0) {
      return arr[0]?.dsl || null;  // latest version DSL
    }

    return null;

  } catch (error) {
    console.log("Error fetching DSL:", error);
    return null;
  }
}
