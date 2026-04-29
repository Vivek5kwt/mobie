import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveFA4IconName } from "../utils/faIconAlias";

// ─── DSL helpers ─────────────────────────────────────────────────────────────

const unwrap = (v, fallback = undefined) => {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return unwrap(v.value, fallback);
  if (v.const !== undefined) return unwrap(v.const, fallback);
  if (v.properties !== undefined) return unwrap(v.properties, fallback);
  return v;
};

const str = (v, fallback = "") => {
  const r = unwrap(v, fallback);
  return r === undefined || r === null ? fallback : String(r);
};

const num = (v, fallback) => {
  const r = unwrap(v, undefined);
  if (r === undefined || r === null || r === "") return fallback;
  if (typeof r === "number") return r;
  const p = parseFloat(String(r));
  return Number.isNaN(p) ? fallback : p;
};

const bool = (v, fallback = true) => {
  const r = unwrap(v, fallback);
  if (r === undefined || r === null) return fallback;
  if (typeof r === "boolean") return r;
  const s = String(r).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return fallback;
};

const cleanFamily = (v) => {
  if (!v) return undefined;
  const c = String(v).split(",")[0].trim().replace(/['"]/g, "");
  return c || undefined;
};

const parsePx = (v, fallback) => {
  if (v === undefined || v === null || v === "") return fallback;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? fallback : n;
};

const toFontWeight = (v, fallback = "400") => {
  if (!v) return fallback;
  const s = String(v).trim().toLowerCase();
  const map = {
    thin: "100", extralight: "200", light: "300",
    regular: "400", normal: "400", medium: "500",
    semibold: "600", "semi bold": "600",
    bold: "700", extrabold: "800", black: "900",
  };
  return map[s] || (s.match(/^\d+$/) ? s : fallback);
};

// ─── Icon component ───────────────────────────────────────────────────────────
// All icons resolved through FA4 only — no FA6 dependency needed.
function BadgeIcon({ rawIconId, size, color }) {
  if (!rawIconId) return null;
  // resolveFA4IconName handles: FA4 names, FA5/FA6 names, "fa-" prefixes
  const name = resolveFA4IconName(rawIconId) || "check";
  return <FontAwesome name={name} size={size} color={color} />;
}

// ─── Visibility key normalizer ────────────────────────────────────────────────
const toCamelCase = (id) =>
  String(id || "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrustBadges({ section }) {
  // ── Unwrap props node ───────────────────────────────────────────────────────
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw = unwrap(propsNode?.raw, {});

  const presentationRaw = unwrap(propsNode?.presentation, {});
  const pressCss        = unwrap(presentationRaw?.css, {});

  // ── Badge items ─────────────────────────────────────────────────────────────
  const dslItems = useMemo(() => {
    const src = raw?.items ?? raw?.badges ?? raw?.trustBadges ?? propsNode?.items ?? [];
    const arr = Array.isArray(src) ? src : (src && typeof src === "object" ? Object.values(src) : []);
    return arr.map((item) => {
      if (!item || typeof item !== "object") return null;
      const id    = str(item.id    ?? item.key,  "");
      const icon  = str(item.icon  ?? item.iconId ?? item.fa ?? item.iconName, "");
      const label = str(item.label ?? item.text  ?? item.title, "");
      if (!icon && !label) return null;
      return { id, icon, label };
    }).filter(Boolean);
  }, [raw, propsNode]);

  const DEFAULT_BADGES = [
    { id: "secure",        icon: "shield",   label: "Secured"       },
    { id: "free_shipping", icon: "truck",    label: "Free Shipping" },
    { id: "returns",       icon: "undo",     label: "Easy Returns"  },
  ];
  const badgeItems = dslItems.length > 0 ? dslItems : DEFAULT_BADGES;

  // ── Visibility ──────────────────────────────────────────────────────────────
  const visibilityMap = Object.assign({}, unwrap(pressCss?.visibility, {}), unwrap(raw?.visibility, {}));
  const isBadgeVisible = (item) => {
    const camel  = toCamelCase(item.id);
    const direct = item.id;
    if (visibilityMap[camel] === false || visibilityMap[direct] === false) return false;
    return true;
  };
  const visibleBadges = badgeItems.filter(isBadgeVisible);
  const badges = visibleBadges.length > 0 ? visibleBadges : badgeItems;

  // ── Per-badge icon config from presentation.css.icons ──────────────────────
  const presIcons = unwrap(pressCss?.icons, {});
  const getBadgeIconConfig = (item) => {
    const camel  = toCamelCase(item.id);
    return presIcons[camel] ?? presIcons[item.id] ?? {};
  };

  // ── Container styling ───────────────────────────────────────────────────────
  const containerCss = unwrap(pressCss?.container, {});

  const containerBg     = str(raw?.backgroundColor ?? raw?.bgColor ?? containerCss?.background ?? containerCss?.backgroundColor, "#FFFFFF");
  const containerPT     = parsePx(raw?.paddingTop    ?? raw?.pt ?? containerCss?.paddingTop,    10);
  const containerPB     = parsePx(raw?.paddingBottom ?? raw?.pb ?? containerCss?.paddingBottom, 10);
  const containerPL     = parsePx(raw?.paddingLeft   ?? raw?.pl ?? containerCss?.paddingLeft,   10);
  const containerPR     = parsePx(raw?.paddingRight  ?? raw?.pr ?? containerCss?.paddingRight,  10);
  const containerRadius = num(raw?.borderRadius ?? containerCss?.borderRadius, 0);
  const borderColor     = str(raw?.borderColor  ?? containerCss?.borderColor,  "#E5E7EB");
  const borderLine      = str(raw?.borderLine   ?? containerCss?.borderLine,   "");
  const hasBorder       = !!borderLine && borderLine !== "none";
  const borderWidth     = hasBorder ? (num(raw?.borderWidth, 1)) : 0;

  // ── Container layout ────────────────────────────────────────────────────────
  // justifyContent: space-around | space-between | space-evenly | center | flex-start | flex-end
  const rawJustify = str(raw?.justify ?? raw?.justifyContent ?? raw?.badgeJustify ?? raw?.alignment, "space-around").toLowerCase();
  const justifyContent =
    rawJustify === "space-between" ? "space-between" :
    rawJustify === "space-evenly"  ? "space-evenly"  :
    rawJustify === "center"        ? "center"         :
    rawJustify === "left"  || rawJustify === "flex-start" ? "flex-start" :
    rawJustify === "right" || rawJustify === "flex-end"   ? "flex-end"   :
    "space-around";

  // ── Badge item layout direction ─────────────────────────────────────────────
  // "vertical" (default) = icon above label | "horizontal" = icon left of label
  const rawLayout = str(raw?.badgeLayout ?? raw?.layout ?? raw?.iconPosition, "vertical").toLowerCase();
  const isHorizontal = rawLayout === "horizontal" || rawLayout === "row";

  // ── Item spacing ────────────────────────────────────────────────────────────
  const iconLabelGap  = num(raw?.iconLabelGap ?? raw?.iconGap ?? raw?.labelGap, 4);
  const badgePadH     = num(raw?.badgePadH ?? raw?.itemPadX ?? raw?.itemPaddingH, 4);
  const badgePadV     = num(raw?.badgePadV ?? raw?.itemPadY ?? raw?.itemPaddingV, 0);

  // ── Global icon defaults ────────────────────────────────────────────────────
  const globalIconSize  = num(raw?.iconSize,  24);
  const globalIconColor = str(raw?.iconColor, "#111111");

  // ── Label defaults ──────────────────────────────────────────────────────────
  const titleCss        = unwrap(pressCss?.title, {});
  const labelFontSize   = num(raw?.titleFontSize ?? raw?.fontSize ?? raw?.labelFontSize ?? titleCss?.fontSize, 12);
  const labelColor      = str(raw?.titleColor    ?? raw?.labelColor ?? titleCss?.color,  "#000000");
  const labelFontFamily = cleanFamily(str(raw?.titleFontFamily ?? raw?.fontFamily ?? raw?.labelFontFamily ?? titleCss?.fontFamily, ""));
  const labelFontWeight = toFontWeight(raw?.titleFontWeight ?? raw?.fontWeight ?? raw?.labelFontWeight ?? titleCss?.fontWeight, "400");
  const labelAlign      = isHorizontal ? "left" : "center";

  // ── Dividers ────────────────────────────────────────────────────────────────
  const showDividers = bool(raw?.showDividers ?? propsNode?.showDividers, true);
  const dividerColor = str(raw?.dividerColor, "#E5E7EB");
  const dividerWidth = num(raw?.dividerWidth, 1);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop:      containerPT,
          paddingBottom:   containerPB,
          paddingLeft:     containerPL,
          paddingRight:    containerPR,
          backgroundColor: containerBg,
          borderRadius:    containerRadius,
          borderWidth:     borderWidth,
          borderColor:     borderColor,
          justifyContent,
        },
      ]}
    >
      {badges.map((badge, idx) => {
        const iconCfg       = getBadgeIconConfig(badge);
        const resolvedIcon  = str(iconCfg?.icon ?? iconCfg?.iconId ?? badge.icon, "check");
        const resolvedSize  = num(iconCfg?.size  ?? iconCfg?.iconSize  ?? globalIconSize,  24);
        const resolvedColor = str(iconCfg?.color ?? iconCfg?.iconColor ?? globalIconColor, "#111111");
        const resolvedLabel = str(iconCfg?.label ?? badge.label, "");

        return (
          <React.Fragment key={`badge-${badge.id || idx}`}>
            <View
              style={[
                styles.badgeItem,
                {
                  flexDirection:  isHorizontal ? "row" : "column",
                  paddingHorizontal: badgePadH,
                  paddingVertical:   badgePadV,
                  gap: iconLabelGap,
                },
              ]}
            >
              <BadgeIcon
                rawIconId={resolvedIcon}
                size={resolvedSize}
                color={resolvedColor}
              />
              {!!resolvedLabel && (
                <Text
                  style={{
                    fontSize:   labelFontSize,
                    color:      labelColor,
                    fontWeight: labelFontWeight,
                    textAlign:  labelAlign,
                    ...(labelFontFamily ? { fontFamily: labelFontFamily } : {}),
                  }}
                  numberOfLines={2}
                >
                  {resolvedLabel}
                </Text>
              )}
            </View>

            {showDividers && idx < badges.length - 1 && (
              <View
                style={{
                  width:           dividerWidth,
                  height:          36,
                  backgroundColor: dividerColor,
                  alignSelf:       "center",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width:         "100%",
    flexDirection: "row",
    alignItems:    "center",
    flexWrap:      "wrap",
  },
  badgeItem: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
});
