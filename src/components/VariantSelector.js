import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import FontAwesome from "react-native-vector-icons/FontAwesome";

import { resolveFirstFont } from "../services/typographyService";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { setVariantSelection } from "../utils/variantSelectionStore";

// =============================================================================
// DSL HELPERS
// =============================================================================

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;

  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;

    if (value.properties) {
      return unwrapValue(value.properties, fallback);
    }
  }

  return value;
};

const toStr = (value, fallback = "") => {
  const result = unwrapValue(value, fallback);

  if (result === undefined || result === null) {
    return fallback;
  }

  const str = String(result).trim();

  if (!str || str === "undefined" || str === "null") {
    return fallback;
  }

  return str;
};

const toNum = (value, fallback) => {
  const result = unwrapValue(value, undefined);

  if (
    result === undefined ||
    result === null ||
    result === ""
  ) {
    return fallback;
  }

  if (typeof result === "number") {
    return result;
  }

  const parsed = parseFloat(String(result));

  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value, fallback = true) => {
  const result = unwrapValue(value, undefined);

  if (result === undefined || result === null) {
    return fallback;
  }

  if (typeof result === "boolean") {
    return result;
  }

  if (typeof result === "number") {
    return result !== 0;
  }

  if (typeof result === "string") {
    return [
      "true",
      "1",
      "yes",
      "y",
    ].includes(result.trim().toLowerCase());
  }

  return fallback;
};

const pick = (candidates, fallback = "") => {
  for (const candidate of candidates) {
    const value = toStr(candidate, "");

    if (value) {
      return value;
    }
  }

  return fallback;
};

const pickNum = (candidates, fallback) => {
  for (const candidate of candidates) {
    const value = unwrapValue(candidate, undefined);

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      continue;
    }

    const number =
      typeof value === "number"
        ? value
        : parseFloat(String(value));

    if (!Number.isNaN(number)) {
      return number;
    }
  }

  return fallback;
};

const resolveWeight = (value) => {
  const rawValue = unwrapValue(value, undefined);

  if (!rawValue && rawValue !== 0) {
    return undefined;
  }

  const weight = String(rawValue)
    .toLowerCase()
    .trim();

  if (weight === "bold") return "700";
  if (weight === "semibold") return "600";
  if (weight === "semi bold") return "600";
  if (weight === "medium") return "500";
  if (weight === "regular") return "400";
  if (weight === "normal") return "400";
  if (weight === "light") return "300";

  if (/^\d+$/.test(weight)) {
    return weight;
  }

  return undefined;
};

// =============================================================================
// COLOR MAP
// =============================================================================

const COLOR_MAP = {
  red: "#EF4444",
  blue: "#3B82F6",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  purple: "#A855F7",
  pink: "#EC4899",
  black: "#111827",
  white: "#FFFFFF",
  gray: "#9CA3AF",
  grey: "#9CA3AF",
  brown: "#92400E",
  teal: "#0D9488",
  cyan: "#06B6D4",
  indigo: "#6366F1",
  violet: "#7C3AED",
  lime: "#84CC16",
  amber: "#F59E0B",
  rose: "#F43F5E",
  sky: "#0EA5E9",
  navy: "#1E3A5F",
  beige: "#F5F0E8",
  ivory: "#FFFFF0",
  coral: "#FF6B6B",
  gold: "#FFD700",
  silver: "#C0C0C0",
  maroon: "#800000",
  olive: "#808000",
  magenta: "#FF00FF",
  turquoise: "#40E0D0",
  lavender: "#E6E6FA",

  cream: "#FFFDD0",
  nude: "#E8C9A0",
  peach: "#FFDAB9",
  rust: "#B7410E",
  mustard: "#FFDB58",
  sage: "#87AE73",
  mint: "#98FF98",
  burgundy: "#800020",
  charcoal: "#36454F",
  chocolate: "#7B3F00",
  caramel: "#C68642",
  khaki: "#C3B091",
  tan: "#D2B48C",
  taupe: "#483C32",
  sand: "#C2B280",
  wheat: "#F5DEB3",
  stone: "#928E85",
  slate: "#708090",
  denim: "#1560BD",
  cobalt: "#0047AB",
  blush: "#FFB6C1",
  lilac: "#C8A2C8",
  mauve: "#E0B0FF",
  wine: "#722F37",
  plum: "#8E4585",
  fuchsia: "#FF00FF",
  lemon: "#FFF44F",
  emerald: "#50C878",
  aqua: "#00FFFF",
  scarlet: "#FF2400",
  crimson: "#DC143C",

  "off white": "#FAF9F6",
  "off-white": "#FAF9F6",
  "bottle green": "#006A4E",
  "forest green": "#228B22",
  "dark green": "#013220",
  "olive green": "#808000",
  "army green": "#4B5320",
  "military green": "#4B5320",
  "mint green": "#98FF98",
  "sea green": "#2E8B57",
  "light green": "#90EE90",
  "light blue": "#ADD8E6",
  "sky blue": "#87CEEB",
  "baby blue": "#89CFF0",
  "navy blue": "#000080",
  "royal blue": "#4169E1",
  "powder blue": "#B0E0E6",
  "dark blue": "#00008B",
  "steel blue": "#4682B4",
  "ice blue": "#D6EAF8",
  "hot pink": "#FF69B4",
  "pale pink": "#FFD1DC",
  "baby pink": "#F4C2C2",
  "pastel pink": "#FFD1DC",
  "neon pink": "#FF10F0",
  "dark pink": "#E75480",
  "light gray": "#D3D3D3",
  "light grey": "#D3D3D3",
  "dark gray": "#A9A9A9",
  "dark grey": "#A9A9A9",
  "ash gray": "#B2BEB5",
  "ash grey": "#B2BEB5",
  "burnt orange": "#CC5500",
  "dark orange": "#FF8C00",
  "neon orange": "#FF6700",
  "brick red": "#CB4154",
  "dark red": "#8B0000",
  "cherry red": "#DC143C",
  "bright red": "#FF0000",
  "wine red": "#722F37",
  "dark brown": "#4A2C17",
  "light brown": "#C4A265",
  "pastel yellow": "#FDFD96",
  "bright yellow": "#FFFF00",
  "golden yellow": "#FFD700",
  "pastel purple": "#B39EB5",
  "dark purple": "#6A0DAD",
  "light purple": "#D8B4FE",
  "pastel blue": "#AEC6CF",
  "pastel green": "#77DD77",
};

// =============================================================================
// COLOR RESOLVER
// =============================================================================

const resolveColor = (value) => {
  if (!value) {
    return null;
  }

  const stringValue = String(value).trim();

  if (
    stringValue.startsWith("#") ||
    stringValue.startsWith("rgb") ||
    stringValue.startsWith("hsl")
  ) {
    return stringValue;
  }

  const lower = stringValue.toLowerCase();

  if (COLOR_MAP[lower]) {
    return COLOR_MAP[lower];
  }

  const words = lower
    .split(/[\s\/\-_,]+/)
    .filter(Boolean);

  for (const word of words) {
    if (COLOR_MAP[word]) {
      return COLOR_MAP[word];
    }
  }

  return null;
};

// =============================================================================
// COLOR GROUP DETECTION
// =============================================================================

const isColorGroup = (name, values) => {
  const normalizedName = (name || "")
    .toLowerCase()
    .trim();

  if (
    [
      "color",
      "colour",
      "colors",
      "colours",
    ].includes(normalizedName)
  ) {
    return true;
  }

  if (!values.length) {
    return false;
  }

  const colorCount = values.filter((value) =>
    resolveColor(value)
  ).length;

  return colorCount >= Math.ceil(values.length / 2);
};

// =============================================================================
// GROUP SHOPIFY OPTIONS
// =============================================================================

const groupVariantOptions = (variantOptions) => {
  if (!Array.isArray(variantOptions)) {
    return [];
  }

  const map = new Map();

  for (const option of variantOptions) {
    const name = toStr(
      option?.name,
      "Option"
    );

    if (!map.has(name)) {
      map.set(name, []);
    }

    if (Array.isArray(option?.values)) {
      for (const value of option.values) {
        const stringValue = toStr(value, "");

        if (
          stringValue &&
          !map.get(name).includes(stringValue)
        ) {
          map.get(name).push(stringValue);
        }
      }
    } else {
      const stringValue = toStr(
        option?.value,
        ""
      );

      if (
        stringValue &&
        !map.get(name).includes(stringValue)
      ) {
        map.get(name).push(stringValue);
      }
    }
  }

  return Array.from(map.entries())
    .filter(([, values]) => values.length > 0)
    .map(([name, values]) => ({
      name,
      values,
    }));
};

// =============================================================================
// RESOLVE REAL SHOPIFY VARIANT
// =============================================================================

const resolveVariantForSelection = (
  variants,
  selected
) => {
  if (
    !Array.isArray(variants) ||
    variants.length === 0
  ) {
    return null;
  }

  const wanted = Object.entries(
    selected || {}
  ).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      value !== ""
  );

  if (wanted.length === 0) {
    return variants[0] || null;
  }

  const match = variants.find((variant) => {
    const options = Array.isArray(
      variant?.selectedOptions
    )
      ? variant.selectedOptions
      : [];

    if (!options.length) {
      return false;
    }

    return wanted.every(
      ([name, value]) =>
        options.some(
          (option) =>
            toStr(option?.name)
              .toLowerCase() ===
              String(name).toLowerCase() &&
            toStr(option?.value)
              .toLowerCase() ===
              String(value).toLowerCase()
        )
    );
  });

  return match || variants[0] || null;
};

// =============================================================================
// FEATURES
// =============================================================================

const normalizeFeatures = (src) => {
  if (!src) {
    return [];
  }

  const arr = Array.isArray(src)
    ? src
    : Array.isArray(src?.value)
    ? src.value
    : Array.isArray(src?.items)
    ? src.items
    : typeof src === "object"
    ? Object.values(src)
    : [];

  return arr
    .map((item) => {
      const properties =
        item?.properties ||
        item ||
        {};

      const icon = toStr(
        properties?.icon ??
          properties?.iconName ??
          properties?.iconId,
        ""
      );

      const label = toStr(
        properties?.label ??
          properties?.text ??
          properties?.title ??
          properties?.name,
        ""
      );

      const iconColor = toStr(
        properties?.iconColor ??
          properties?.color,
        ""
      );

      if (!label) {
        return null;
      }

      return {
        icon,
        label,
        iconColor,
      };
    })
    .filter(Boolean);
};

const DEFAULT_FEATURES = [
  {
    icon: "lock",
    label: "Secured",
    iconColor: "#6B7280",
  },
  {
    icon: "truck",
    label: "Free Shipping",
    iconColor: "#6B7280",
  },
  {
    icon: "undo",
    label: "Easy Returns",
    iconColor: "#6B7280",
  },
];

// =============================================================================
// FEATURE ICON
// =============================================================================

function FeatureIcon({
  icon,
  size,
  color,
}) {
  const name =
    resolveFA4IconName(icon) ||
    "check";

  return (
    <FontAwesome
      name={name}
      size={size}
      color={color}
    />
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function VariantSelector({
  section,
}) {
  // ===========================================================================
  // GET PROPS
  // ===========================================================================

  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw =
    unwrapValue(
      propsNode?.raw,
      {}
    ) || {};

  const presentationCss =
    unwrapValue(
      propsNode?.presentation?.properties?.css?.value,
      undefined
    ) ||
    unwrapValue(
      propsNode?.presentation?.css?.value,
      undefined
    ) ||
    unwrapValue(
      propsNode?.presentation?.properties?.css,
      undefined
    ) ||
    unwrapValue(
      propsNode?.presentation?.css,
      {}
    ) ||
    {};

  const layoutCss =
    unwrapValue(
      propsNode?.layout?.properties?.css?.value,
      undefined
    ) ||
    unwrapValue(
      propsNode?.layout?.css?.value,
      undefined
    ) ||
    unwrapValue(
      propsNode?.layout?.properties?.css,
      undefined
    ) ||
    unwrapValue(
      propsNode?.layout?.css,
      {}
    ) ||
    {};

  // ===========================================================================
  // LAYOUT STYLE
  // ===========================================================================

  const layoutStyle = pick(
    [
      raw?.layoutStyle,
      presentationCss?.layoutStyle,
      layoutCss?.layoutStyle,
      propsNode?.layoutStyle,
    ],
    "Normal"
  );

  const isInline =
    layoutStyle.toLowerCase() ===
    "inline";

  // ===========================================================================
  // VISIBILITY
  // ===========================================================================

  const rawVis =
    raw?.visibility &&
    typeof raw.visibility === "object"
      ? unwrapValue(
          raw.visibility,
          raw.visibility
        )
      : {};

  const presentationVis =
    presentationCss?.visibility &&
    typeof presentationCss.visibility === "object"
      ? unwrapValue(
          presentationCss.visibility,
          presentationCss.visibility
        )
      : {};

  const layoutVis =
    layoutCss?.visibility &&
    typeof layoutCss.visibility === "object"
      ? unwrapValue(
          layoutCss.visibility,
          layoutCss.visibility
        )
      : {};

  const vis = {
    ...rawVis,
    ...presentationVis,
    ...layoutVis,
  };

  const showSelectors = toBool(
    vis?.selectors ??
      vis?.variants ??
      vis?.options,
    true
  );

  const showFeatures = toBool(
    vis?.features ??
      vis?.badges,
    false
  );

  const showTitle = toBool(
    vis?.title ??
      vis?.text,
    true
  );

  const showBgPadding = toBool(
    vis?.bgPadding ??
      vis?.padding,
    true
  );

  // ===========================================================================
  // VARIANT GROUPS
  // ===========================================================================

  const allGroups = useMemo(
    () =>
      groupVariantOptions(
        raw?.variantOptions
      ),
    [raw?.variantOptions]
  );

  const groups = useMemo(() => {
    const filtered = allGroups.filter(
      (group) =>
        !(
          group.name === "Title" &&
          group.values.length === 1 &&
          group.values[0] ===
            "Default Title"
        )
    );

    const colorGroups =
      filtered.filter((group) =>
        isColorGroup(
          group.name,
          group.values
        )
      );

    const otherGroups =
      filtered.filter(
        (group) =>
          !isColorGroup(
            group.name,
            group.values
          )
      );

    return [
      ...colorGroups,
      ...otherGroups,
    ];
  }, [allGroups]);

  // ===========================================================================
  // SELECTED VALUES
  // ===========================================================================

  const [selected, setSelected] =
    useState(() => {
      const initial = {};

      for (const group of groups) {
        initial[group.name] =
          group.values[0] ?? null;
      }

      return initial;
    });

  const groupsKey = groups
    .map(
      (group) =>
        `${group.name}:${group.values[0] ?? ""}`
    )
    .join("|");

  useEffect(() => {
    setSelected((previous) => {
      let changed = false;

      const next = {
        ...previous,
      };

      for (const group of groups) {
        if (
          next[group.name] == null &&
          group.values[0] != null
        ) {
          next[group.name] =
            group.values[0];

          changed = true;
        }
      }

      return changed
        ? next
        : previous;
    });
  }, [groupsKey]);

  // ===========================================================================
  // PUBLISH SELECTED VARIANT
  // ===========================================================================

  const productKey =
    toStr(raw?.id) ||
    toStr(raw?.handle);

  const variants = raw?.variants;

  const selectedKey = Object.entries(
    selected
  )
    .map(
      ([key, value]) =>
        `${key}:${value ?? ""}`
    )
    .join("|");

  useEffect(() => {
    if (!productKey) {
      return;
    }

    const resolved =
      resolveVariantForSelection(
        variants,
        selected
      );

    setVariantSelection(
      productKey,
      resolved
    );
  }, [
    productKey,
    variants,
    selectedKey,
  ]);

  // ===========================================================================
  // FEATURES
  // ===========================================================================

  const dslFeatures = useMemo(
    () =>
      normalizeFeatures(
        propsNode?.features ??
          propsNode?.badges ??
          raw?.features ??
          raw?.badges
      ),
    [
      propsNode?.features,
      propsNode?.badges,
      raw?.features,
      raw?.badges,
    ]
  );

  const features =
    dslFeatures.length > 0
      ? dslFeatures
      : DEFAULT_FEATURES;

  // ===========================================================================
  // CONTAINER
  // ===========================================================================

  const containerBg = pick(
    [
      layoutCss?.container?.background,
      layoutCss?.backgroundColor,
      layoutCss?.bgColor,

      presentationCss?.container?.background,
      presentationCss?.backgroundColor,
      presentationCss?.bgColor,

      raw?.backgroundColor,
      raw?.bgColor,
    ],
    "#FFFFFF"
  );

  const padTop = pickNum(
    [
      raw?.paddingtop,
      raw?.paddingTop,
      raw?.pt,
    ],
    8
  );

  const padLeft = pickNum(
    [
      raw?.paddingleft,
      raw?.paddingLeft,
      raw?.pl,
    ],
    8
  );

  const padRight = pickNum(
    [
      raw?.paddingright,
      raw?.paddingRight,
      raw?.pr,
    ],
    8
  );

  const padBottom = pickNum(
    [
      raw?.paddingbottom,
      raw?.paddingBottom,
      raw?.pb,
    ],
    8
  );

  // ===========================================================================
  // CONTAINER BORDER
  // ===========================================================================

  const containerRadius =
    pickNum(
      [
        raw?.borderRadius,
        raw?.containerRadius,
      ],
      0
    );

  const containerBorderColor =
    pick(
      [
        raw?.borderColor,
        raw?.containerBorderColor,
      ],
      "transparent"
    );

  const containerBorderLine =
    toStr(
      raw?.borderLine ??
        raw?.containerBorderLine,
      "none"
    ).toLowerCase();

  const containerBorderWidth =
    containerBorderLine &&
    containerBorderLine !== "none"
      ? pickNum(
          [
            raw?.borderWidth,
            raw?.containerBorderWidth,
          ],
          1
        )
      : 0;

  // ===========================================================================
  // LABEL
  // ===========================================================================

  const labelColor = pick(
    [
      raw?.titleColor,
      raw?.labelColor,
    ],
    "#111111"
  );

  const labelFontSize = pickNum(
    [
      raw?.titleFontsize,
      raw?.titleFontSize,
      raw?.labelFontSize,
    ],
    14
  );

  const labelFontFamily =
    resolveFirstFont(
      raw?.titleFontfamily,
      raw?.titleFontFamily,
      raw?.labelFontFamily,
      raw?.headlineFontFamily,
      raw?.fontFamily
    ) || undefined;

  const labelFontWeight =
    resolveWeight(
      raw?.titleFontWeight ??
        raw?.titleFontweight ??
        raw?.labelFontWeight
    ) || "600";

  const labelMarginBottom =
    pickNum(
      [
        raw?.labelGap,
        raw?.labelMarginBottom,
        raw?.labelMb,
      ],
      10
    );

  // ===========================================================================
  // GROUP SPACING
  // ===========================================================================

  const groupMarginBottom =
    pickNum(
      [
        raw?.groupGap,
        raw?.groupMarginBottom,
        raw?.groupMb,
      ],
      16
    );

  // ===========================================================================
  // TEXT SELECTOR
  // ===========================================================================

  const chipFontSize =
    pickNum(
      [
        raw?.textFontsize,
        raw?.textFontSize,
        raw?.chipFontSize,
      ],
      12
    );

  const chipFontFamily =
    resolveFirstFont(
      raw?.textFontfamily,
      raw?.textFontFamily,
      raw?.chipFontFamily,
      raw?.subtextFontFamily,
      raw?.fontFamily
    ) || undefined;

  const chipFontWeight =
    resolveWeight(
      raw?.textFontWeight ??
        raw?.textFontweight ??
        raw?.chipFontWeight
    ) || "500";

  // Keep these values for DSL compatibility.
  // They are NOT used as physical padding on size buttons.
  const chipPadH =
    pickNum(
      [
        raw?.boxPaddingleft,
        raw?.boxPaddingLeft,
        raw?.chipPadH,
      ],
      4
    );

  const chipPadV =
    pickNum(
      [
        raw?.boxPaddingtop,
        raw?.boxPaddingTop,
        raw?.chipPadV,
      ],
      0
    );

  const chipGap =
    pickNum(
      [
        raw?.chipGap,
        raw?.optionGap,
        raw?.textGap,
      ],
      8
    );

  const chipBorderWidth =
    pickNum(
      [
        raw?.chipBorderWidth,
        raw?.selectorBorderWidth,
        raw?.borderWidth,
      ],
      1
    );

  // ===========================================================================
  // SELECTED CHIP
  // ===========================================================================

  const selBg = pick(
    [
      raw?.bgSelectedcolor,
      raw?.bgSelectedColor,
    ],
    "#505050"
  );

  const selText = pick(
    [
      raw?.selectedcolor,
      raw?.selectedColor,
    ],
    "#FFFFFF"
  );

  const selBorder = pick(
    [
      raw?.selectorborderSelectedColor,
      raw?.borderSelectedColor,
    ],
    "#000000"
  );

  // ===========================================================================
  // UNSELECTED CHIP
  // ===========================================================================

  const unselBg = pick(
    [
      raw?.bgUnselectedColor,
    ],
    "#FFFFFF"
  );

  const unselText = pick(
    [
      raw?.unselectedcolor,
      raw?.unselectedColor,
    ],
    "#6B7280"
  );

  const unselBorder = pick(
    [
      raw?.selectorborderUnselectedColor,
      raw?.borderUnselectedColor,
    ],
    "#C8C8C8"
  );

  // ===========================================================================
  // SOLD OUT
  // ===========================================================================

  const soldOutText = pick(
    [
      raw?.soldOutColor,
      raw?.soldOutcolor,
    ],
    "#9CA3AF"
  );

  const soldOutBg = pick(
    [
      raw?.bgSoldOutcolor,
      raw?.bgSoldOutColor,
    ],
    "#F3F4F6"
  );

  const soldOutBorder = pick(
    [
      raw?.selectorborderSoldOutColor,
      raw?.borderSoldOutColor,
    ],
    "#D1D5DB"
  );

  // ===========================================================================
  // COLOR SWATCH
  // ===========================================================================

  const swatchSize =
    pickNum(
      [
        raw?.swatchSize,
        raw?.colorSwatchSize,
      ],
      36
    );

  const swatchRadius =
    pickNum(
      [
        raw?.swatchRadius,
        raw?.colorSwatchRadius,
      ],
      8
    );

  const swatchGap =
    pickNum(
      [
        raw?.swatchGap,
        raw?.colorGap,
      ],
      10
    );

  const swatchSelectedRingColor =
    pick(
      [
        raw?.swatchSelectedColor,
        raw?.swatchRingColor,
        raw?.colorSelectedBorder,
      ],
      selBorder
    );

  const swatchSelectedRingWidth =
    pickNum(
      [
        raw?.swatchRingWidth,
        raw?.swatchBorderWidth,
      ],
      2
    );

  // ===========================================================================
  // FEATURES
  // ===========================================================================

  const featureIconSize =
    pickNum(
      [
        raw?.iconSize,
        raw?.featureIconSize,
        raw?.badgeIconSize,
      ],
      18
    );

  const featureIconColor = pick(
    [
      raw?.iconColor,
      raw?.featureIconColor,
      raw?.badgeIconColor,
    ],
    "#6B7280"
  );

  const featureFontSize =
    pickNum(
      [
        raw?.featureFontSize,
        raw?.badgeFontSize,
        raw?.featureTextSize,
      ],
      11
    );

  const featureFontColor = pick(
    [
      raw?.featureFontColor,
      raw?.badgeFontColor,
      raw?.featureTextColor,
      raw?.featureColor,
    ],
    "#6B7280"
  );

  const featureFontWeight =
    resolveWeight(
      raw?.featureFontWeight ??
        raw?.badgeFontWeight
    ) || "500";

  const featureFontFamily =
    resolveFirstFont(
      raw?.featureFontFamily,
      raw?.badgeFontFamily,
      raw?.fontFamily
    ) || undefined;

  const featurePadTop =
    pickNum(
      [
        raw?.featuresPadTop,
        raw?.featurePadTop,
        raw?.badgePadTop,
      ],
      12
    );

  const dividerColor = pick(
    [
      raw?.dividerColor,
      raw?.featureDividerColor,
    ],
    "#E5E7EB"
  );

  const dividerWidth =
    pickNum(
      [
        raw?.dividerWidth,
        raw?.featureDividerWidth,
      ],
      1
    );

  // ===========================================================================
  // NOTHING TO RENDER
  // ===========================================================================

  if (
    !groups.length &&
    !showFeatures
  ) {
    return null;
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            containerBg,

          paddingTop:
            showBgPadding
              ? padTop
              : 0,

          paddingLeft:
            showBgPadding
              ? padLeft
              : 0,

          paddingRight:
            showBgPadding
              ? padRight
              : 0,

          paddingBottom:
            showBgPadding
              ? padBottom
              : 0,

          borderRadius:
            containerRadius,

          borderWidth:
            containerBorderWidth,

          borderColor:
            containerBorderColor,
        },
      ]}
    >
      {/* =====================================================================
          VARIANT GROUPS
      ====================================================================== */}

      {showSelectors && (
        <View
          style={[
            styles.groupsContainer,
            isInline
              ? styles.inlineGroups
              : styles.normalGroups,
          ]}
        >
          {groups.map((group) => {
            const isColor =
              isColorGroup(
                group.name,
                group.values
              );

            return (
              <View
                key={group.name}
                style={[
                  styles.group,
                  {
                    marginBottom:
                      isInline
                        ? 0
                        : groupMarginBottom,

                    marginRight:
                      isInline
                        ? groupMarginBottom
                        : 0,
                  },
                ]}
              >
                {/* ===========================================================
                    TITLE
                ============================================================ */}

                {showTitle && (
                  <Text
                    style={{
                      fontSize:
                        labelFontSize,

                      color:
                        labelColor,

                      fontWeight:
                        labelFontWeight,

                      fontFamily:
                        labelFontFamily,

                      marginBottom:
                        labelMarginBottom,
                    }}
                  >
                    {group.name}
                  </Text>
                )}

                {/* ===========================================================
                    COLOR SELECTOR
                ============================================================ */}

                {isColor ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={
                      false
                    }
                    contentContainerStyle={[
                      styles.row,
                      {
                        gap: swatchGap,
                      },
                    ]}
                  >
                    {group.values.map(
                      (val) => {
                        const resolved =
                          resolveColor(
                            val
                          );

                        const hex =
                          resolved ||
                          "#9CA3AF";

                        const isWhite =
                          resolved &&
                          resolved
                            .toLowerCase() ===
                            "#ffffff";

                        const isSelected =
                          selected[
                            group.name
                          ] === val;

                        return (
                          <TouchableOpacity
                            key={val}
                            activeOpacity={
                              0.75
                            }
                            onPress={() =>
                              setSelected(
                                (previous) => ({
                                  ...previous,
                                  [group.name]:
                                    val,
                                })
                              )
                            }
                            style={[
                              styles.colorSelector,
                              {
                                width:
                                  swatchSize +
                                  8,

                                height:
                                  swatchSize +
                                  8,

                                borderRadius:
                                  swatchRadius +
                                  2,

                                borderColor:
                                  isSelected
                                    ? swatchSelectedRingColor
                                    : "transparent",

                                borderWidth:
                                  isSelected
                                    ? swatchSelectedRingWidth
                                    : 0,

                                padding:
                                  isSelected
                                    ? 3
                                    : 0,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Select color ${val}`}
                          >
                            <View
                              style={{
                                width:
                                  swatchSize,

                                height:
                                  swatchSize,

                                borderRadius:
                                  swatchRadius,

                                backgroundColor:
                                  hex,

                                borderWidth:
                                  isWhite
                                    ? 1
                                    : 0,

                                borderColor:
                                  "#E5E7EB",
                              }}
                            />
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </ScrollView>
                ) : (
                  /* =========================================================
                     SIZE / TEXT SELECTOR
                  ========================================================== */

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={
                      false
                    }
                    contentContainerStyle={[
                      styles.row,
                      {
                        gap: chipGap,
                      },
                    ]}
                  >
                    {group.values.map(
                      (val) => {
                        const isSelected =
                          selected[
                            group.name
                          ] === val;

                        /*
                         * IMPORTANT:
                         *
                         * Size selector has the SAME OUTER SIZE
                         * as color selector.
                         *
                         * We do NOT use chipPadH/chipPadV here.
                         * Those were causing the box to grow and
                         * the text to be clipped.
                         */

                        const selectorSize =
                          swatchSize + 8;

                        return (
                          <TouchableOpacity
                            key={val}
                            activeOpacity={
                              0.75
                            }
                            onPress={() =>
                              setSelected(
                                (previous) => ({
                                  ...previous,
                                  [group.name]:
                                    val,
                                })
                              )
                            }
                            style={[
                              styles.sizeSelector,
                              {
                                width:
                                  selectorSize,

                                height:
                                  selectorSize,

                                minWidth:
                                  selectorSize,

                                maxWidth:
                                  selectorSize,

                                borderRadius:
                                  swatchRadius +
                                  2,

                                backgroundColor:
                                  isSelected
                                    ? selBg
                                    : unselBg,

                                borderColor:
                                  isSelected
                                    ? selBorder
                                    : unselBorder,

                                borderWidth:
                                  chipBorderWidth,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Select ${group.name} ${val}`}
                          >
                            <Text
                              style={[
                                styles.sizeText,
                                {
                                  fontSize:
                                    chipFontSize,

                                  fontWeight:
                                    chipFontWeight,

                                  fontFamily:
                                    chipFontFamily,

                                  color:
                                    isSelected
                                      ? selText
                                      : unselText,

                                  /*
                                   * Keep text inside the same box.
                                   * No external padding.
                                   */
                                  maxWidth:
                                    selectorSize -
                                    chipBorderWidth *
                                      2 -
                                    6,

                                  lineHeight:
                                    Math.max(
                                      chipFontSize +
                                        2,
                                      14
                                    ),
                                },
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit={
                                true
                              }
                              minimumFontScale={
                                0.7
                              }
                            >
                              {val}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </ScrollView>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* =====================================================================
          FEATURE BADGES
      ====================================================================== */}

      {showFeatures &&
        features.length > 0 && (
          <View
            style={[
              styles.featuresRow,
              {
                borderTopColor:
                  dividerColor,

                paddingTop:
                  featurePadTop,

                marginTop:
                  showSelectors &&
                  groups.length > 0
                    ? 14
                    : 0,
              },
            ]}
          >
            {features.map(
              (feature, index) => (
                <React.Fragment
                  key={`feature-${index}`}
                >
                  <View
                    style={
                      styles.featureItem
                    }
                  >
                    <FeatureIcon
                      icon={
                        feature.icon
                      }
                      size={
                        featureIconSize
                      }
                      color={
                        feature.iconColor ||
                        featureIconColor
                      }
                    />

                    <Text
                      style={{
                        fontSize:
                          featureFontSize,

                        color:
                          featureFontColor,

                        fontWeight:
                          featureFontWeight,

                        marginTop: 4,

                        textAlign:
                          "center",

                        ...(featureFontFamily
                          ? {
                              fontFamily:
                                featureFontFamily,
                            }
                          : {}),
                      }}
                    >
                      {
                        feature.label
                      }
                    </Text>
                  </View>

                  {index <
                    features.length -
                      1 && (
                    <View
                      style={[
                        styles.featureDivider,
                        {
                          backgroundColor:
                            dividerColor,

                          width:
                            dividerWidth,
                        },
                      ]}
                    />
                  )}
                </React.Fragment>
              )
            )}
          </View>
        )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },

  groupsContainer: {
    width: "100%",
  },

  normalGroups: {
    flexDirection: "column",
  },

  inlineGroups: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },

  group: {
    flexShrink: 0,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },

  // ===========================================================================
  // COLOR
  // ===========================================================================

  colorSelector: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // ===========================================================================
  // SIZE / TEXT
  // ===========================================================================

  sizeSelector: {
    alignItems: "center",
    justifyContent: "center",

    /*
     * Critical:
     * prevents React Native from shrinking the selector.
     */
    flexShrink: 0,

    /*
     * No padding here.
     * Padding was the reason the text was getting clipped.
     */
    padding: 0,

    overflow: "hidden",
  },

  sizeText: {
    textAlign: "center",

    includeFontPadding: false,

    flexShrink: 0,

    padding: 0,

    margin: 0,
  },

  // ===========================================================================
  // FEATURES
  // ===========================================================================

  featuresRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",

    borderTopWidth: 1,
  },

  featureItem: {
    flex: 1,

    alignItems: "center",
    justifyContent: "flex-start",

    paddingHorizontal: 4,
  },

  featureDivider: {
    width: 1,
    height: 40,

    alignSelf: "center",
  },
});