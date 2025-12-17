// Utility helpers to decide whether a DSL section should render on mobile

/**
 * Converts different shapes of boolean-like inputs into a boolean.
 * Accepts raw booleans, strings ("true"/"false"), numbers (1/0),
 * or objects that wrap values in `value`, `const`, or nested `properties` keys.
 */
export function resolveBoolean(input, defaultValue = true) {
  const normalize = (value) => {
    if (value === undefined || value === null) return undefined;

    if (typeof value === "string") {
      const lowered = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(lowered)) return true;
      if (["false", "0", "no", "n"].includes(lowered)) return false;
    }

    if (typeof value === "number") return value !== 0;

    if (typeof value === "boolean") return value;

    return undefined;
  };

  const unwrap = (value) => {
    if (value && typeof value === "object") {
      if (value.value !== undefined) return value.value;
      if (value.const !== undefined) return value.const;
      if (value.properties) return unwrap(value.properties);
    }
    return value;
  };

  const normalized = normalize(unwrap(input));
  if (normalized === undefined) return defaultValue;
  return normalized;
}

/**
 * Determines if a DSL section should be rendered on a mobile device.
 * Looks for common visibility flags coming from the backend DSL schema.
 */
export function shouldRenderSectionOnMobile(section) {
  if (!section) return false;

  const visibilityBlock = section?.properties?.visibility || section?.visibility;
  if (!visibilityBlock) return true;

  const v = visibilityBlock.properties || visibilityBlock;

  // Explicit hide-on-mobile flags take precedence
  const hideOnMobile = resolveBoolean(
    v.hideOnMobile ?? v.hiddenOnMobile ?? v.hide_on_mobile ?? v.isMobileHidden ?? v.mobileHidden,
    false,
  );
  if (hideOnMobile) return false;

  // Show-on-mobile flags (default true)
  const mobileVisible = resolveBoolean(
    v.showOnMobile ??
      v.show_in_mobile ??
      v.visibleOnMobile ??
      v.mobileVisible ??
      v.mobile ??
      v.isMobileVisible,
    true,
  );

  // If a target device is specified and it's explicitly desktop/web, skip rendering on mobile
  const targetDevice = (v.target ?? v.device ?? v.platform ?? v.for ?? v.audience)?.toString().toLowerCase();
  if (targetDevice) {
    if (targetDevice.includes("desktop") || targetDevice.includes("web")) return false;
    if (targetDevice.includes("mobile") || targetDevice.includes("phone")) return mobileVisible;
  }

  return mobileVisible;
}

