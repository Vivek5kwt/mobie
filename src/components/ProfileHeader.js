import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useAuth } from "../services/AuthContext";

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

const str = (v, fallback = "") => {
  const r = unwrap(v, fallback);
  return r !== undefined && r !== null ? String(r) : fallback;
};

const num = (v, fallback) => {
  const r = unwrap(v, undefined);
  if (r === undefined || r === "") return fallback;
  if (typeof r === "number") return r;
  const p = parseFloat(r);
  return Number.isNaN(p) ? fallback : p;
};

const bool = (v, fallback = true) => {
  const r = unwrap(v, fallback);
  if (typeof r === "boolean") return r;
  if (typeof r === "number") return r !== 0;
  if (typeof r === "string") {
    const l = r.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(l)) return true;
    if (["false", "0", "no", "n"].includes(l)) return false;
  }
  return fallback;
};

const buildBorder = (side, color) => {
  const s = String(side || "").toLowerCase();
  if (!s || s === "none") return {};
  const c = color || "#E5E7EB";
  if (s === "all" || s === "full") return { borderWidth: 1, borderColor: c };
  if (s === "bottom") return { borderBottomWidth: 1, borderColor: c };
  if (s === "top") return { borderTopWidth: 1, borderColor: c };
  if (s === "left") return { borderLeftWidth: 1, borderColor: c };
  if (s === "right") return { borderRightWidth: 1, borderColor: c };
  return {};
};

// ── component ───────────────────────────────────────────────────────────────

export default function ProfileHeader({ section }) {
  const { session } = useAuth();

  const rawProps = useMemo(() => {
    const root =
      section?.properties?.props?.properties ||
      section?.properties?.props ||
      section?.props ||
      {};
    const raw = deepUnwrap(root?.raw);
    return (raw && typeof raw === "object") ? { ...root, ...raw } : root;
  }, [section]);

  // ── DSL values ──────────────────────────────────────────────────────────

  const bgColor        = str(rawProps?.bgColor,        "#FFFFFF");
  const pt             = num(rawProps?.pt,              14);
  const pb             = num(rawProps?.pb,              14);
  const pl             = num(rawProps?.pl,              16);
  const pr             = num(rawProps?.pr,              16);

  const showAvatar     = bool(rawProps?.showAvatar ?? rawProps?.showImage,           true);
  const showName       = bool(rawProps?.showName  ?? rawProps?.showProfileName,      true);
  const showEmail      = bool(rawProps?.showEmail,                                   true);

  const avatarSize     = num(rawProps?.avatarSize  ?? rawProps?.imageSize,           48);
  const avatarRadius   = num(rawProps?.avatarRadius ?? rawProps?.imageRadius,        avatarSize / 2);
  const avatarBg       = str(rawProps?.avatarBg    ?? rawProps?.avatarBgColor ?? rawProps?.placeholderBg, "#D1ECF1");
  const avatarIconColor= str(rawProps?.avatarIconColor ?? rawProps?.placeholderIconColor,                 "#016D77");
  const avatarIconSize = num(rawProps?.avatarIconSize,                               Math.round(avatarSize * 0.46));

  const nameColor      = str(rawProps?.nameColor,      "#111827");
  const nameFontSize   = num(rawProps?.nameFontSize,   15);
  const nameFontWeight = str(rawProps?.nameFontWeight, "700");

  const emailColor     = str(rawProps?.emailColor,     "#6B7280");
  const emailFontSize  = num(rawProps?.emailFontSize,  13);

  const borderSide     = str(rawProps?.borderSide ?? rawProps?.borderLine, "none");
  const borderColor    = str(rawProps?.borderColor,    "#E5E7EB");
  const gap            = num(rawProps?.gap,             12);

  // avatarUrl — from DSL or (future) session photo
  const avatarUrl      = str(rawProps?.avatarUrl ?? rawProps?.imageUrl, "");

  // ── user data — session first, DSL fallback ─────────────────────────────
  const userName  = str(rawProps?.name  ?? session?.user?.name  ?? "", "");
  const userEmail = str(rawProps?.email ?? session?.user?.email ?? "", "");

  // If DSL provides static demo values, prefer those; otherwise session
  const displayName  = str(rawProps?.name,  "") || str(session?.user?.name,  "");
  const displayEmail = str(rawProps?.email, "") || str(session?.user?.email, "");

  if (!showName && !showEmail && !showAvatar) return null;

  const containerStyle = {
    backgroundColor: bgColor,
    paddingTop:    pt,
    paddingBottom: pb,
    paddingLeft:   pl,
    paddingRight:  pr,
    gap,
    ...buildBorder(borderSide, borderColor),
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {showAvatar && (
        <View
          style={[
            styles.avatarWrap,
            { width: avatarSize, height: avatarSize, borderRadius: avatarRadius, backgroundColor: avatarBg },
          ]}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: avatarSize, height: avatarSize, borderRadius: avatarRadius }}
              resizeMode="cover"
            />
          ) : (
            <FontAwesome name="user" size={avatarIconSize} color={avatarIconColor} />
          )}
        </View>
      )}

      <View style={styles.textBlock}>
        {showName && !!displayName && (
          <Text
            numberOfLines={1}
            style={[styles.name, { color: nameColor, fontSize: nameFontSize, fontWeight: nameFontWeight }]}
          >
            {displayName}
          </Text>
        )}
        {showEmail && !!displayEmail && (
          <Text
            numberOfLines={1}
            style={[styles.email, { color: emailColor, fontSize: emailFontSize }]}
          >
            {displayEmail}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  avatarWrap: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  textBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    fontWeight: "700",
  },
  email: {},
});
