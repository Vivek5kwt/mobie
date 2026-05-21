const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const normalizeName = (value) => String(value || "").trim().toLowerCase();

const parseSpacingNumber = (value) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return undefined;
  if (typeof resolved === "number" && Number.isFinite(resolved)) return resolved;
  const match = String(resolved).match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBottomFromShorthand = (value) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return undefined;
  if (typeof resolved === "number") return resolved;
  const parts = String(resolved)
    .trim()
    .split(/\s+/)
    .map(parseSpacingNumber)
    .filter((part) => part !== undefined);
  if (!parts.length) return undefined;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0];
  if (parts.length === 3) return parts[2];
  return parts[2];
};

const firstSpacing = (...values) => {
  for (const value of values) {
    const parsed = parseSpacingNumber(value);
    if (parsed !== undefined) return Math.max(0, parsed);
  }
  return undefined;
};

const readPropsNode = (section = {}) =>
  section?.properties?.props?.properties ||
  section?.properties?.props ||
  section?.props ||
  {};

const readCssNode = (propsNode, key) =>
  unwrapValue(propsNode?.[key]?.properties?.css?.value, undefined) ||
  unwrapValue(propsNode?.[key]?.css?.value, undefined) ||
  unwrapValue(propsNode?.[key]?.properties?.css, undefined) ||
  unwrapValue(propsNode?.[key]?.css, {}) ||
  {};

const resolveSectionBottomSpacing = (section) => {
  const propsNode = readPropsNode(section);
  const raw = unwrapValue(propsNode?.raw, null) || propsNode || {};
  const presentationCss = readCssNode(propsNode, "presentation");
  const layoutCss = readCssNode(propsNode, "layout");
  const explicit = firstSpacing(
    raw?.sectionMarginBottom,
    raw?.sectionMb,
    raw?.marginBottom,
    raw?.mb,
    raw?.bottomSpacing,
    raw?.spacingBottom,
    raw?.gapAfter,
    propsNode?.sectionMarginBottom,
    propsNode?.sectionMb,
    propsNode?.marginBottom,
    propsNode?.mb,
    presentationCss?.container?.marginBottom,
    layoutCss?.container?.marginBottom
  );

  if (explicit !== undefined) return explicit;

  return parseBottomFromShorthand(
    raw?.sectionMargin ??
      raw?.margin ??
      propsNode?.sectionMargin ??
      propsNode?.margin ??
      presentationCss?.container?.margin ??
      layoutCss?.container?.margin
  );
};

const BANNER_SECTIONS = new Set(["banner_slider", "hero_banner"]);
const PRODUCT_SECTIONS = new Set([
  "product_grid",
  "product_carousel",
  "tab_product_grid",
  "tab_product_carousel",
  "recent_products",
]);
const TEXT_SECTIONS = new Set(["text_block"]);

export const getHomeSectionMarginBottom = ({
  section,
  componentName,
  nextComponentName,
  nextSection,
}) => {
  if (!nextSection) return 0;

  const explicitSpacing = resolveSectionBottomSpacing(section);
  if (explicitSpacing !== undefined) return explicitSpacing;

  const current = normalizeName(componentName);
  const next = normalizeName(nextComponentName);

  if (current === "header_2" || (current === "header" && next === "header_2")) return 0;
  if (BANNER_SECTIONS.has(current) && PRODUCT_SECTIONS.has(next)) return 12;
  if (PRODUCT_SECTIONS.has(current) && TEXT_SECTIONS.has(next)) return 8;
  if (TEXT_SECTIONS.has(current) && TEXT_SECTIONS.has(next)) return 8;
  if (BANNER_SECTIONS.has(current)) return 12;
  if (PRODUCT_SECTIONS.has(current)) return 10;
  return 10;
};
