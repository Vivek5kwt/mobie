import client from "../apollo/client";
import RUN_BIGQUERY_QUERY from "../graphql/queries/runBigQueryQuery";

const DATE_RE = /^\d{8}$/;
const IDENTIFIER_RE = /^[A-Za-z0-9_]+$/;

const sanitizeIdentifier = (value, label) => {
  const text = String(value || "").trim();
  if (!IDENTIFIER_RE.test(text)) {
    throw new Error(`${label} is missing or invalid.`);
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

const buildEventsTable = ({ datasetId }) =>
  `\`${sanitizeIdentifier(datasetId, "Analytics dataset")} .events_*\``.replace(" .", ".");

const buildAppFilter = ({ appId, storeId }) => {
  const filters = [];
  if (appId !== undefined && appId !== null && appId !== "") {
    filters.push(`(SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'app_id') = '${escapeSqlString(appId)}'`);
  }
  if (storeId !== undefined && storeId !== null && storeId !== "") {
    filters.push(`(SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'store_id') = '${escapeSqlString(storeId)}'`);
  }
  return filters.length ? `AND ${filters.join(" AND ")}` : "";
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

export async function fetchBuilderAnalyticsSummary({
  projectId,
  datasetId,
  location,
  appId,
  storeId,
  dateFrom,
  dateTo,
} = {}) {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10).replace(/-/g, "");
  const defaultFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const start = sanitizeDate(dateFrom, defaultFrom);
  const end = sanitizeDate(dateTo, defaultTo);
  const dataset = sanitizeIdentifier(datasetId, "Analytics dataset");
  const table = buildEventsTable({ datasetId: dataset });
  const appFilter = buildAppFilter({ appId, storeId });

  const query = `
    SELECT
      event_name AS eventName,
      COUNT(1) AS eventCount,
      COUNT(DISTINCT user_pseudo_id) AS userCount
    FROM ${table}
    WHERE _TABLE_SUFFIX BETWEEN '${start}' AND '${end}'
      ${appFilter}
    GROUP BY eventName
    ORDER BY eventCount DESC
  `;

  const { data, errors } = await client.query({
    query: RUN_BIGQUERY_QUERY,
    variables: {
      query,
      projectId: projectId || undefined,
      datasetId: dataset,
      location: location || undefined,
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
