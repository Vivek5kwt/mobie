import React, { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveFont } from "../services/typographyService";
import { resolveFA4IconName } from "../utils/faIconAlias";

// Mirrors Builder's FaqNew block (appmobidrag/builder/src/blocks/FaqNew) —
// same 4-item card (1 configurable Q&A + 3 fixed starter questions), same
// single-open accordion behavior, same "open icon always shows angle-down
// regardless of the configured closed icon" quirk.

const BRAND = "#096d70";
const LIGHT_BORDER = "#E5E7EB";
const PAD_MAX = 60;

const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
};

const str = (v, fb = "") => {
  const r = deepUnwrap(v);
  return r !== undefined && r !== null ? String(r) : fb;
};

const num = (v, fb) => {
  const r = deepUnwrap(v);
  if (r === undefined || r === null || r === "") return fb;
  if (typeof r === "number") return r;
  const p = parseFloat(r);
  return Number.isNaN(p) ? fb : p;
};

const bool = (v, fb = false) => {
  const r = deepUnwrap(v);
  if (typeof r === "boolean") return r;
  if (typeof r === "string") {
    const l = r.trim().toLowerCase();
    if (["true", "1", "yes"].includes(l)) return true;
    if (["false", "0", "no"].includes(l)) return false;
  }
  return fb;
};

const weight = (v, fb) => {
  const r = deepUnwrap(v);
  if (typeof r === "number" && Number.isFinite(r)) return r;
  const s = typeof r === "string" ? r.toLowerCase() : "";
  if (s.includes("thin")) return 200;
  if (s.includes("light")) return 300;
  if (s.includes("regular") || s.includes("normal")) return 400;
  if (s.includes("medium")) return 500;
  if (s.includes("semibold")) return 600;
  if (s.includes("bold")) return 700;
  if (s.includes("extrabold")) return 800;
  if (s.includes("black")) return 900;
  return fb;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const decorationLine = (underline, strikethrough) =>
  underline && strikethrough
    ? "underline line-through"
    : underline
      ? "underline"
      : strikethrough
        ? "line-through"
        : "none";

const parseBorderLine = (line, color, sizePx) => {
  const v = str(line, "");
  const c = color || LIGHT_BORDER;
  const w = Number.isFinite(sizePx) ? sizePx : 1;
  if (!v) return {};
  if (v === "all") return { borderWidth: w, borderColor: c };
  const style = {};
  if (v.includes("top")) { style.borderTopWidth = w; style.borderTopColor = c; }
  if (v.includes("right")) { style.borderRightWidth = w; style.borderRightColor = c; }
  if (v.includes("bottom")) { style.borderBottomWidth = w; style.borderBottomColor = c; }
  if (v.includes("left")) { style.borderLeftWidth = w; style.borderLeftColor = c; }
  return style;
};

export default function FaqNew({ section }) {
  const propsRoot = useMemo(
    () =>
      section?.properties?.props?.properties ||
      section?.properties?.props ||
      section?.props ||
      {},
    [section]
  );

  const raw = useMemo(() => {
    const r = deepUnwrap(propsRoot?.raw);
    return r && typeof r === "object" ? { ...propsRoot, ...r } : propsRoot;
  }, [propsRoot]);

  // section eyes
  const headingActive = bool(raw?.headingActive, true);
  const subHeadingActive = bool(raw?.subHeadingActive, true);
  const iconsActive = bool(raw?.iconsActive, true);
  const backgroundActive = bool(raw?.backgroundActive, true);

  // heading (question)
  const headingText = str(raw?.headingText, "How Can I Track My Order?");
  const headingSize = num(raw?.headingSize, 14);
  const headingFontFamily = resolveFont(str(raw?.headingFamily, ""));
  const headingWeight = weight(raw?.headingWeight, 700);
  const headingColor = str(raw?.headingColor, "#111827");
  const headingBold = bool(raw?.headingBold, false);
  const headingItalic = bool(raw?.headingItalic, false);
  const headingUnderline = bool(raw?.headingUnderline, false);
  const headingStrikethrough = bool(raw?.headingStrikethrough, false);
  const headingLinkHref = str(raw?.headingLinkHref, "");
  const headingUppercase = bool(raw?.headingUppercase, true);

  // sub heading (answer)
  const subHeadingText = str(
    raw?.subHeadingText,
    "You'll receive a tracking number via email once your order ships."
  );
  const subHeadingSize = num(raw?.subHeadingSize, 12);
  const subHeadingFontFamily = resolveFont(str(raw?.subHeadingFamily, ""));
  const subHeadingWeight = weight(raw?.subHeadingWeight, 400);
  const subHeadingColor = str(raw?.subHeadingColor, "#111827");
  const subHeadingBold = bool(raw?.subHeadingBold, false);
  const subHeadingItalic = bool(raw?.subHeadingItalic, false);
  const subHeadingUnderline = bool(raw?.subHeadingUnderline, false);
  const subHeadingStrikethrough = bool(raw?.subHeadingStrikethrough, false);
  const subHeadingLinkHref = str(raw?.subHeadingLinkHref, "");
  const subHeadingUppercase = bool(raw?.subHeadingUppercase, true);

  // icons
  const iconId = str(raw?.iconId, "fa-angle-down");
  const iconSize = num(raw?.iconSize, 14);
  const iconColor = str(raw?.iconColor, BRAND);
  const iconAlign = str(raw?.iconAlign, "Right") === "Left" ? "Left" : "Right";
  const closedIconName = resolveFA4IconName(iconId) || "angle-down";
  const openIconName = "angle-down";

  // background & padding
  const bg = backgroundActive
    ? {
        backgroundColor: str(raw?.backgroundColor, "#FFFFFF"),
        borderLine: str(raw?.borderLine, ""),
        borderColor: str(raw?.borderColor, LIGHT_BORDER),
        borderSize: num(raw?.borderSize, 1),
        outerCorners: num(raw?.outerCorners, 0),
        bgPadL: clamp(num(raw?.bgPadL, 0), 0, PAD_MAX),
        bgPadR: clamp(num(raw?.bgPadR, 0), 0, PAD_MAX),
        bgPadT: clamp(num(raw?.bgPadT, 0), 0, PAD_MAX),
        bgPadB: clamp(num(raw?.bgPadB, 0), 0, PAD_MAX),
      }
    : {
        backgroundColor: "#FFFFFF",
        borderLine: "",
        borderColor: LIGHT_BORDER,
        borderSize: 1,
        outerCorners: 0,
        bgPadL: 0,
        bgPadR: 0,
        bgPadT: 0,
        bgPadB: 0,
      };

  const items = useMemo(
    () => [
      {
        q: headingText || "How Can I Track My Order?",
        a: subHeadingText || "You'll receive a tracking number via email once your order ships.",
        isFirst: true,
      },
      {
        q: "What if an item is out of stock?",
        a: "Sign up for back-in-stock notifications on the product page!",
        isFirst: false,
      },
      {
        q: "How do I create an account?",
        a: 'Click "Sign Up" in the top right corner and follow the prompts.',
        isFirst: false,
      },
      {
        q: "Can I change or cancel my order?",
        a: "Contact support as soon as possible and we’ll do our best to help.",
        isFirst: false,
      },
    ],
    [headingText, subHeadingText]
  );

  const [openIdx, setOpenIdx] = useState(0);

  const questionTextStyle = {
    fontSize: headingSize,
    fontFamily: headingFontFamily || undefined,
    fontWeight: String(headingBold ? 700 : headingWeight),
    fontStyle: headingItalic ? "italic" : "normal",
    textDecorationLine: decorationLine(headingUnderline, headingStrikethrough),
    textTransform: headingUppercase ? "uppercase" : "none",
    color: headingColor,
    lineHeight: headingSize * 1.25,
  };

  const answerTextStyle = {
    fontSize: subHeadingSize,
    fontFamily: subHeadingFontFamily || undefined,
    fontWeight: String(subHeadingBold ? 700 : subHeadingWeight),
    fontStyle: subHeadingItalic ? "italic" : "normal",
    textDecorationLine: decorationLine(subHeadingUnderline, subHeadingStrikethrough),
    textTransform: subHeadingUppercase ? "uppercase" : "none",
    color: subHeadingColor,
    lineHeight: subHeadingSize * 1.35,
  };

  const openLink = (href) => {
    if (!href) return;
    Linking.openURL(href).catch(() => {});
  };

  const cardStyle = {
    ...styles.outerCard,
    backgroundColor: bg.backgroundColor,
    borderRadius: bg.outerCorners,
    paddingLeft: bg.bgPadL,
    paddingRight: bg.bgPadR,
    paddingTop: bg.bgPadT,
    paddingBottom: bg.bgPadB,
    ...parseBorderLine(bg.borderLine, bg.borderColor, bg.borderSize),
  };

  return (
    <View style={styles.wrap}>
      <View style={cardStyle}>
        <Text style={styles.title}>FAQs</Text>

        <View style={styles.list}>
          {items.map((it, idx) => {
            const isOpen = openIdx === idx;
            const iconName = isOpen ? openIconName : closedIconName;

            const iconNode = iconsActive ? (
              <FontAwesome name={iconName} size={iconSize} color={iconColor} style={styles.icon} />
            ) : null;

            return (
              <Pressable
                key={idx}
                onPress={() => setOpenIdx((p) => (p === idx ? -1 : idx))}
                style={[styles.item, { backgroundColor: isOpen ? "#EAF7F7" : "#FFFFFF" }]}
              >
                <View style={styles.itemRow}>
                  {iconAlign === "Left" ? iconNode : null}

                  <View style={styles.itemTextCol}>
                    {headingActive ? (
                      it.isFirst && headingLinkHref ? (
                        <Text
                          style={questionTextStyle}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            openLink(headingLinkHref);
                          }}
                        >
                          {it.q}
                        </Text>
                      ) : (
                        <Text style={questionTextStyle}>{it.q}</Text>
                      )
                    ) : null}
                  </View>

                  {iconAlign === "Right" ? iconNode : null}
                </View>

                {isOpen && subHeadingActive ? (
                  <View style={styles.answerWrap}>
                    {it.isFirst && subHeadingLinkHref ? (
                      <Text
                        style={answerTextStyle}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          openLink(subHeadingLinkHref);
                        }}
                      >
                        {it.a}
                      </Text>
                    ) : (
                      <Text style={answerTextStyle}>{it.a}</Text>
                    )}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
  },
  outerCard: {
    width: "100%",
    maxWidth: 360,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  list: {
    marginTop: 8,
  },
  item: {
    borderWidth: 1,
    borderColor: LIGHT_BORDER,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  itemTextCol: {
    flex: 1,
    minWidth: 0,
  },
  icon: {
    marginLeft: 8,
    marginTop: 2,
  },
  answerWrap: {
    marginTop: 8,
  },
});
