import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

// ─── DSL helpers ─────────────────────────────────────────────────────────────

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toString = (value, fallback = "") => {
  const r = unwrapValue(value, fallback);
  return r === undefined || r === null ? fallback : String(r);
};

const toNumber = (value, fallback) => {
  const r = unwrapValue(value, undefined);
  if (r === undefined || r === "") return fallback;
  if (typeof r === "number") return r;
  const p = parseFloat(r);
  return Number.isNaN(p) ? fallback : p;
};

const toBoolean = (value, fallback = true) => {
  const r = unwrapValue(value, fallback);
  if (r === undefined || r === null) return fallback;
  if (typeof r === "boolean") return r;
  if (typeof r === "string") return ["true", "1", "yes", "y"].includes(r.toLowerCase());
  return Boolean(r);
};

// ─── Color name → hex map ────────────────────────────────────────────────────
const COLOR_MAP = {
  red: "#EF4444", blue: "#3B82F6", green: "#22C55E", yellow: "#EAB308",
  orange: "#F97316", purple: "#A855F7", pink: "#EC4899", black: "#111827",
  white: "#FFFFFF", gray: "#9CA3AF", grey: "#9CA3AF", brown: "#92400E",
  teal: "#0D9488", cyan: "#06B6D4", indigo: "#6366F1", violet: "#7C3AED",
  lime: "#84CC16", amber: "#F59E0B", rose: "#F43F5E", sky: "#0EA5E9",
  navy: "#1E3A5F", beige: "#F5F0E8", ivory: "#FFFFF0", coral: "#FF6B6B",
  gold: "#FFD700", silver: "#C0C0C0", maroon: "#800000", olive: "#808000",
  magenta: "#FF00FF", turquoise: "#40E0D0", lavender: "#E6E6FA",
};

const resolveColor = (value) => {
  if (!value) return null;
  const v = String(value).trim();
  if (v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl")) return v;
  return COLOR_MAP[v.toLowerCase()] || null;
};

const isColorGroup = (name, values) => {
  const n = (name || "").toLowerCase();
  if (["color", "colour", "colors", "colours"].includes(n)) return true;
  // If at least half the values look like colors, treat as color group
  if (values.length === 0) return false;
  const colorCount = values.filter((v) => resolveColor(v)).length;
  return colorCount >= Math.ceil(values.length / 2);
};

// ─── Normalize feature badges from DSL ───────────────────────────────────────
const normalizeFeatures = (raw) => {
  if (!raw) return [];
  let src = raw;
  if (raw?.value) src = raw.value;
  else if (raw?.properties?.value) src = raw.properties.value;

  const mapItem = (item) => {
    const p = item?.properties || item || {};
    const icon  = toString(p?.icon ?? p?.iconName ?? p?.fa, "");
    const label = toString(p?.label ?? p?.text ?? p?.title ?? p?.name, "");
    const iconColor = toString(p?.iconColor ?? p?.color, "");
    if (!label) return null;
    return { icon, label, iconColor };
  };

  if (Array.isArray(src)) return src.map(mapItem).filter(Boolean);
  if (src && typeof src === "object") return Object.values(src).map(mapItem).filter(Boolean);
  return [];
};

// ─── Group flat variantOptions by name ───────────────────────────────────────
const groupVariantOptions = (variantOptions) => {
  if (!Array.isArray(variantOptions)) return [];
  const map = new Map();
  for (const opt of variantOptions) {
    const name = toString(opt?.name, "Option");
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(toString(opt?.value, ""));
  }
  return Array.from(map.entries()).map(([name, values]) => ({ name, values }));
};

// ─── Default feature badges (shown only when DSL has none) ───────────────────
const DEFAULT_FEATURES = [
  { icon: "lock",    fa: 5, label: "Secured",       iconColor: "#6B7280" },
  { icon: "truck",   fa: 5, label: "Free Shipping",  iconColor: "#6B7280" },
  { icon: "rotate-left", fa: 6, label: "Easy Returns", iconColor: "#6B7280" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function VariantSelector({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw        = unwrapValue(propsNode?.raw, {});
  const bgCss      = unwrapValue(propsNode?.backgroundAndPadding ?? propsNode?.background, {});
  const groupCss   = unwrapValue(propsNode?.groupLabel ?? propsNode?.label, {});
  const swatchCss  = unwrapValue(propsNode?.swatch ?? propsNode?.colorSwatch, {});
  const chipCss    = unwrapValue(propsNode?.chip ?? propsNode?.sizeChip, {});
  const featureCss = unwrapValue(propsNode?.featureStyle ?? propsNode?.badge, {});
  const visibility = unwrapValue(propsNode?.visibility, {});

  // ── Variant groups ─────────────────────────────────────────────────────────
  const groups = useMemo(
    () => groupVariantOptions(raw?.variantOptions),
    [raw?.variantOptions]
  );

  // Selected value per group
  const [selected, setSelected] = useState(() => {
    const init = {};
    for (const g of groupVariantOptions(raw?.variantOptions ?? [])) {
      init[g.name] = null;
    }
    return init;
  });

  // ── Feature badges ─────────────────────────────────────────────────────────
  const dslFeatures = useMemo(
    () =>
      normalizeFeatures(
        propsNode?.features ??
        propsNode?.badges ??
        propsNode?.trustBadges ??
        raw?.features ??
        raw?.badges
      ),
    [propsNode?.features, propsNode?.badges, propsNode?.trustBadges, raw?.features, raw?.badges]
  );

  const features = dslFeatures.length > 0 ? dslFeatures : DEFAULT_FEATURES;

  // ── Visibility ─────────────────────────────────────────────────────────────
  const showVariants = toBoolean(visibility?.variants ?? visibility?.options, true);
  const showFeatures = toBoolean(visibility?.features ?? visibility?.badges, true);

  if (!groups.length && !showFeatures) return null;

  // ── Background / padding ───────────────────────────────────────────────────
  const resolvedPL = (() => { const v = toNumber(bgCss?.paddingLeft, 16); return v === 0 ? 16 : v; })();
  const resolvedPR = (() => { const v = toNumber(bgCss?.paddingRight, 16); return v === 0 ? 16 : v; })();
  const containerPad = {
    paddingTop:    toNumber(bgCss?.paddingTop, 12),
    paddingBottom: toNumber(bgCss?.paddingBottom, 12),
    paddingLeft:   resolvedPL,
    paddingRight:  resolvedPR,
    backgroundColor: toString(bgCss?.bgColor, "#FFFFFF"),
    borderRadius: toNumber(bgCss?.cornerRadius, 0),
    borderWidth: bgCss?.borderLine ? 1 : 0,
    borderColor: toString(bgCss?.borderColor, "#E5E7EB"),
  };

  // ── Group label styles ─────────────────────────────────────────────────────
  const labelFontSize   = toNumber(groupCss?.fontSize, 13);
  const labelColor      = toString(groupCss?.color, "#111827");
  const labelFontWeight = toString(groupCss?.fontWeight, "600");
  const labelMB         = toNumber(groupCss?.marginBottom, 8);

  // ── Swatch styles ──────────────────────────────────────────────────────────
  const swatchSize         = toNumber(swatchCss?.size, 30);
  const swatchBorderRadius = toNumber(swatchCss?.borderRadius, 999);
  const swatchGap          = toNumber(swatchCss?.gap, 10);
  const swatchSelectedBorder = toString(swatchCss?.selectedBorderColor, "#111827");
  const swatchSelectedBorderWidth = toNumber(swatchCss?.selectedBorderWidth, 2);
  const swatchBorderColor  = toString(swatchCss?.borderColor, "#E5E7EB");

  // ── Chip styles ────────────────────────────────────────────────────────────
  const chipFontSize       = toNumber(chipCss?.fontSize, 12);
  const chipBorderRadius   = toNumber(chipCss?.borderRadius, 8);
  const chipGap            = toNumber(chipCss?.gap, 8);
  const chipPH             = toNumber(chipCss?.paddingH, 14);
  const chipPV             = toNumber(chipCss?.paddingV, 7);
  const chipSelectedBg     = toString(chipCss?.selectedBg, "#FECDD3");
  const chipSelectedColor  = toString(chipCss?.selectedColor, "#111827");
  const chipSelectedBorder = toString(chipCss?.selectedBorderColor, "#F9A8D4");
  const chipUnselectedBg   = toString(chipCss?.unselectedBg, "#FFFFFF");
  const chipUnselectedColor= toString(chipCss?.unselectedColor, "#6B7280");
  const chipBorderColor    = toString(chipCss?.borderColor, "#E5E7EB");
  const chipBorderWidth    = toNumber(chipCss?.borderWidth, 1);

  // ── Feature badge styles ───────────────────────────────────────────────────
  const featureIconSize    = toNumber(featureCss?.iconSize, 18);
  const featureIconColor   = toString(featureCss?.iconColor, "#6B7280");
  const featureFontSize    = toNumber(featureCss?.fontSize, 11);
  const featureFontColor   = toString(featureCss?.color, "#6B7280");
  const featureFontWeight  = toString(featureCss?.fontWeight, "500");
  const featureDividerColor= toString(featureCss?.dividerColor, "#E5E7EB");

  return (
    <View style={[styles.container, containerPad]}>

      {/* ── Variant groups ─────────────────────────────────────────────────── */}
      {showVariants && groups.map((group) => {
        const isColor = isColorGroup(group.name, group.values);
        return (
          <View key={group.name} style={styles.group}>
            {/* Group label */}
            <Text
              style={{
                fontSize:   labelFontSize,
                color:      labelColor,
                fontWeight: labelFontWeight,
                marginBottom: labelMB,
              }}
            >
              {group.name}
            </Text>

            {isColor ? (
              /* ── Color swatches ─────────────────────────────────────────── */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.row, { gap: swatchGap }]}
              >
                {group.values.map((val) => {
                  const hex = resolveColor(val) || "#E5E7EB";
                  const isSelected = selected[group.name] === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      activeOpacity={0.75}
                      onPress={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [group.name]: isSelected ? null : val,
                        }))
                      }
                      style={[
                        styles.swatchWrap,
                        isSelected && {
                          borderColor: swatchSelectedBorder,
                          borderWidth: swatchSelectedBorderWidth,
                        },
                        {
                          width:        swatchSize + (isSelected ? 6 : 4),
                          height:       swatchSize + (isSelected ? 6 : 4),
                          borderRadius: swatchBorderRadius,
                          borderColor:  isSelected ? swatchSelectedBorder : swatchBorderColor,
                          borderWidth:  isSelected ? swatchSelectedBorderWidth : 1,
                          padding:      isSelected ? 2 : 2,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Select color ${val}`}
                    >
                      <View
                        style={{
                          flex:         1,
                          borderRadius: swatchBorderRadius - 2,
                          backgroundColor: hex,
                          borderWidth: hex.toLowerCase() === "#ffffff" || hex.toLowerCase() === "white" ? 1 : 0,
                          borderColor: "#E5E7EB",
                        }}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              /* ── Text chips ─────────────────────────────────────────────── */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.row, { gap: chipGap }]}
              >
                {group.values.map((val) => {
                  const isSelected = selected[group.name] === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      activeOpacity={0.75}
                      onPress={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [group.name]: isSelected ? null : val,
                        }))
                      }
                      style={[
                        styles.chip,
                        {
                          paddingHorizontal: chipPH,
                          paddingVertical:   chipPV,
                          borderRadius:      chipBorderRadius,
                          backgroundColor:   isSelected ? chipSelectedBg   : chipUnselectedBg,
                          borderColor:       isSelected ? chipSelectedBorder : chipBorderColor,
                          borderWidth:       chipBorderWidth,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${group.name} ${val}`}
                    >
                      <Text
                        style={{
                          fontSize:   chipFontSize,
                          fontWeight: "500",
                          color:      isSelected ? chipSelectedColor : chipUnselectedColor,
                        }}
                      >
                        {val}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        );
      })}

      {/* ── Feature badges ─────────────────────────────────────────────────── */}
      {showFeatures && features.length > 0 && (
        <View
          style={[
            styles.featuresRow,
            { borderTopColor: featureDividerColor, marginTop: showVariants && groups.length ? 14 : 0 },
          ]}
        >
          {features.map((feat, idx) => (
            <React.Fragment key={`feat-${idx}`}>
              <View style={styles.featureItem}>
                <FeatureIcon
                  icon={feat.icon}
                  size={featureIconSize}
                  color={feat.iconColor || featureIconColor}
                />
                <Text
                  style={{
                    fontSize:   featureFontSize,
                    color:      featureFontColor,
                    fontWeight: featureFontWeight,
                    marginTop:  4,
                    textAlign:  "center",
                  }}
                >
                  {feat.label}
                </Text>
              </View>
              {idx < features.length - 1 && (
                <View style={[styles.featureDivider, { backgroundColor: featureDividerColor }]} />
              )}
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Icon renderer: tries FontAwesome6 then FontAwesome ───────────────────────
function FeatureIcon({ icon, size, color }) {
  if (!icon) return <FontAwesome6 name="circle-dot" size={size} color={color} />;

  const fa5Icons = ["lock","truck","undo","refresh","check","star","heart","shield","home","user","tag"];
  const useFa5 = fa5Icons.includes(icon);

  try {
    if (useFa5) {
      return <FontAwesome name={icon} size={size} color={color} />;
    }
    return <FontAwesome6 name={icon} size={size} color={color} />;
  } catch {
    return <FontAwesome name="check" size={size} color={color} />;
  }
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  group: {
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  // ── Color swatch ──────────────────────────────────────────────────────────
  swatchWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  // ── Size chip ─────────────────────────────────────────────────────────────
  chip: {
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Feature badges ────────────────────────────────────────────────────────
  featuresRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingTop: 12,
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
