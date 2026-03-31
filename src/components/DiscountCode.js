import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { applyDiscount, removeDiscount } from "../store/slices/cartSlice";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toNumber = (value, fallback = 0) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  const s = String(resolved).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
  return fallback;
};

const toFontWeight = (value, fallback = "400") => {
  const resolved = unwrapValue(value, undefined);
  if (!resolved) return fallback;
  const w = String(resolved).toLowerCase().trim();
  if (w === "bold") return "700";
  if (w === "semibold" || w === "semi bold") return "600";
  if (w === "medium") return "500";
  if (w === "regular" || w === "normal") return "400";
  if (/^\d+$/.test(w)) return w;
  return fallback;
};

export default function DiscountCode({ section }) {
  const dispatch = useDispatch();
  const appliedCodes = useSelector((state) => state?.cart?.discounts || []);
  const [inputValue, setInputValue] = useState("");

  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const raw = unwrapValue(propsNode?.raw, {}) || propsNode || {};

  // DSL styling
  const enabled = toBoolean(raw?.enabled ?? raw?.active, true);

  // Container
  const bgColor = toString(raw?.bgColor ?? raw?.backgroundColor, "#FFFFFF");
  const padT = toNumber(raw?.padT ?? raw?.pt, 16);
  const padR = toNumber(raw?.padR ?? raw?.pr, 16);
  const padB = toNumber(raw?.padB ?? raw?.pb, 16);
  const padL = toNumber(raw?.padL ?? raw?.pl, 16);
  const cornerRadius = toNumber(raw?.cornerRadius ?? raw?.borderRadius, 0);

  // Title
  const titleText = toString(raw?.title ?? raw?.titleText ?? raw?.heading, "Discounts and Gift Cards");
  const showTitle = toBoolean(raw?.showTitle ?? raw?.titleEnabled, true);
  const titleColor = toString(raw?.titleColor, "#111827");
  const titleSize = toNumber(raw?.titleSize ?? raw?.titleFontSize, 16);
  const titleWeight = toFontWeight(raw?.titleWeight ?? raw?.titleFontWeight, "700");

  // Input
  const placeholder = toString(raw?.placeholder ?? raw?.inputPlaceholder, "Enter Discount Code");
  const inputBg = toString(raw?.inputBg ?? raw?.inputBgColor, "#FFFFFF");
  const inputBorderColor = toString(raw?.inputBorderColor ?? raw?.borderColor, "#E5E7EB");
  const inputBorderRadius = toNumber(raw?.inputBorderRadius, 8);
  const inputTextColor = toString(raw?.inputTextColor ?? raw?.inputColor, "#111827");
  const inputTextSize = toNumber(raw?.inputTextSize ?? raw?.inputFontSize, 14);
  const placeholderColor = toString(raw?.placeholderColor, "#9CA3AF");

  // Apply button
  const applyText = toString(raw?.applyText ?? raw?.buttonText ?? raw?.btnText, "Apply");
  const applyBg = toString(raw?.applyBg ?? raw?.buttonBg ?? raw?.btnBg, "#111827");
  const applyTextColor = toString(raw?.applyTextColor ?? raw?.buttonTextColor, "#FFFFFF");
  const applyBorderRadius = toNumber(raw?.applyBorderRadius ?? raw?.btnRadius, 8);
  const applyFontSize = toNumber(raw?.applyFontSize ?? raw?.buttonFontSize, 14);
  const applyFontWeight = toFontWeight(raw?.applyFontWeight ?? raw?.buttonFontWeight, "600");

  // Applied code chips
  const chipBg = toString(raw?.chipBg ?? raw?.codeBg, "#F3F4F6");
  const chipTextColor = toString(raw?.chipTextColor ?? raw?.codeTextColor, "#111827");
  const chipBorderColor = toString(raw?.chipBorderColor, "#E5E7EB");
  const chipBorderRadius = toNumber(raw?.chipBorderRadius, 6);
  const chipFontSize = toNumber(raw?.chipFontSize, 13);
  const removeIconColor = toString(raw?.removeIconColor ?? raw?.closeColor, "#6B7280");

  if (!enabled) return null;

  const handleApply = () => {
    const code = inputValue.trim();
    if (!code) return;
    dispatch(applyDiscount({ code }));
    setInputValue("");
  };

  const handleRemove = (code) => {
    dispatch(removeDiscount({ code }));
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          paddingTop: padT,
          paddingRight: padR,
          paddingBottom: padB,
          paddingLeft: padL,
          borderRadius: cornerRadius,
        },
      ]}
    >
      {showTitle && !!titleText && (
        <Text
          style={[
            styles.title,
            {
              color: titleColor,
              fontSize: titleSize,
              fontWeight: titleWeight,
            },
          ]}
        >
          {titleText}
        </Text>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: inputBg,
              borderColor: inputBorderColor,
              borderRadius: inputBorderRadius,
              color: inputTextColor,
              fontSize: inputTextSize,
            },
          ]}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleApply}
        />
        <TouchableOpacity
          style={[
            styles.applyButton,
            {
              backgroundColor: applyBg,
              borderRadius: applyBorderRadius,
            },
          ]}
          onPress={handleApply}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.applyText,
              {
                color: applyTextColor,
                fontSize: applyFontSize,
                fontWeight: applyFontWeight,
              },
            ]}
          >
            {applyText}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Applied codes */}
      {appliedCodes.length > 0 && (
        <View style={styles.chipList}>
          {appliedCodes.map((code) => (
            <View
              key={code}
              style={[
                styles.chip,
                {
                  backgroundColor: chipBg,
                  borderColor: chipBorderColor,
                  borderRadius: chipBorderRadius,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: chipTextColor,
                    fontSize: chipFontSize,
                  },
                ]}
              >
                {code}
              </Text>
              <TouchableOpacity
                style={styles.chipRemove}
                onPress={() => handleRemove(code)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.chipRemoveText, { color: removeIconColor }]}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 12,
  },
  title: {
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  applyButton: {
    height: 44,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: {},
  chipList: {
    flexDirection: "column",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipText: {
    flex: 1,
    letterSpacing: 0.5,
  },
  chipRemove: {
    marginLeft: 8,
  },
  chipRemoveText: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: "300",
  },
});
