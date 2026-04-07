import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { convertStyles } from "../utils/convertStyles";

// ── helpers ────────────────────────────────────────────────────────────────

const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
};

const str  = (v, fb = "")    => { const r = deepUnwrap(v); return (r !== undefined && r !== null) ? String(r) : fb; };
const num  = (v, fb)         => { const r = deepUnwrap(v); if (r === undefined || r === null || r === "") return fb; if (typeof r === "number") return r; const p = parseFloat(r); return Number.isNaN(p) ? fb : p; };
const bool = (v, fb = true)  => { const r = deepUnwrap(v); if (typeof r === "boolean") return r; if (typeof r === "number") return r !== 0; if (typeof r === "string") { const l = r.trim().toLowerCase(); if (["true","1","yes","y"].includes(l)) return true; if (["false","0","no","n"].includes(l)) return false; } return fb; };

const parseIconName = (iconClass) => {
  if (!iconClass || typeof iconClass !== "string") return "";
  const tokens = iconClass.split(" ").filter(Boolean);
  const skip = new Set(["fa-solid","fa-regular","fa-light","fa-thin","fa-brands"]);
  const tok = tokens.find((t) => t.startsWith("fa-") && !skip.has(t)) || tokens.find((t) => t.startsWith("fa-"));
  if (!tok) return iconClass.replace(/^fa-/, "");
  return tok.replace(/^fa-/, "");
};

// Parse "1px solid #E5E7EB" → { borderWidth: 1, borderColor: "#E5E7EB" }
const parseBorderString = (val) => {
  if (!val || typeof val !== "string") return {};
  const parts = val.trim().split(/\s+/);
  const width = parseFloat(parts[0]);
  const color = parts.find((p) => p.startsWith("#") || p.startsWith("rgb"));
  if (!Number.isNaN(width) && color) return { borderWidth: width, borderColor: color };
  return {};
};

// Parse "10px" → 10, "999px" → 999, 10 → 10
const parsePx = (val, fb) => {
  if (val === undefined || val === null) return fb;
  if (typeof val === "number") return val;
  const p = parseFloat(String(val));
  return Number.isNaN(p) ? fb : p;
};

// ── component ───────────────────────────────────────────────────────────────

export default function AccountMenu({ section }) {
  const navigation = useNavigation();

  // ── props root ───────────────────────────────────────────────────────────
  const propsRoot = useMemo(() => (
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {}
  ), [section]);

  // ── raw props (user-editable values) ────────────────────────────────────
  const rawProps = useMemo(() => {
    const raw = deepUnwrap(propsRoot?.raw);
    return (raw && typeof raw === "object") ? { ...propsRoot, ...raw } : propsRoot;
  }, [propsRoot]);

  // ── presentation CSS (builder-generated styling) ─────────────────────────
  // Handles both:
  //   presentation.value.css  (account_menu pattern)
  //   presentation.properties.css.value  (account_profile pattern)
  const css = useMemo(() => {
    const pres =
      deepUnwrap(propsRoot?.presentation) ||
      deepUnwrap(propsRoot?.presentation?.properties) ||
      {};
    return deepUnwrap(pres?.css) || {};
  }, [propsRoot]);

  const cssRow       = useMemo(() => convertStyles(css?.row       || {}), [css]);
  const cssIconWrap  = useMemo(() => convertStyles(css?.iconWrap  || {}), [css]);
  const cssLabel     = useMemo(() => convertStyles(css?.label     || {}), [css]);
  const cssChevron   = useMemo(() => convertStyles(css?.chevron   || {}), [css]);
  const cssContainer = useMemo(() => convertStyles(css?.container || {}), [css]);

  // ── container / row background ───────────────────────────────────────────
  // Priority: rawProps.containerBgColor → CSS container.background → white
  // NOTE: rawProps.bgColor in DSL is often the icon bg accent, NOT the row bg
  const containerBg = str(
    rawProps?.containerBgColor ?? rawProps?.rowBgColor,
    cssContainer?.backgroundColor || cssRow?.backgroundColor || "#FFFFFF"
  );

  // ── row border ────────────────────────────────────────────────────────────
  // CSS may have "border: 1px solid #E5E7EB" as a string — parse it
  const rawBorderSide  = str(rawProps?.borderSide ?? rawProps?.borderLine, "");
  const rawBorderColor = str(rawProps?.borderColor, "");
  const rawBorderRadius = num(rawProps?.borderRadius ?? rawProps?.borderCorners, undefined);

  // From CSS
  const cssBorder        = parseBorderString(css?.row?.border || "");
  const cssBorderRadius  = parsePx(css?.row?.borderRadius, undefined);

  const borderWidth  = cssBorder?.borderWidth  ?? (rawBorderSide && rawBorderSide !== "none" ? 1 : 0);
  const borderColor  = rawBorderColor || cssBorder?.borderColor || "#E5E7EB";
  const borderRadius = rawBorderRadius ?? cssBorderRadius ?? 10;

  // ── row padding ───────────────────────────────────────────────────────────
  const rowPt = num(rawProps?.pt ?? rawProps?.rowPt ?? rawProps?.itemPt, parsePx(css?.row?.paddingTop,    13));
  const rowPb = num(rawProps?.pb ?? rawProps?.rowPb ?? rawProps?.itemPb, parsePx(css?.row?.paddingBottom, 13));
  const rowPl = num(rawProps?.pl ?? rawProps?.rowPl ?? rawProps?.itemPl, parsePx(css?.row?.paddingLeft,   14));
  const rowPr = num(rawProps?.pr ?? rawProps?.rowPr ?? rawProps?.itemPr, parsePx(css?.row?.paddingRight,  14));
  const rowGap = num(rawProps?.gap ?? rawProps?.rowGap, parsePx(css?.row?.gap, 12));

  // ── icon circle ───────────────────────────────────────────────────────────
  // CSS iconWrap provides size + bg; raw iconBgColor / iconColor override
  const cssIconWrapSize   = parsePx(css?.iconWrap?.width,        32);
  const cssIconWrapRadius = parsePx(css?.iconWrap?.borderRadius, cssIconWrapSize / 2);
  const cssIconWrapBg     = cssIconWrap?.backgroundColor || "#374151";

  const defIconBg      = str(rawProps?.iconBgColor ?? rawProps?.iconBg, cssIconWrapBg);
  const defIconColor   = str(rawProps?.iconColor,                        "#FFFFFF");
  const defIconSize    = num(rawProps?.iconSize,                         16);
  const iconCircleSize = num(rawProps?.iconCircleSize ?? rawProps?.iconWrapSize, cssIconWrapSize);
  const iconCircleRadius = num(rawProps?.iconCircleRadius, cssIconWrapRadius);

  // ── label ─────────────────────────────────────────────────────────────────
  const labelColor  = str(rawProps?.textColor   ?? rawProps?.labelColor,   cssLabel?.color       || "#111827");
  const labelSize   = num(rawProps?.textFontSize ?? rawProps?.labelFontSize ?? rawProps?.fontSize, parsePx(css?.label?.fontSize, 15));
  const labelWeight = (() => {
    const raw = str(rawProps?.textFontWeight ?? rawProps?.labelFontWeight ?? rawProps?.fontWeight, "");
    if (!raw) return String(cssLabel?.fontWeight || "600");
    const l = raw.toLowerCase();
    if (l === "bold") return "700";
    if (l === "semibold") return "600";
    if (l === "medium") return "500";
    if (l === "regular" || l === "normal") return "400";
    return raw;
  })();
  const labelBold   = bool(rawProps?.textBold, false);

  // ── chevron ───────────────────────────────────────────────────────────────
  const showChevron  = bool(rawProps?.showChevron ?? rawProps?.showArrow, true);
  const chevronColor = str(rawProps?.chevronColor, cssChevron?.color || "#9CA3AF");
  const chevronSize  = num(rawProps?.chevronSize,  13);

  // ── divider ───────────────────────────────────────────────────────────────
  const showDivider  = bool(rawProps?.showDivider,  true);
  const dividerColor = str(rawProps?.dividerColor, "#F3F4F6");

  // ── items array ──────────────────────────────────────────────────────────
  const items = useMemo(() => {
    const candidates = [rawProps?.items, rawProps?.menuItems, rawProps?.options, rawProps?.links];
    for (const c of candidates) {
      const r = deepUnwrap(c);
      if (Array.isArray(r) && r.length > 0) return r;
    }
    // Single-item fallback from flat DSL props
    const label = str(rawProps?.text ?? rawProps?.label ?? rawProps?.title, "");
    if (label) {
      return [{
        label,
        iconClass: str(rawProps?.iconName ?? rawProps?.iconClass ?? rawProps?.icon, "fa-user"),
        iconBg:    str(rawProps?.iconBgColor ?? rawProps?.iconBg, defIconBg),
        iconColor: str(rawProps?.iconColor, defIconColor),
        iconSize:  num(rawProps?.iconSize, defIconSize),
        link:      str(rawProps?.linkHref ?? rawProps?.navigateTo ?? rawProps?.link ?? rawProps?.href, ""),
      }];
    }
    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawProps]);

  if (!items.length) return null;

  const handlePress = (item) => {
    const link = str(item?.link ?? item?.href ?? item?.url ?? item?.page ?? item?.navigateTo, "");
    if (!link) return;
    try { navigation.navigate(link); } catch (_) {}
  };

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      {items.map((item, index) => {
        const rawItem  = deepUnwrap(item) || item || {};
        const itemLabel       = str(rawItem?.label ?? rawItem?.text ?? rawItem?.title, "");
        const itemIconClass   = str(rawItem?.iconClass ?? rawItem?.icon ?? rawItem?.iconName, "fa-user");
        const itemIconBg      = str(rawItem?.iconBg ?? rawItem?.iconBgColor, defIconBg);
        const itemIconColor   = str(rawItem?.iconColor, defIconColor);
        const itemIconSize    = num(rawItem?.iconSize, defIconSize);
        const itemShowChevron = bool(rawItem?.showChevron ?? rawItem?.showArrow, showChevron);
        const iconName        = parseIconName(itemIconClass) || "user";
        const isLast          = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            <TouchableOpacity
              activeOpacity={0.65}
              style={[
                styles.row,
                {
                  backgroundColor: cssRow?.backgroundColor || "#FFFFFF",
                  borderWidth,
                  borderColor,
                  borderRadius,
                  paddingTop:    rowPt,
                  paddingBottom: rowPb,
                  paddingLeft:   rowPl,
                  paddingRight:  rowPr,
                  gap:           rowGap,
                },
              ]}
              onPress={() => handlePress(rawItem)}
            >
              {/* Left icon circle */}
              <View
                style={[
                  styles.iconCircle,
                  {
                    width:           iconCircleSize,
                    height:          iconCircleSize,
                    borderRadius:    iconCircleRadius,
                    backgroundColor: itemIconBg,
                  },
                ]}
              >
                <FontAwesome name={iconName} size={itemIconSize} color={itemIconColor} />
              </View>

              {/* Label */}
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    color:      labelColor,
                    fontSize:   labelSize,
                    fontWeight: labelBold ? "700" : labelWeight,
                  },
                ]}
              >
                {itemLabel}
              </Text>

              {/* Chevron */}
              {itemShowChevron && (
                <FontAwesome name="chevron-right" size={chevronSize} color={chevronColor} />
              )}
            </TouchableOpacity>

            {/* Divider between rows */}
            {showDivider && !isLast && (
              <View
                style={[
                  styles.divider,
                  {
                    backgroundColor: dividerColor,
                    marginLeft: rowPl + iconCircleSize + rowGap,
                  },
                ]}
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
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    height: 1,
  },
});
