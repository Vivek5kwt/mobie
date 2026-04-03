import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";

// ── helpers ────────────────────────────────────────────────────────────────

const unwrap = (v, fallback) => {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "object") {
    if (v.value !== undefined) return v.value;
    if (v.const !== undefined) return v.const;
    if (v.properties !== undefined) return unwrap(v.properties, fallback);
  }
  return v;
};

const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
};

const str  = (v, fb = "")    => { const r = unwrap(v, fb); return r !== undefined && r !== null ? String(r) : fb; };
const num  = (v, fb)         => { const r = unwrap(v, undefined); if (r === undefined || r === "") return fb; if (typeof r === "number") return r; const p = parseFloat(r); return Number.isNaN(p) ? fb : p; };
const bool = (v, fb = true)  => { const r = unwrap(v, fb); if (typeof r === "boolean") return r; if (typeof r === "number") return r !== 0; if (typeof r === "string") { const l = r.trim().toLowerCase(); if (["true","1","yes","y"].includes(l)) return true; if (["false","0","no","n"].includes(l)) return false; } return fb; };

const parseIconName = (iconClass) => {
  if (!iconClass || typeof iconClass !== "string") return "";
  const tokens = iconClass.split(" ").filter(Boolean);
  const skip = new Set(["fa-solid","fa-regular","fa-light","fa-thin","fa-brands"]);
  const tok = tokens.find((t) => t.startsWith("fa-") && !skip.has(t)) || tokens.find((t) => t.startsWith("fa-"));
  if (!tok) return iconClass.replace(/^fa-/, ""); // plain name fallback
  return tok.replace(/^fa-/, "");
};

const buildBorder = (side, color) => {
  const s = String(side || "").toLowerCase();
  if (!s || s === "none") return {};
  const c = color || "#E5E7EB";
  if (s === "all" || s === "full") return { borderWidth: 1, borderColor: c };
  if (s === "bottom") return { borderBottomWidth: 1, borderColor: c };
  if (s === "top")    return { borderTopWidth:    1, borderColor: c };
  if (s === "left")   return { borderLeftWidth:   1, borderColor: c };
  if (s === "right")  return { borderRightWidth:  1, borderColor: c };
  return {};
};

// ── component ───────────────────────────────────────────────────────────────

export default function AccountMenu({ section }) {
  const navigation = useNavigation();

  const rawProps = useMemo(() => {
    const root =
      section?.properties?.props?.properties ||
      section?.properties?.props ||
      section?.props ||
      {};
    const raw = deepUnwrap(root?.raw);
    return raw && typeof raw === "object" ? { ...root, ...raw } : root;
  }, [section]);

  // ── container DSL props ──────────────────────────────────────────────────
  const bgColor        = str(rawProps?.bgColor,        "#FFFFFF");
  const borderRadius   = num(rawProps?.borderRadius ?? rawProps?.borderCorners, 12);
  const borderSide     = str(rawProps?.borderSide  ?? rawProps?.borderLine, "all");
  const borderColor    = str(rawProps?.borderColor,    "#E5E7EB");
  const pt             = num(rawProps?.pt,              0);
  const pb             = num(rawProps?.pb,              0);
  const pl             = num(rawProps?.pl,              0);
  const pr             = num(rawProps?.pr,              0);

  // ── row DSL props ────────────────────────────────────────────────────────
  const rowPt          = num(rawProps?.rowPt ?? rawProps?.itemPt, 13);
  const rowPb          = num(rawProps?.rowPb ?? rawProps?.itemPb, 13);
  const rowPl          = num(rawProps?.rowPl ?? rawProps?.itemPl, 14);
  const rowPr          = num(rawProps?.rowPr ?? rawProps?.itemPr, 14);
  const rowGap         = num(rawProps?.gap  ?? rawProps?.rowGap,  12);

  // ── icon defaults ────────────────────────────────────────────────────────
  const defIconBg      = str(rawProps?.iconBg    ?? rawProps?.iconBgColor,    "#374151");
  const defIconColor   = str(rawProps?.iconColor,                              "#FFFFFF");
  const defIconSize    = num(rawProps?.iconSize,                               16);
  const iconCircleSize = num(rawProps?.iconCircleSize ?? rawProps?.iconWrapSize, 36);
  const iconCircleRadius = num(rawProps?.iconCircleRadius, iconCircleSize / 2);

  // ── label defaults ───────────────────────────────────────────────────────
  const labelColor     = str(rawProps?.labelColor  ?? rawProps?.textColor,    "#111827");
  const labelSize      = num(rawProps?.labelFontSize ?? rawProps?.fontSize,   15);
  const labelWeight    = str(rawProps?.labelFontWeight ?? rawProps?.fontWeight, "600");

  // ── chevron ──────────────────────────────────────────────────────────────
  const showChevron    = bool(rawProps?.showChevron ?? rawProps?.showArrow,   true);
  const chevronColor   = str(rawProps?.chevronColor,                           "#9CA3AF");
  const chevronSize    = num(rawProps?.chevronSize,                            13);

  // ── divider ──────────────────────────────────────────────────────────────
  const showDivider    = bool(rawProps?.showDivider,                           true);
  const dividerColor   = str(rawProps?.dividerColor,                           "#F3F4F6");

  // ── items array ──────────────────────────────────────────────────────────
  const items = useMemo(() => {
    const candidates = [
      rawProps?.items,
      rawProps?.menuItems,
      rawProps?.options,
      rawProps?.links,
    ];
    for (const c of candidates) {
      const r = deepUnwrap(c);
      if (Array.isArray(r) && r.length > 0) return r;
    }

    // Single-item fallback: build one item from flat DSL props
    const label = str(rawProps?.text ?? rawProps?.label ?? rawProps?.title, "");
    if (label) {
      return [{
        label,
        iconClass: str(rawProps?.iconName ?? rawProps?.iconClass ?? rawProps?.icon, "fa-user"),
        link: str(rawProps?.link ?? rawProps?.href ?? rawProps?.url, ""),
        iconBg: str(rawProps?.iconBg ?? rawProps?.iconBgColor, defIconBg),
        iconColor: str(rawProps?.iconColor, defIconColor),
      }];
    }
    return [];
  }, [rawProps, defIconBg, defIconColor]);

  if (!items.length) return null;

  const handlePress = (item) => {
    const link = str(item?.link ?? item?.href ?? item?.url ?? item?.page, "");
    if (!link) return;
    try {
      navigation.navigate(link);
    } catch (_) {}
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderRadius,
          paddingTop:    pt,
          paddingBottom: pb,
          paddingLeft:   pl,
          paddingRight:  pr,
          ...buildBorder(borderSide, borderColor),
        },
      ]}
    >
      {items.map((item, index) => {
        const rawItem = deepUnwrap(item) || item || {};
        const itemLabel     = str(rawItem?.label ?? rawItem?.text ?? rawItem?.title, "");
        const itemIconClass = str(rawItem?.iconClass ?? rawItem?.icon ?? rawItem?.iconName, "fa-user");
        const itemIconBg    = str(rawItem?.iconBg ?? rawItem?.iconBgColor, defIconBg);
        const itemIconColor = str(rawItem?.iconColor, defIconColor);
        const itemIconSize  = num(rawItem?.iconSize, defIconSize);
        const itemShowChevron = bool(rawItem?.showChevron ?? rawItem?.showArrow, showChevron);
        const iconName = parseIconName(itemIconClass) || "user";

        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            <TouchableOpacity
              activeOpacity={0.65}
              style={[
                styles.row,
                {
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
                  { color: labelColor, fontSize: labelSize, fontWeight: labelWeight },
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
              <View style={[styles.divider, { backgroundColor: dividerColor, marginLeft: rowPl + iconCircleSize + rowGap }]} />
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
    overflow: "hidden",
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
    marginRight: 0,
  },
});
