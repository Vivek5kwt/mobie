export const ADD_TO_CART_SUCCESS_MESSAGE = "Product added to cart successfully.";

const unwrapCartNavValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object" && !Array.isArray(value)) {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
  }
  return value;
};

function resolveBottomNavItems(rawSection) {
  if (!rawSection) return [];
  const rawProps =
    rawSection?.props ||
    rawSection?.properties?.props?.properties ||
    rawSection?.properties?.props ||
    {};
  const rawValue = unwrapCartNavValue(rawProps?.raw, {});
  let items = unwrapCartNavValue(rawValue?.items, undefined);
  if (!items) {
    items = unwrapCartNavValue(rawProps?.items, []);
  }
  if (items?.value && Array.isArray(items.value)) return items.value;
  return Array.isArray(items) ? items : [];
}

function normalizeBottomNavTarget(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveBottomNavIndex(items, target) {
  const normalizedTarget = normalizeBottomNavTarget(target);
  if (!normalizedTarget) return -1;
  return items.findIndex((item) => {
    const id = normalizeBottomNavTarget(item?.id);
    const label = normalizeBottomNavTarget(
      item?.label ?? item?.title ?? item?.name ?? item?.text ?? item?.value
    );
    return id.includes(normalizedTarget) || label.includes(normalizedTarget);
  });
}

// Resolves the { title, link, activeIndex, bottomNavSection } params used to
// navigate to the Cart tab from a "View Cart" toast action — shared by every
// Add-to-Cart entry point (AddToCart, ProductGrid, ProductCarousel,
// TabProductGrid) so the toast behaves identically everywhere instead of each
// block re-implementing its own bottom-nav lookup.
export function resolveCartNavigationParams(section) {
  const navSection = section?.bottomNavSection || null;
  const items = resolveBottomNavItems(navSection);
  const resolvedIndex = resolveBottomNavIndex(items, "cart");
  const activeIndex = resolvedIndex >= 0 ? resolvedIndex : 0;
  const item = items[activeIndex];
  const title = item?.label || item?.title || item?.name || "Cart";
  const rawLink = item?.link ?? item?.href ?? item?.url ?? "";
  const link = typeof rawLink === "string" ? rawLink.replace(/^\//, "") : "cart";
  return {
    title: title || "Cart",
    link: link || "cart",
    activeIndex,
    ...(navSection ? { bottomNavSection: navSection } : {}),
  };
}
