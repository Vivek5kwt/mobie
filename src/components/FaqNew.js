import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { convertStyles } from "../utils/convertStyles";

const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
  }
  return value;
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes"].includes(lowered)) return true;
    if (["false", "0", "no"].includes(lowered)) return false;
  }
  return fallback;
};

const decorationLine = (underline, strikethrough) =>
  underline && strikethrough
    ? "underline line-through"
    : underline
      ? "underline"
      : strikethrough
        ? "line-through"
        : "none";

const normalizeProps = (section) =>
  section?.props ||
  section?.properties?.props?.properties ||
  section?.properties?.props ||
  {};

const normalizeFaqItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const question = unwrapValue(item?.question, "");
      const answer = unwrapValue(item?.answer, "");
      return {
        id: unwrapValue(item?.id, `faq-${index + 1}`),
        question,
        answer,
      };
    })
    .filter((item) => item.question || item.answer);
};

export default function FaqNew({ section }) {
  const sectionProps = normalizeProps(section);

  const raw = sectionProps?.raw?.value || sectionProps?.raw || {};
  const layout = sectionProps?.layout?.value || sectionProps?.layout || {};
  const css = layout?.css?.value || layout?.css || {};

  const faq = raw?.faq || {};
  const items = useMemo(() => normalizeFaqItems(faq?.items), [faq?.items]);
  const [activeItemId, setActiveItemId] = useState(() => items[0]?.id || null);

  useEffect(() => {
    if (!items.length) {
      setActiveItemId(null);
      return;
    }

    if (!items.some((item) => item.id === activeItemId)) {
      setActiveItemId(items[0].id);
    }
  }, [activeItemId, items]);

  const containerStyle = convertStyles(css?.container || {});
  const questionStyle = convertStyles(css?.question || {});
  const answerStyle = convertStyles(css?.answer || {});
  const iconStyle = convertStyles(css?.icon || {});

  const headingBold = toBoolean(raw?.headingBold, false);
  const headingItalic = toBoolean(raw?.headingItalic, false);
  const headingFormatStyle = {
    fontWeight: headingBold ? "700" : questionStyle?.fontWeight ?? styles.question.fontWeight,
    fontStyle: headingItalic ? "italic" : "normal",
    textDecorationLine: decorationLine(
      toBoolean(raw?.headingUnderline, false),
      toBoolean(raw?.headingStrikethrough, false)
    ),
  };

  const subHeadingBold = toBoolean(raw?.subHeadingBold, false);
  const subHeadingItalic = toBoolean(raw?.subHeadingItalic, false);
  const subHeadingFormatStyle = {
    fontWeight: subHeadingBold ? "700" : answerStyle?.fontWeight ?? styles.answer.fontWeight,
    fontStyle: subHeadingItalic ? "italic" : "normal",
    textDecorationLine: decorationLine(
      toBoolean(raw?.subHeadingUnderline, false),
      toBoolean(raw?.subHeadingStrikethrough, false)
    ),
  };

  if (!items.length) return null;

  return (
    <View style={[styles.container, containerStyle]}>
      {items.map((item) => {
        const isOpen = activeItemId === item.id;

        return (
          <View key={item.id} style={styles.item}>
            <Pressable
              onPress={() => setActiveItemId((prev) => (prev === item.id ? null : item.id))}
              style={styles.questionRow}
            >
              <Text style={[styles.question, questionStyle, headingFormatStyle]}>{item.question}</Text>
              <Text style={[styles.icon, iconStyle]}>{isOpen ? "−" : "+"}</Text>
            </Pressable>

            {isOpen && !!item.answer && (
              <View style={styles.answerWrap}>
                <Text style={[styles.answer, answerStyle, subHeadingFormatStyle]}>{item.answer}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  item: {
    width: "100%",
  },
  questionRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  question: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  icon: {
    color: "#096d70",
    fontSize: 14,
    marginLeft: 10,
  },
  answerWrap: {
    width: "100%",
    marginTop: 6,
  },
  answer: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "400",
  },
});
