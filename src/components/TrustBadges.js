import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

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

// Strip "fa-" / "fas-" / "far-" etc. prefix
const stripFaPrefix = (name) => {
  if (!name) return "";
  return String(name).trim().replace(/^fa[srldb]?[-_]/i, "").toLowerCase();
};

// ─── Icon component ───────────────────────────────────────────────────────────

function BadgeIcon({ rawIconId, size, color }) {
  if (!rawIconId) return null;
  const bare = stripFaPrefix(rawIconId);
  if (!bare) return null;
  // Always use FontAwesome6 — the builder sends FA6 icon names (shield-halved,
  // truck-fast, rotate-left, etc.) which are NOT in FA4 or map to the wrong icon.
  // FA6 free covers all of these names correctly.
  return <FontAwesome6 name={bare} size={size} color={color} />;
}

// ─── Visibility key normalizer ────────────────────────────────────────────────
// DSL uses "freeShipping", item id uses "free_shipping" — normalize to camelCase
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

  // raw = the flat settings object (iconSize, iconColor, fontSize, paddingTop, etc.)
  const raw = unwrap(propsNode?.raw, {});

  // presentation.css = icons per-badge, container, visibility
  const presentationRaw = unwrap(propsNode?.presentation, {});
  const pressCss        = unwrap(presentationRaw?.css, {});

  // ── Badge items ─────────────────────────────────────────────────────────────
  // DSL stores items in raw.items as an array of {id, icon, label}
  const dslItems = useMemo(() => {
    const src = raw?.items ?? raw?.badges ?? raw?.trustBadges ?? propsNode?.items ?? [];
    const arr = Array.isArray(src) ? src : (src && typeof src === "object" ? Object.values(src) : []);
    return arr.map((item) => {
      if (!item || typeof item !== "object") return null;
      const id    = str(item.id    ?? item.key,  "");
      const icon  = str(item.icon  ?? item.fa,   "");
      const label = str(item.label ?? item.text ?? item.title, "");
      if (!icon && !label) return null;
      return { id, icon, label };
    }).filter(Boolean);
  }, [raw, propsNode]);

  const DEFAULT_BADGES = [
    { id: "secure",        icon: "shield-halved", label: "Secured"       },
    { id: "free_shipping", icon: "truck-fast",    label: "Free Shipping" },
    { id: "returns",       icon: "rotate-left",   label: "Easy Returns"  },
  ];
  const badgeItems = dslItems.length > 0 ? dslItems : DEFAULT_BADGES;

  // ── Visibility ──────────────────────────────────────────────────────────────
  // pressCss.visibility has {secured: false, returns: true, freeShipping: true}
  // raw.visibility may also carry overrides
  const visibilityMap = Object.assign({}, unwrap(pressCss?.visibility, {}), unwrap(raw?.visibility, {}));
  const isBadgeVisible = (item) => {
    const camel = toCamelCase(item.id);
    const direct = item.id;
    // undefined means visible by default
    if (visibilityMap[camel] === false || visibilityMap[direct] === false) return false;
    return true;
  };
  const visibleBadges = badgeItems.filter(isBadgeVisible);
  const badges = visibleBadges.length > 0 ? visibleBadges : badgeItems;

  // ── Per-badge icon config from presentation.css.icons ──────────────────────
  // pressCss.icons = { secured: {icon, size, color, label}, freeShipping: {...}, returns: {...} }
  const presIcons = unwrap(pressCss?.icons, {});
  const getBadgeIconConfig = (item) => {
    const camel  = toCamelCase(item.id);
    const config = presIcons[camel] ?? presIcons[item.id] ?? {};
    return config;
  };

  // ── Container styling ───────────────────────────────────────────────────────
  const containerCss = unwrap(pressCss?.container, {});

  const containerBg     = str(raw?.backgroundColor ?? containerCss?.background ?? containerCss?.backgroundColor, "#FFFFFF");
  const containerPT     = parsePx(raw?.paddingTop    ?? containerCss?.paddingTop,    10);
  const containerPB     = parsePx(raw?.paddingBottom ?? containerCss?.paddingBottom, 10);
  const containerPL     = parsePx(raw?.paddingLeft   ?? containerCss?.paddingLeft,   10);
  const containerPR     = parsePx(raw?.paddingRight  ?? containerCss?.paddingRight,  10);
  const containerRadius = num(raw?.borderRadius ?? containerCss?.borderRadius, 0);
  const borderColor     = str(raw?.borderColor  ?? containerCss?.borderColor,  "#E5E7EB");
  const borderLine      = str(raw?.borderLine   ?? containerCss?.borderLine,   "");
  const hasBorder       = !!borderLine && borderLine !== "none" && borderLine !== "";
  const borderWidth     = hasBorder ? 1 : 0;

  // ── Global icon defaults ────────────────────────────────────────────────────
  const globalIconSize  = num(raw?.iconSize,  24);
  const globalIconColor = str(raw?.iconColor, "#111111");

  // ── Label defaults ──────────────────────────────────────────────────────────
  const titleCss = unwrap(pressCss?.title, {});
  const labelFontSize   = num(raw?.titleFontSize ?? raw?.fontSize ?? titleCss?.fontSize, 14);
  const labelColor      = str(raw?.titleColor    ?? titleCss?.color,      "#000000");
  const labelFontFamily = cleanFamily(str(raw?.titleFontFamily ?? raw?.fontFamily ?? titleCss?.fontFamily, ""));
  const _labelWeightRaw = str(raw?.titleFontWeight ?? raw?.fontWeight ?? titleCss?.fontWeight, "400");
  const _weightMap = { thin:"100", extralight:"200", light:"300", regular:"400", medium:"500", semibold:"600", bold:"700", extrabold:"800", black:"900" };
  const labelFontWeight = _weightMap[_labelWeightRaw.toLowerCase()] || String(_labelWeightRaw);

  // ── Dividers ────────────────────────────────────────────────────────────────
  const showDividers   = bool(raw?.showDividers ?? propsNode?.showDividers, true);
  const dividerColor   = str(raw?.dividerColor, "#E5E7EB");
  const dividerWidth   = num(raw?.dividerWidth, 1);

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
        },
      ]}
    >
      {badges.map((badge, idx) => {
        const iconCfg      = getBadgeIconConfig(badge);
        const resolvedIcon = str(iconCfg?.icon ?? badge.icon, "");
        const resolvedSize = num(iconCfg?.size ?? globalIconSize, 24);
        const resolvedColor= str(iconCfg?.color ?? globalIconColor, "#111111");
        const resolvedLabel= str(iconCfg?.label ?? badge.label, "");

        return (
          <React.Fragment key={`badge-${badge.id || idx}`}>
            <View style={styles.badgeItem}>
              <BadgeIcon
                rawIconId={resolvedIcon}
                size={resolvedSize}
                color={resolvedColor}
              />
              {!!resolvedLabel && (
                <Text
                  style={{
                    marginTop:  4,
                    fontSize:   labelFontSize,
                    color:      labelColor,
                    fontWeight: labelFontWeight,
                    textAlign:  "center",
                    ...(labelFontFamily ? { fontFamily: labelFontFamily } : {}),
                  }}
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
    width:           "100%",
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-around",
  },
  badgeItem: {
    flex:             1,
    alignItems:       "center",
    justifyContent:   "center",
    paddingHorizontal: 4,
  },
});
