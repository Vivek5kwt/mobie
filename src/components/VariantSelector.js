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
import { resolveFont } from "../services/typographyService";

// ─── DSL helpers ──────────────────────────────────────────────────────────────

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toStr = (value, fallback = "") => {
  const r = unwrapValue(value, fallback);
  if (r === undefined || r === null) return fallback;
  const s = String(r).trim();
  return s && s !== "undefined" && s !== "null" ? s : fallback;
};

const toNum = (value, fallback) => {
  const r = unwrapValue(value, undefined);
  if (r === undefined || r === null || r === "") return fallback;
  if (typeof r === "number") return r;
  const p = parseFloat(r);
  return Number.isNaN(p) ? fallback : p;
};

const toBool = (value, fallback = true) => {
  const r = unwrapValue(value, undefined);
  if (r === undefined || r === null) return fallback;
  if (typeof r === "boolean") return r;
  if (typeof r === "number") return r !== 0;
  if (typeof r === "string") return ["true", "1", "yes", "y"].includes(r.trim().toLowerCase());
  return fallback;
};

// Pick first non-empty string from a list of raw DSL candidates
const pick = (candidates, fallback = "") => {
  for (const c of candidates) {
    const v = toStr(c, "");
    if (v) return v;
  }
  return fallback;
};

const pickNum = (candidates, fallback) => {
  for (const c of candidates) {
    const r = unwrapValue(c, undefined);
    if (r === undefined || r === null || r === "") continue;
    const n = typeof r === "number" ? r : parseFloat(String(r));
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
};

const resolveWeight = (value) => {
  const v = unwrapValue(value, undefined);
  if (!v && v !== 0) return undefined;
  const w = String(v).toLowerCase().trim();
  if (w === "bold")                        return "700";
  if (w === "semibold" || w === "semi bold") return "600";
  if (w === "medium")                      return "500";
  if (w === "regular" || w === "normal")   return "400";
  if (w === "light")                       return "300";
  if (/^\d+$/.test(w))                     return w;
  return undefined;
};

// ─── Color helpers ────────────────────────────────────────────────────────────
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
  if (values.length === 0) return false;
  const colorCount = values.filter((v) => resolveColor(v)).length;
  return colorCount >= Math.ceil(values.length / 2);
};

// ─── Group variant options — handles BOTH Shopify formats:
//   Format A (options): [{ name: "Color", values: ["Red","Blue"] }]
//   Format B (selectedOptions): [{ name: "Color", value: "Red" }, { name: "Color", value: "Blue" }]
const groupVariantOptions = (variantOptions) => {
  if (!Array.isArray(variantOptions)) return [];
  const map = new Map();

  for (const opt of variantOptions) {
    const name = toStr(opt?.name, "Option");
    if (!map.has(name)) map.set(name, []);

    if (Array.isArray(opt?.values)) {
      // Format A — Shopify product.options: { name, values: [...] }
      for (const v of opt.values) {
        const s = toStr(v, "");
        if (s && !map.get(name).includes(s)) map.get(name).push(s);
      }
    } else {
      // Format B — selectedOptions: { name, value }
      const s = toStr(opt?.value, "");
      if (s && !map.get(name).includes(s)) map.get(name).push(s);
    }
  }

  return Array.from(map.entries())
    .filter(([, values]) => values.length > 0)
    .map(([name, values]) => ({ name, values }));
};

// ─── Feature badges ───────────────────────────────────────────────────────────
const normalizeFeatures = (src) => {
  if (!src) return [];
  const arr = Array.isArray(src)
    ? src
    : Array.isArray(src?.value) ? src.value
    : Array.isArray(src?.items) ? src.items
    : typeof src === "object" ? Object.values(src) : [];
  return arr.map((item) => {
    const p = item?.properties || item || {};
    const icon  = toStr(p?.icon ?? p?.iconName, "");
    const label = toStr(p?.label ?? p?.text ?? p?.title ?? p?.name, "");
    const iconColor = toStr(p?.iconColor ?? p?.color, "");
    if (!label) return null;
    return { icon, label, iconColor };
  }).filter(Boolean);
};

const DEFAULT_FEATURES = [
  { icon: "lock",        label: "Secured",       iconColor: "#6B7280" },
  { icon: "truck",       label: "Free Shipping",  iconColor: "#6B7280" },
  { icon: "rotate-left", label: "Easy Returns",   iconColor: "#6B7280" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function VariantSelector({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  // raw holds ALL style + data props for this component
  const raw = unwrapValue(propsNode?.raw, {}) || {};

  // ── Visibility (inside raw.visibility) ────────────────────────────────────
  const vis = (raw?.visibility && typeof raw.visibility === "object") ? raw.visibility : {};
  const showSelectors = toBool(vis?.selectors ?? vis?.variants ?? vis?.options, true);
  const showFeatures  = toBool(vis?.features  ?? vis?.badges,                  false);

  // ── Variant groups ─────────────────────────────────────────────────────────
  const allGroups = useMemo(
    () => groupVariantOptions(raw?.variantOptions),
    [raw?.variantOptions]
  );

  // Hide Shopify's synthetic "Title: Default Title" placeholder — not a real variant
  const groups = useMemo(
    () => allGroups.filter(g =>
      !(g.name === "Title" && g.values.length === 1 && g.values[0] === "Default Title")
    ),
    [allGroups]
  );

  const [selected, setSelected] = useState(() => {
    const init = {};
    for (const g of groups) init[g.name] = null;
    return init;
  });

  // ── Feature badges ─────────────────────────────────────────────────────────
  const dslFeatures = useMemo(
    () => normalizeFeatures(propsNode?.features ?? propsNode?.badges ?? raw?.features ?? raw?.badges),
    [propsNode?.features, propsNode?.badges, raw?.features, raw?.badges]
  );
  const features = dslFeatures.length > 0 ? dslFeatures : DEFAULT_FEATURES;

  if (!groups.length && !showFeatures) return null;

  // ── Container / background ─────────────────────────────────────────────────
  const containerBg  = pick([raw?.backgroundColor, raw?.bgColor], "#FFFFFF");
  const padTop       = pickNum([raw?.paddingTop],    20);
  const padLeft      = pickNum([raw?.paddingLeft],   20);
  const padRight     = pickNum([raw?.paddingRight],  20);
  const padBottom    = pickNum([raw?.paddingBottom], 20);

  // ── Group label ────────────────────────────────────────────────────────────
  const labelColor      = pick([raw?.titleColor],      "#111111");
  const labelFontSize   = pickNum([raw?.titleFontsize,  raw?.titleFontSize],  14);
  const labelFontFamily = resolveFont(pick([raw?.titleFontfamily, raw?.titleFontFamily], "")) || "Inter";
  const labelFontWeight = resolveWeight(raw?.titleFontWeight ?? raw?.titleFontweight) || "600";

  // ── Chip (text selector) styles ────────────────────────────────────────────
  const chipFontSize   = pickNum([raw?.textFontsize, raw?.textFontSize],   12);
  const chipFontFamily = resolveFont(pick([raw?.textFontfamily, raw?.textFontFamily], "")) || "Inter";
  const chipFontWeight = resolveWeight(raw?.textFontWeight ?? raw?.textFontweight) || "500";
  const chipRadius     = pickNum([raw?.buttonRadius, raw?.boxBorderRadius], 8);
  const chipPadH       = pickNum([raw?.boxPaddingleft, raw?.boxPaddingLeft], 14);
  const chipPadV       = pickNum([raw?.boxPaddingtop,  raw?.boxPaddingTop],  8);

  // Selected state
  const selBg     = pick([raw?.bgSelectedcolor,    raw?.bgSelectedColor],    "#505050");
  const selText   = pick([raw?.selectedcolor,      raw?.selectedColor],      "#FFFFFF");
  const selBorder = pick([
    raw?.selectorborderSelectedColor,
    raw?.borderSelectedColor,
  ], "#000000");

  // Unselected state
  const unselBg     = pick([raw?.bgUnselectedColor],                                    "#FFFFFF");
  const unselText   = pick([raw?.unselectedcolor,    raw?.unselectedColor],              "#6B7280");
  const unselBorder = pick([
    raw?.selectorborderUnselectedColor,
    raw?.borderUnselectedColor,
  ], "#C8C8C8");

  // Sold-out state
  const soldOutText   = pick([raw?.soldOutColor,   raw?.soldOutcolor],   "#9CA3AF");
  const soldOutBg     = pick([raw?.bgSoldOutcolor, raw?.bgSoldOutColor], "#F3F4F6");
  const soldOutBorder = pick([
    raw?.selectorborderSoldOutColor,
    raw?.borderSoldOutColor,
  ], "#D1D5DB");

  // ── Swatch (color selector) styles ────────────────────────────────────────
  const swatchSize   = 30;
  const swatchRadius = 999;  // always circular

  // ── Feature badge styles ───────────────────────────────────────────────────
  const featureIconSize  = pickNum([raw?.iconSize],   18);
  const featureIconColor = pick([raw?.iconColor],     "#6B7280");
  const featureFontSize  = 11;
  const featureFontColor = "#6B7280";
  const dividerColor     = "#E5E7EB";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: containerBg,
          paddingTop:    padTop,
          paddingLeft:   padLeft,
          paddingRight:  padRight,
          paddingBottom: padBottom,
        },
      ]}
    >
      {/* ── Variant groups ──────────────────────────────────────────────────── */}
      {showSelectors && groups.map((group) => {
        const isColor = isColorGroup(group.name, group.values);
        return (
          <View key={group.name} style={styles.group}>
            {/* Group label */}
            <Text
              style={{
                fontSize:    labelFontSize,
                color:       labelColor,
                fontWeight:  labelFontWeight,
                fontFamily:  labelFontFamily || undefined,
                marginBottom: 10,
              }}
            >
              {group.name}
            </Text>

            {isColor ? (
              /* ── Color swatches ─────────────────────────────────────────── */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.row, { gap: 10 }]}
              >
                {group.values.map((val) => {
                  const hex = resolveColor(val) || "#E5E7EB";
                  const isSel = selected[group.name] === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      activeOpacity={0.75}
                      onPress={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [group.name]: isSel ? null : val,
                        }))
                      }
                      style={[
                        styles.swatchWrap,
                        {
                          width:        swatchSize + 6,
                          height:       swatchSize + 6,
                          borderRadius: swatchRadius,
                          borderColor:  isSel ? selBorder : "transparent",
                          borderWidth:  isSel ? 2 : 2,
                          padding:      2,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Select color ${val}`}
                    >
                      <View
                        style={{
                          flex:            1,
                          borderRadius:    swatchRadius,
                          backgroundColor: hex,
                          borderWidth: hex.toLowerCase() === "#ffffff" ? 1 : 0,
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
                contentContainerStyle={[styles.row, { gap: 8 }]}
              >
                {group.values.map((val) => {
                  const isSel = selected[group.name] === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      activeOpacity={0.75}
                      onPress={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [group.name]: isSel ? null : val,
                        }))
                      }
                      style={[
                        styles.chip,
                        {
                          paddingHorizontal: Math.max(chipPadH, 10),
                          paddingVertical:   Math.max(chipPadV, 7),
                          borderRadius:      chipRadius,
                          backgroundColor:   isSel ? selBg    : unselBg,
                          borderColor:       isSel ? selBorder : unselBorder,
                          borderWidth:       1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${group.name} ${val}`}
                    >
                      <Text
                        style={{
                          fontSize:   chipFontSize,
                          fontWeight: chipFontWeight,
                          fontFamily: chipFontFamily || undefined,
                          color:      isSel ? selText : unselText,
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

      {/* ── Feature badges ──────────────────────────────────────────────────── */}
      {showFeatures && features.length > 0 && (
        <View
          style={[
            styles.featuresRow,
            {
              borderTopColor: dividerColor,
              marginTop: showSelectors && groups.length > 0 ? 14 : 0,
            },
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
                    fontSize:  featureFontSize,
                    color:     featureFontColor,
                    fontWeight: "500",
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  {feat.label}
                </Text>
              </View>
              {idx < features.length - 1 && (
                <View style={[styles.featureDivider, { backgroundColor: dividerColor }]} />
              )}
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Icon renderer ────────────────────────────────────────────────────────────
function FeatureIcon({ icon, size, color }) {
  if (!icon) return <FontAwesome6 name="circle-dot" size={size} color={color} />;
  const fa5Icons = ["lock", "truck", "undo", "refresh", "check", "star", "heart", "shield", "home", "user", "tag"];
  try {
    if (fa5Icons.includes(icon)) return <FontAwesome name={icon} size={size} color={color} />;
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
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  swatchWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    alignItems: "center",
    justifyContent: "center",
  },
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
