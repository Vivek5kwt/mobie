export function convertStyles(styleObj = {}) {
  if (!styleObj || typeof styleObj !== "object") return {};

  const out = {};

  const isPx = (v) => typeof v === "string" && v.trim().endsWith("px");
  const pxToNum = (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return parseFloat(trimmed);
      }
    }
    if (isPx(v)) {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    }
    return v;
  };

  const splitSpace = (val) =>
    String(val)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  for (const key in styleObj) {
    if (!Object.prototype.hasOwnProperty.call(styleObj, key)) continue;

    let val = styleObj[key];
    if (val == null) continue;

    // --------- NEW: FONT FAMILY HANDLING ---------
    if (key === "fontFamily") {
      // Handle: "Poppins, sans-serif" → "Poppins"
      if (typeof val === "string") {
        out.fontFamily = val.split(",")[0].trim().replace(/['"]/g, '');
      }
      continue;
    }

    // --------- NEW: CIRCULAR BORDER RADIUS ---------
    if (key === "borderRadius") {
      const v = String(val).trim();
      if (v.includes("%") || v === "999px" || v === "9999px" || v === "50%") {
        // Circular or large radius for RN
        out.borderRadius = 9999;
      } else if (/\s|\//.test(v)) {
        // Multi-value radii are not supported by React Native; ignore to avoid invalid strings
      } else {
        out[key] = pxToNum(val);
      }
      continue;
    }

    // --------- ENHANCED: LINEAR GRADIENT HANDLING ---------
    if (key === "background" || key === "backgroundColor") {
      const str = String(val);
      if (str.includes("linear-gradient")) {
        // Extract gradient info for RN LinearGradient component
        const gradientMatch = str.match(/linear-gradient\((.+)\)/);
        if (gradientMatch) {
          // Parse gradient: e.g., "90deg, #33B8C4BA, #09AAB9"
          const gradientStr = gradientMatch[1];
          const parts = gradientStr.split(",").map(p => p.trim());
          
          // First part might be direction
          let angle = 0;
          let colors = parts;
          
          if (parts[0].includes("deg")) {
            angle = parseFloat(parts[0]);
            colors = parts.slice(1);
          }
          
          // Store gradient info separately
          if (!out._gradient) out._gradient = {};
          out._gradient.colors = colors;
          out._gradient.angle = angle;
          out._gradient.type = 'linear';
        }
        // Fallback: use first color as solid
        const colorMatch = str.match(/#[0-9A-Fa-f]{3,8}/g);
        if (colorMatch && colorMatch.length > 0) {
          out.backgroundColor = colorMatch[0];
        }
        continue;
      } else {
        out.backgroundColor = val;
        continue;
      }
    }

    // --------- NEW: TEXT TRANSFORM ---------
    if (key === "textTransform") {
      // RN supports: 'none', 'uppercase', 'lowercase', 'capitalize'
      out.textTransform = val;
      continue;
    }

    // --------- NEW: LETTER SPACING ---------
    if (key === "letterSpacing") {
      if (isPx(val)) {
        out.letterSpacing = pxToNum(val);
      } else if (typeof val === "string" && val.includes("em")) {
        // Convert em to pixels (approx)
        const emValue = parseFloat(val);
        if (!isNaN(emValue)) {
          // Assuming base font size 16px
          out.letterSpacing = emValue * 16;
        }
      } else {
        out.letterSpacing = val;
      }
      continue;
    }

    // --------- NEW: WHITE SPACE HANDLING ---------
    if (key === "whiteSpace") {
      // Convert CSS white-space to RN numberOfLines equivalent
      if (val === "nowrap" || val === "pre") {
        out.numberOfLines = 1;
      }
      // Also keep the original for text styling if needed
      out.whiteSpace = val;
      continue;
    }

    // --------- NEW: FONT VARIANT ---------
    if (key === "fontVariant") {
      // Handle font-variant like 'small-caps'
      if (Array.isArray(val)) {
        out.fontVariant = val;
      } else if (typeof val === "string") {
        out.fontVariant = val.split(" ");
      }
      continue;
    }

    // --------- ENHANCED: BORDER HANDLING WITH STYLE ---------
    if (key === "border" && typeof val === "string") {
      const parts = splitSpace(val);
      const widthPart = parts.find((p) => p.includes("px"));
      const stylePart = parts.find(p => 
        p === "solid" || p === "dashed" || p === "dotted"
      );
      const colorPart = parts.find(
        (p) =>
          p.startsWith("#") ||
          p.startsWith("rgb(") ||
          p.startsWith("rgba(") ||
          p.startsWith("hsl(") ||
          p.startsWith("hsla(")
      );
      
      if (widthPart) out.borderWidth = pxToNum(widthPart);
      if (colorPart) out.borderColor = colorPart;
      if (stylePart) out.borderStyle = stylePart; // RN supports solid, dotted, dashed
      
      continue;
    }

    // --------- NEW: ELEVATION SPECIFIC FOR ANDROID ---------
    if (key === "elevation") {
      out.elevation = typeof val === "string" ? parseInt(val, 10) : val;
      continue;
    }

    // --------- NEW: OPACITY ---------
    if (key === "opacity") {
      out.opacity = typeof val === "string" ? parseFloat(val) : val;
      continue;
    }

    // --------- NEW: BACKGROUND OPACITY ---------
    if (key === "backgroundOpacity") {
      // Convert percentage to decimal (e.g., 100 → 1.0)
      if (typeof val === "number") {
        out.opacity = val / 100;
      } else if (typeof val === "string" && val.includes("%")) {
        const percent = parseFloat(val);
        if (!isNaN(percent)) {
          out.opacity = percent / 100;
        }
      }
      continue;
    }

    // --------- NEW: WRITING DIRECTION ---------
    if (key === "writingDirection") {
      // RN: 'auto', 'ltr', 'rtl'
      out.writingDirection = val;
      continue;
    }

    // --------- REST OF YOUR EXISTING CODE (with slight modifications) ---------
    // --------- 0) BASIC NORMALIZATION ---------
    const isLengthProp =
      [
        "width",
        "height",
        "minWidth",
        "minHeight",
        "maxWidth",
        "maxHeight",
        "top",
        "left",
        "right",
        "bottom",
        "borderWidth",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "fontSize",
        "lineHeight"
      ].includes(key);

    if (isLengthProp) {
      if (isPx(val)) val = pxToNum(val);
      out[key] = val;
      continue;
    }

    // --------- 1) PADDING SHORTHANDS ---------
    if (key === "padding" || key === "paddingInline" || key === "paddingBlock") {
      const parts = splitSpace(val).map(pxToNum);

      if (parts.length === 1) {
        out.padding = parts[0];
      } else if (parts.length === 2) {
        out.paddingVertical = parts[0];
        out.paddingHorizontal = parts[1];
      } else if (parts.length === 3) {
        out.paddingTop = parts[0];
        out.paddingHorizontal = parts[1];
        out.paddingBottom = parts[2];
      } else if (parts.length === 4) {
        out.paddingTop = parts[0];
        out.paddingRight = parts[1];
        out.paddingBottom = parts[2];
        out.paddingLeft = parts[3];
      }
      continue;
    }

    if (
      key === "paddingTop" ||
      key === "paddingRight" ||
      key === "paddingBottom" ||
      key === "paddingLeft"
    ) {
      out[key] = pxToNum(val);
      continue;
    }

    // --------- 2) MARGIN SHORTHANDS ---------
    if (key === "margin" || key === "marginInline" || key === "marginBlock") {
      const parts = splitSpace(val).map(pxToNum);

      if (parts.length === 1) {
        out.margin = parts[0];
      } else if (parts.length === 2) {
        out.marginVertical = parts[0];
        out.marginHorizontal = parts[1];
      } else if (parts.length === 3) {
        out.marginTop = parts[0];
        out.marginHorizontal = parts[1];
        out.marginBottom = parts[2];
      } else if (parts.length === 4) {
        out.marginTop = parts[0];
        out.marginRight = parts[1];
        out.marginBottom = parts[2];
        out.marginLeft = parts[3];
      }
      continue;
    }

    if (
      key === "marginTop" ||
      key === "marginRight" ||
      key === "marginBottom" ||
      key === "marginLeft"
    ) {
      out[key] = pxToNum(val);
      continue;
    }

    // --------- 3) BORDER SHORTHANDS ---------
    if (key === "border" && typeof val === "string") {
      const parts = splitSpace(val);
      const widthPart = parts.find((p) => p.includes("px"));
      const colorPart = parts.find(
        (p) =>
          p.startsWith("#") ||
          p.startsWith("rgb(") ||
          p.startsWith("rgba(") ||
          p.startsWith("hsl(") ||
          p.startsWith("hsla(")
      );
      if (widthPart) out.borderWidth = pxToNum(widthPart);
      if (colorPart) out.borderColor = colorPart;
      continue;
    }

    if (
      (key === "borderTop" ||
        key === "borderRight" ||
        key === "borderBottom" ||
        key === "borderLeft") &&
      typeof val === "string"
    ) {
      const parts = splitSpace(val);
      const widthPart = parts.find((p) => p.includes("px"));
      const colorPart = parts.find(
        (p) =>
          p.startsWith("#") ||
          p.startsWith("rgb(") ||
          p.startsWith("rgba(") ||
          p.startsWith("hsl(") ||
          p.startsWith("hsla(")
      );

      const side = key.replace("border", "");
      const sideKey = side.charAt(0).toUpperCase() + side.slice(1);

      if (widthPart) out[`border${sideKey}Width`] = pxToNum(widthPart);
      if (colorPart) out[`border${sideKey}Color`] = colorPart;
      continue;
    }

    // --------- 5) FONT WEIGHT / TEXT STYLE ---------
    if (key === "fontWeight") {
      out.fontWeight = val;
      continue;
    }

    if (key === "textDecoration") {
      if (val === "underline" || val === "line-through" || val === "none") {
        out.textDecorationLine = val;
      } else {
        out.textDecorationLine = "none";
      }
      continue;
    }

    if (key === "fontStyle") {
      out.fontStyle = val === "italic" ? "italic" : "normal";
      continue;
    }

    if (key === "textAlign") {
      out.textAlign = val;
      continue;
    }

    // --------- 6) FLEX / LAYOUT ---------
    if (key === "display") {
      if (val === "none") out.display = "none";
      continue;
    }

    if (key === "flexDirection") {
      out.flexDirection = val;
      continue;
    }

    if (key === "justifyContent") {
      out.justifyContent = val;
      continue;
    }

    if (key === "alignItems") {
      out.alignItems = val;
      continue;
    }

    if (key === "alignSelf") {
      out.alignSelf = val;
      continue;
    }

    if (key === "flex") {
      out.flex = typeof val === "string" ? parseFloat(val) : val;
      continue;
    }

    if (key === "flexGrow" || key === "flexShrink") {
      out[key] = typeof val === "string" ? parseFloat(val) : val;
      continue;
    }

    if (key === "flexWrap") {
      out.flexWrap = val;
      continue;
    }

    // Gap properties - RN doesn't support; ignore safely
    if (key === "gap" || key === "rowGap" || key === "columnGap") {
      continue;
    }

    // --------- 7) POSITION / Z-INDEX / OVERFLOW ---------
    if (key === "position") {
      out.position = val;
      continue;
    }

    if (key === "top" || key === "right" || key === "bottom" || key === "left") {
      if (isPx(val)) out[key] = pxToNum(val);
      else out[key] = val;
      continue;
    }

    if (key === "zIndex") {
      out.zIndex = typeof val === "string" ? parseInt(val, 10) : val;
      continue;
    }

    if (key === "overflow") {
      out.overflow = val;
      continue;
    }

    // --------- 9) SHADOWS ---------
    if (key === "boxShadow" && typeof val === "string") {
      const parts = splitSpace(val);
      const nums = parts.filter((p) => p.includes("px")).map(pxToNum);
      const color = parts.find(
        (p) =>
          p.startsWith("#") ||
          p.startsWith("rgb(") ||
          p.startsWith("rgba(") ||
          p.startsWith("hsl(") ||
          p.startsWith("hsla(")
      );

      if (nums.length >= 2) {
        out.shadowOffset = { width: nums[0], height: nums[1] };
      }
      if (nums.length >= 3) {
        out.shadowRadius = nums[2];
      }
      if (color) {
        out.shadowColor = color;
        out.shadowOpacity = 0.3;
      }
      if (nums.length >= 3) {
        out.elevation = Math.max(1, Math.round(nums[2] / 2));
      }
      continue;
    }

    if (
      key === "textShadowColor" ||
      key === "textShadowRadius" ||
      key === "textShadowOffset"
    ) {
      out[key] = val;
      continue;
    }

    // --------- 10) IMAGES / OBJECT-FIT -> resizeMode ---------
    if (key === "objectFit") {
      if (val === "contain" || val === "cover") out.resizeMode = val;
      else if (val === "fill") out.resizeMode = "stretch";
      else out.resizeMode = "contain";
      continue;
    }

    // --------- 11) DEFAULT: px → number for misc props, else keep ----------
    if (typeof val === "string" && isPx(val)) {
      out[key] = pxToNum(val);
    } else {
      out[key] = val;
    }
  }

  return out;
}

// --------- HELPER FUNCTIONS FOR SPECIFIC DSL FEATURES ---------

/**
 * Apply metrics positioning from DSL
 */
export function applyMetricsPositioning(style, metrics) {
  if (!metrics) return style;
  
  const positioned = { ...style };
  
  if (metrics.x !== undefined) positioned.left = metrics.x;
  if (metrics.y !== undefined) positioned.top = metrics.y;
  if (metrics.width !== undefined) positioned.width = metrics.width;
  if (metrics.height !== undefined) positioned.height = metrics.height;
  
  if (metrics.x !== undefined || metrics.y !== undefined) {
    positioned.position = 'absolute';
  }
  
  return positioned;
}

/**
 * Handle percentage dimensions based on container size
 */
export function resolvePercentageDimensions(style, containerWidth, containerHeight) {
  const resolved = { ...style };
  
  const resolve = (value, dimension) => {
    if (typeof value === 'string' && value.includes('%')) {
      const percent = parseFloat(value) / 100;
      return dimension * percent;
    }
    return value;
  };
  
  if (resolved.width) resolved.width = resolve(resolved.width, containerWidth);
  if (resolved.height) resolved.height = resolve(resolved.height, containerHeight);
  if (resolved.left && typeof resolved.left === 'string') resolved.left = resolve(resolved.left, containerWidth);
  if (resolved.top && typeof resolved.top === 'string') resolved.top = resolve(resolved.top, containerHeight);
  if (resolved.right && typeof resolved.right === 'string') resolved.right = resolve(resolved.right, containerWidth);
  if (resolved.bottom && typeof resolved.bottom === 'string') resolved.bottom = resolve(resolved.bottom, containerHeight);
  
  return resolved;
}

/**
 * Extract gradient info from style (for LinearGradient component)
 */
export function extractGradientInfo(style) {
  return style._gradient || null;
}