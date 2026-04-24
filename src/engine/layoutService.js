import { client } from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";
import { resolveAppId } from "../utils/appId";

export async function fetchLayoutDSL(appId) {
  try {
    // Resolve appId dynamically (from GitHub Actions or provided value)
    const resolvedAppId = resolveAppId(appId);
    const appIdInt = Number.isInteger(resolvedAppId) ? resolvedAppId : Math.floor(Number(resolvedAppId));
    console.log(`🔍 fetchLayoutDSL: Using appId ${appIdInt}`);
    
    const response = await client.query({
      query: LAYOUT_VERSION_QUERY,
      variables: { appId: appIdInt },
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
