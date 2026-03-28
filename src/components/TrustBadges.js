import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
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

// ─── Normalize badge items from various DSL shapes ────────────────────────────
const normalizeBadges = (raw) => {
  if (!raw) return [];
  let src = raw;
  if (raw?.value) src = raw.value;
  else if (raw?.properties?.value) src = raw.properties.value;

  const mapItem = (item) => {
    if (!item) return null;
    const p = item?.properties || item || {};
    const label    = toString(p?.label ?? p?.text ?? p?.title ?? p?.name, "");
    const icon     = toString(p?.icon ?? p?.iconName ?? p?.fa ?? p?.faIcon, "");
    const iconLib  = toString(p?.iconLib ?? p?.lib ?? p?.library, "");
    const iconColor = toString(p?.iconColor ?? p?.color ?? p?.tintColor, "");
    const labelColor = toString(p?.labelColor ?? p?.textColor ?? p?.fontColor, "");
    const iconSize  = toNumber(p?.iconSize ?? p?.size, undefined);
    if (!label && !icon) return null;
    return { label, icon, iconLib, iconColor, labelColor, iconSize };
  };

  if (Array.isArray(src)) return src.map(mapItem).filter(Boolean);
  if (src && typeof src === "object") return Object.values(src).map(mapItem).filter(Boolean);
  return [];
};

// ─── Default badges shown when DSL provides no items ─────────────────────────
const DEFAULT_BADGES = [
  { label: "Secured",       icon: "shield",       iconLib: "fa6", iconColor: "", labelColor: "" },
  { label: "Free Shipping", icon: "truck-fast",   iconLib: "fa6", iconColor: "", labelColor: "" },
  { label: "Easy Returns",  icon: "rotate-left",  iconLib: "fa6", iconColor: "", labelColor: "" },
];

// ─── Icon renderer ────────────────────────────────────────────────────────────
const FA5_ICONS = [
  "shield","truck","undo","refresh","lock","check","star","heart","home","user",
  "tag","share-alt","times","arrow-left","search","microphone","bars",
];

function BadgeIcon({ icon, iconLib, size, color }) {
  if (!icon) return null;
  const useFa5 =
    iconLib === "fa" ||
    iconLib === "fa5" ||
    FA5_ICONS.includes(icon);
  try {
    if (useFa5) {
      return <FontAwesome name={icon} size={size} color={color} />;
    }
    return <FontAwesome6 name={icon} size={size} color={color} />;
  } catch {
    return <FontAwesome name="check" size={size} color={color} />;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrustBadges({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw       = unwrapValue(propsNode?.raw, {});
  const bgCss     = unwrapValue(propsNode?.backgroundAndPadding ?? propsNode?.background, {});
  const badgeCss  = unwrapValue(propsNode?.badgeStyle ?? propsNode?.badge ?? propsNode?.item, {});
  const iconCss   = unwrapValue(propsNode?.iconStyle ?? propsNode?.icon, {});
  const labelCss  = unwrapValue(propsNode?.labelStyle ?? propsNode?.label, {});
  const dividerCss= unwrapValue(propsNode?.divider, {});

  // ── Badge items ─────────────────────────────────────────────────────────────
  const dslBadges = useMemo(() =>
    normalizeBadges(
      propsNode?.badges ??
      propsNode?.items ??
      propsNode?.trustBadges ??
      raw?.badges ??
      raw?.items ??
      raw?.trustBadges
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [propsNode?.badges, propsNode?.items, propsNode?.trustBadges, raw?.badges, raw?.items]
  );

  const badges = dslBadges.length > 0 ? dslBadges : DEFAULT_BADGES;

  // ── Visibility ──────────────────────────────────────────────────────────────
  const showDividers = toBoolean(dividerCss?.visible ?? propsNode?.showDividers, true);

  // ── Container padding / bg ──────────────────────────────────────────────────
  const resolvedPL = (() => { const v = toNumber(bgCss?.paddingLeft, 16); return v === 0 ? 16 : v; })();
  const resolvedPR = (() => { const v = toNumber(bgCss?.paddingRight, 16); return v === 0 ? 16 : v; })();
  const containerStyle = {
    paddingTop:      toNumber(bgCss?.paddingTop, 14),
    paddingBottom:   toNumber(bgCss?.paddingBottom, 14),
    paddingLeft:     resolvedPL,
    paddingRight:    resolvedPR,
    backgroundColor: toString(bgCss?.bgColor, "#FFFFFF"),
    borderRadius:    toNumber(bgCss?.cornerRadius, 0),
    borderWidth:     bgCss?.borderLine ? 1 : 0,
    borderColor:     toString(bgCss?.borderColor, "#E5E7EB"),
  };

  // ── Icon defaults ───────────────────────────────────────────────────────────
  const globalIconSize  = toNumber(iconCss?.size ?? badgeCss?.iconSize, 22);
  const globalIconColor = toString(iconCss?.color ?? badgeCss?.iconColor, "#111827");

  // ── Label defaults ──────────────────────────────────────────────────────────
  const globalLabelFontSize   = toNumber(labelCss?.fontSize ?? badgeCss?.fontSize, 11);
  const globalLabelColor      = toString(labelCss?.color ?? badgeCss?.color, "#374151");
  const globalLabelFontWeight = toString(labelCss?.fontWeight ?? badgeCss?.fontWeight, "500");
  const labelMT               = toNumber(labelCss?.marginTop ?? badgeCss?.labelMarginTop, 5);

  // ── Divider ─────────────────────────────────────────────────────────────────
  const dividerColor = toString(dividerCss?.color ?? propsNode?.dividerColor, "#E5E7EB");
  const dividerWidth = toNumber(dividerCss?.width, 1);

  return (
    <View style={[styles.container, containerStyle]}>
      {badges.map((badge, idx) => (
        <React.Fragment key={`badge-${idx}`}>
          <View style={styles.badgeItem}>
            <BadgeIcon
              icon={badge.icon}
              iconLib={badge.iconLib || toString(iconCss?.lib, "")}
              size={badge.iconSize ?? globalIconSize}
              color={badge.iconColor || globalIconColor}
            />
            {!!badge.label && (
              <Text
                style={{
                  fontSize:   globalLabelFontSize,
                  color:      badge.labelColor || globalLabelColor,
                  fontWeight: globalLabelFontWeight,
                  marginTop:  labelMT,
                  textAlign:  "center",
                }}
              >
                {badge.label}
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  badgeItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
