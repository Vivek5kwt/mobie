import client from "../apollo/client";
import RUN_BIGQUERY_QUERY from "../graphql/queries/runBigQueryQuery";

const DATE_RE = /^\d{8}$/;
const DATASET_RE = /^[A-Za-z0-9_]+$/;
const PROJECT_RE = /^[A-Za-z0-9_-]+$/;

const sanitizeDatasetId = (value, label) => {
  const text = String(value || "").trim();
  if (!DATASET_RE.test(text)) {
    throw new Error(`${label} is missing or invalid.`);
  }
  return text;
};

const sanitizeProjectId = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!PROJECT_RE.test(text)) {
    throw new Error("Analytics project id is invalid.");
  }
  return text;
};

const sanitizeDate = (value, fallback) => {
  const text = String(value || fallback || "").trim().replace(/-/g, "");
  if (!DATE_RE.test(text)) {
    throw new Error("Analytics date must be in YYYYMMDD or YYYY-MM-DD format.");
  }
  return text;
};

const escapeSqlString = (value) => String(value).replace(/'/g, "''");

const normalizeRequiredId = (value, label) => {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${label} is required for app-wise analytics.`);
  }
  return text;
};

const buildEventsTable = ({ projectId, datasetId }) => {
  const dataset = sanitizeDatasetId(datasetId, "Analytics dataset");
  const project = sanitizeProjectId(projectId);
  return project ? `\`${project}.${dataset}.events_*\`` : `\`${dataset}.events_*\``;
};

const eventParamStringSql = (key) => `(
  SELECT COALESCE(
    value.string_value,
    CAST(value.int_value AS STRING),
    CAST(value.float_value AS STRING),
    CAST(value.double_value AS STRING)
  )
  FROM UNNEST(event_params)
  WHERE key = '${escapeSqlString(key)}'
  LIMIT 1
)`;

const eventParamNumberSql = (key) => `(
  SELECT COALESCE(
    value.double_value,
    value.float_value,
    CAST(value.int_value AS FLOAT64),
    SAFE_CAST(value.string_value AS FLOAT64)
  )
  FROM UNNEST(event_params)
  WHERE key = '${escapeSqlString(key)}'
  LIMIT 1
)`;

const buildScopeFilter = ({ appId, storeId }) => {
  const filters = [
    `${eventParamStringSql("app_id")} = '${escapeSqlString(normalizeRequiredId(appId, "appId"))}'`,
  ];

  if (storeId !== undefined && storeId !== null && storeId !== "") {
    filters.push(`${eventParamStringSql("store_id")} = '${escapeSqlString(storeId)}'`);
  }

  return filters.join("\n      AND ");
};

const normalizeRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (typeof row === "string") {
      try {
        return JSON.parse(row);
      } catch (_) {
        return { value: row };
      }
    }
    return row || {};
  });
};

const defaultDateRange = () => {
  const today = new Date();
  const to = today.toISOString().slice(0, 10).replace(/-/g, "");
  const from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  return { from, to };
};

const normalizeAnalyticsArgs = ({
  projectId,
  datasetId,
  location,
  appId,
  storeId,
  dateFrom,
  dateTo,
} = {}) => {
  const defaults = defaultDateRange();
  return {
    projectId: sanitizeProjectId(projectId),
    datasetId: sanitizeDatasetId(datasetId, "Analytics dataset"),
    location: location || undefined,
    appId: normalizeRequiredId(appId, "appId"),
    storeId: storeId === undefined || storeId === null ? "" : String(storeId).trim(),
    start: sanitizeDate(dateFrom, defaults.from),
    end: sanitizeDate(dateTo, defaults.to),
  };
};

async function runAnalyticsQuery(args, query) {
  const { data, errors } = await client.query({
    query: RUN_BIGQUERY_QUERY,
    variables: {
      query,
      projectId: args.projectId || undefined,
      datasetId: args.datasetId,
      location: args.location || undefined,
    },
    fetchPolicy: "network-only",
    errorPolicy: "all",
  });

  if (errors?.length) {
    throw errors[0];
  }

  const result = data?.runBigQueryQuery;
  if (result?.error) {
    throw new Error(result.error);
  }

  const rows = normalizeRows(result?.rows);
  return {
    loading: false,
    empty: rows.length === 0,
    rows,
    totalRows: result?.totalRows || rows.length,
  };
}

export async function fetchBuilderAnalyticsOverview(input = {}) {
  const args = normalizeAnalyticsArgs(input);
  const table = buildEventsTable(args);
  const scope = buildScopeFilter(args);
  const gaSessionId = eventParamStringSql("ga_session_id");
  const purchaseValue = eventParamNumberSql("value");

  const query = `
    SELECT
      COUNT(1) AS totalEvents,
      COUNT(DISTINCT user_pseudo_id) AS activeUsers,
      COUNT(DISTINCT IF(${gaSessionId} IS NULL, NULL, CONCAT(user_pseudo_id, '-', ${gaSessionId}))) AS sessions,
      COUNTIF(event_name = 'purchase') AS purchases,
      SUM(IF(event_name = 'purchase', COALESCE(ecommerce.purchase_revenue, ${purchaseValue}, 0), 0)) AS revenue
    FROM ${table}
    WHERE _TABLE_SUFFIX BETWEEN '${args.start}' AND '${args.end}'
      AND ${scope}
  `;

  return runAnalyticsQuery(args, query);
}

export async function fetchBuilderAnalyticsSummary(input = {}) {
  const args = normalizeAnalyticsArgs(input);
  const table = buildEventsTable(args);
  const scope = buildScopeFilter(args);

  const query = `
    SELECT
      event_name AS eventName,
      COUNT(1) AS eventCount,
      COUNT(DISTINCT user_pseudo_id) AS userCount
    FROM ${table}
    WHERE _TABLE_SUFFIX BETWEEN '${args.start}' AND '${args.end}'
      AND ${scope}
    GROUP BY eventName
    ORDER BY eventCount DESC
  `;

  return runAnalyticsQuery(args, query);
}

export async function fetchBuilderAnalyticsDaily(input = {}) {
  const args = normalizeAnalyticsArgs(input);
  const table = buildEventsTable(args);
  const scope = buildScopeFilter(args);

  const query = `
    SELECT
      event_date AS date,
      COUNT(1) AS eventCount,
      COUNT(DISTINCT user_pseudo_id) AS userCount
    FROM ${table}
    WHERE _TABLE_SUFFIX BETWEEN '${args.start}' AND '${args.end}'
      AND ${scope}
    GROUP BY date
    ORDER BY date ASC
  `;

  return runAnalyticsQuery(args, query);
}

export async function fetchBuilderAnalyticsScreens(input = {}) {
  const args = normalizeAnalyticsArgs(input);
  const table = buildEventsTable(args);
  const scope = buildScopeFilter(args);
  const screenName = `COALESCE(
    ${eventParamStringSql("screen_name")},
    ${eventParamStringSql("firebase_screen")},
    ${eventParamStringSql("screen_class")},
    ${eventParamStringSql("firebase_screen_class")},
    'Unknown'
  )`;

  const query = `
    SELECT
      ${screenName} AS screenName,
      COUNT(1) AS viewCount,
      COUNT(DISTINCT user_pseudo_id) AS userCount
    FROM ${table}
    WHERE _TABLE_SUFFIX BETWEEN '${args.start}' AND '${args.end}'
      AND ${scope}
      AND event_name = 'screen_view'
    GROUP BY screenName
    ORDER BY viewCount DESC
    LIMIT 50
  `;

  return runAnalyticsQuery(args, query);
}

export async function fetchBuilderAnalyticsEcommerce(input = {}) {
  const args = normalizeAnalyticsArgs(input);
  const table = buildEventsTable(args);
  const scope = buildScopeFilter(args);
  const value = eventParamNumberSql("value");

  const query = `
    SELECT
      event_name AS eventName,
      COUNT(1) AS eventCount,
      COUNT(DISTINCT user_pseudo_id) AS userCount,
      SUM(COALESCE(ecommerce.purchase_revenue, ${value}, 0)) AS value
    FROM ${table}
    WHERE _TABLE_SUFFIX BETWEEN '${args.start}' AND '${args.end}'
      AND ${scope}
      AND event_name IN ('view_item', 'add_to_cart', 'remove_from_cart', 'begin_checkout', 'purchase')
    GROUP BY eventName
    ORDER BY eventCount DESC
  `;

  return runAnalyticsQuery(args, query);
}

export async function fetchBuilderAnalyticsDashboard(input = {}) {
  const [overview, events, daily, screens, ecommerce] = await Promise.all([
    fetchBuilderAnalyticsOverview(input),
    fetchBuilderAnalyticsSummary(input),
    fetchBuilderAnalyticsDaily(input),
    fetchBuilderAnalyticsScreens(input),
    fetchBuilderAnalyticsEcommerce(input),
  ]);

  const totalRows =
    overview.totalRows + events.totalRows + daily.totalRows + screens.totalRows + ecommerce.totalRows;

  return {
    loading: false,
    empty: totalRows === 0,
    overview: overview.rows?.[0] || {},
    events: events.rows,
    daily: daily.rows,
    screens: screens.rows,
    ecommerce: ecommerce.rows,
  };
}
