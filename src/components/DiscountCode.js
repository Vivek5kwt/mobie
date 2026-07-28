import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useDispatch, useSelector } from "react-redux";
import { removeDiscount, setDiscounts } from "../store/slices/cartSlice";
import { resolveFont } from "../services/typographyService";
import { validateShopifyCartDiscounts } from "../services/shopify";
import { useAuth } from "../services/AuthContext";
import {
  activeDiscountRecords,
  cartDiscountFingerprint,
  normalizeDiscountCode,
  normalizeDiscountRecords,
} from "../utils/cartDiscounts";
import { resolveFA4IconName } from "../utils/faIconAlias";

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

const firstDefined = (...values) => {
  for (const value of values) {
    const resolved = unwrapValue(value, undefined);
    if (resolved !== undefined && resolved !== null && resolved !== "") return value;
  }
  return undefined;
};

const cleanFontFamily = (family) => resolveFont(family) || "";

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

const borderWidthFromLine = (value, fallback = 0) => {
  const line = toString(value, "").trim().toLowerCase();
  if (!line) return fallback;
  if (line === "none" || line === "hidden") return 0;
  const parsed = parseFloat(line);
  if (Number.isFinite(parsed)) return parsed;
  return 1;
};

const normalizeUrl = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const LinkableText = ({ href, children }) => {
  const url = normalizeUrl(href);
  if (!url) return children;
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL(url).catch(() => {})}>
      {children}
    </TouchableOpacity>
  );
};

export default function DiscountCode({ section }) {
  const dispatch = useDispatch();
  const { session } = useAuth();
  const cartItems = useSelector((state) => state?.cart?.items || []);
  const discountRecords = useSelector((state) => state?.cart?.discounts || []);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [validating, setValidating] = useState(false);

  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const raw = unwrapValue(propsNode?.raw, {}) || propsNode || {};

  // DSL styling
  const enabled = toBoolean(raw?.enabled ?? raw?.active, true);

  // Container ("Card" panel in the Inspector)
  const cardActive = toBoolean(raw?.cardVisible, true);
  const bgColor = cardActive ? toString(raw?.cardBgColor ?? raw?.bgColor ?? raw?.backgroundColor, "#FFFFFF") : "transparent";
  const padT = cardActive ? toNumber(raw?.cardPt ?? raw?.padT ?? raw?.pt, 16) : 0;
  const padR = cardActive ? toNumber(raw?.cardPr ?? raw?.padR ?? raw?.pr, 16) : 0;
  const padB = cardActive ? toNumber(raw?.cardPb ?? raw?.padB ?? raw?.pb, 16) : 0;
  const padL = cardActive ? toNumber(raw?.cardPl ?? raw?.padL ?? raw?.pl, 16) : 0;
  const cornerRadius = cardActive ? toNumber(raw?.cardBorderRadius ?? raw?.cornerRadius ?? raw?.borderRadius, 0) : 0;
  const cardBorderWidth = cardActive ? borderWidthFromLine(raw?.cardBorderSide, 0) : 0;
  const cardBorderColor = toString(raw?.cardBorderColor, "#E5E7EB");

  // Title
  const titleText = toString(raw?.title ?? raw?.titleText ?? raw?.heading, "Discounts and Gift Cards");
  const showTitle = toBoolean(
    raw?.headerVisible ?? raw?.showHeader ?? raw?.showTitle ?? raw?.titleEnabled,
    true
  );
  const titleColor = toString(raw?.titleColor, "#111827");
  const titleSize = toNumber(raw?.titleSize ?? raw?.titleFontSize, 16);
  const titleBold = toBoolean(raw?.titleBold, false);
  const titleWeight = titleBold ? "700" : toFontWeight(raw?.titleWeight ?? raw?.titleFontWeight, "700");
  const titleItalic = toBoolean(raw?.titleItalic, false);
  const titleFontStyle = titleItalic ? "italic" : "normal";
  const titleUnderline = toBoolean(raw?.titleUnderline, false);
  const titleStrikethrough = toBoolean(raw?.titleStrikethrough, false);
  const titleTextDecoration = titleUnderline && titleStrikethrough
    ? "underline line-through"
    : titleUnderline
    ? "underline"
    : titleStrikethrough
    ? "line-through"
    : "none";
  const titleAlignRaw = toString(raw?.titleAlign, "left").trim().toLowerCase();
  const titleAlign = titleAlignRaw === "center" ? "center" : titleAlignRaw === "right" ? "right" : "left";
  const titleLinkHref = toString(raw?.titleLinkHref, "");

  // Input Label (caption shown above the input field)
  const showInputField = toBoolean(raw?.inputFieldVisible, true);
  const showInputLabel = toBoolean(raw?.inputLabelVisible, true);
  const inputLabelText = toString(raw?.inputLabel, "");
  const inputLabelLinkHref = toString(raw?.inputLabelLinkHref, "");
  const inputLabelColor = toString(raw?.inputLabelColor, "#111827");
  const inputLabelSize = toNumber(raw?.inputLabelSize, 13);
  const inputLabelBold = toBoolean(raw?.inputLabelBold, false);
  const inputLabelWeight = inputLabelBold ? "700" : toFontWeight(raw?.inputLabelFontWeight, "400");
  const inputLabelItalic = toBoolean(raw?.inputLabelItalic, false);
  const inputLabelFontStyle = inputLabelItalic ? "italic" : "normal";
  const inputLabelUnderline = toBoolean(raw?.inputLabelUnderline, false);
  const inputLabelStrikethrough = toBoolean(raw?.inputLabelStrikethrough, false);
  const inputLabelTextDecoration = inputLabelUnderline && inputLabelStrikethrough
    ? "underline line-through"
    : inputLabelUnderline
    ? "underline"
    : inputLabelStrikethrough
    ? "line-through"
    : "none";
  const inputLabelAlignRaw = toString(raw?.inputLabelAlign, "left").trim().toLowerCase();
  const inputLabelAlign = inputLabelAlignRaw === "center" ? "center" : inputLabelAlignRaw === "right" ? "right" : "left";
  const inputLabelFontFamily = cleanFontFamily(toString(raw?.inputLabelFontFamily, ""));

  // Input
  const placeholder = toString(raw?.placeholder ?? raw?.inputPlaceholder, "Enter Discount Code");
  const inputBackgroundActive = toBoolean(raw?.inputBackgroundVisible, true);
  const inputBg = inputBackgroundActive ? toString(raw?.inputBg ?? raw?.inputBgColor, "#FFFFFF") : "transparent";
  const inputBorderColor = toString(raw?.inputBorderColor ?? raw?.borderColor, "#E5E7EB");
  const inputBorderRadius = inputBackgroundActive ? toNumber(raw?.inputBorderRadius, 8) : 0;
  const inputTextColor = toString(raw?.inputTextColor ?? raw?.inputColor, "#111827");
  const inputTextSize = toNumber(raw?.inputTextSize ?? raw?.inputFontSize, 14);
  const inputTextBold = toBoolean(raw?.inputTextBold, false);
  const inputTextWeight = inputTextBold ? "700" : toFontWeight(raw?.inputTextFontWeight, "400");
  const inputTextItalic = toBoolean(raw?.inputTextItalic, false);
  const inputTextFontStyle = inputTextItalic ? "italic" : "normal";
  const inputTextUnderline = toBoolean(raw?.inputTextUnderline, false);
  const inputTextStrikethrough = toBoolean(raw?.inputTextStrikethrough, false);
  const inputTextDecoration = inputTextUnderline && inputTextStrikethrough
    ? "underline line-through"
    : inputTextUnderline
    ? "underline"
    : inputTextStrikethrough
    ? "line-through"
    : "none";
  const inputTextAlignRaw = toString(raw?.inputTextAlign, "left").trim().toLowerCase();
  const inputTextAlign = inputTextAlignRaw === "center" ? "center" : inputTextAlignRaw === "right" ? "right" : "left";
  const inputHeight = toNumber(raw?.inputHeight, 44);
  const placeholderColor = toString(raw?.placeholderColor, "#9CA3AF");
  const inputBorderWidth = inputBackgroundActive ? borderWidthFromLine(
    firstDefined(raw?.inputBorderLine, raw?.inputBorderWidth),
    raw?.inputBorderColor ? 1 : 1
  ) : 0;
  const inputPadL = toNumber(
    firstDefined(raw?.inputPaddingLeft, raw?.inputPl, raw?.inputPadL),
    12
  );
  const inputPadR = toNumber(
    firstDefined(raw?.inputPaddingRight, raw?.inputPr, raw?.inputPadR),
    12
  );
  const inputPadT = toNumber(raw?.inputPt, 0);
  const inputPadB = toNumber(raw?.inputPb, 0);
  const inputButtonGap = toNumber(
    firstDefined(raw?.inputButtonGap, raw?.buttonGap, raw?.fieldGap, raw?.gap),
    10
  );

  // Apply button
  const showApplyButton = toBoolean(raw?.applybuttonVisible, true);
  const showApplyButtonText = toBoolean(raw?.buttonVisible, true);
  const applyBgPaddingActive = toBoolean(raw?.buttonBgPaddingVisible, true);
  const applyText = toString(raw?.applyButtonText ?? raw?.applyText ?? raw?.buttonText ?? raw?.btnText, "Apply");
  const buttonTextLinkHref = toString(raw?.buttonTextLinkHref, "");
  const applyBg = applyBgPaddingActive ? toString(
    firstDefined(
      raw?.applyBgColor,
      raw?.applyBackgroundColor,
      raw?.buttonBgColor,
      raw?.buttonBackgroundColor,
      raw?.buttonFillColor,
      raw?.applyBg,
      raw?.buttonBg,
      raw?.btnBg
    ),
    "#111111"
  ) : "#000000";
  const applyTextColor = toString(
    firstDefined(raw?.applyTextColor, raw?.buttonTextColor, raw?.buttonColor),
    "#FFFFFF"
  );
  const applyBorderColor = toString(
    firstDefined(raw?.applyBorderColor, raw?.buttonBorderColor, raw?.borderColor),
    undefined
  );
  const applyBorderLine = firstDefined(
    raw?.applyBorderLine,
    raw?.buttonBorderLine,
    raw?.borderLine
  );
  const applyBorderWidth = applyBgPaddingActive ? borderWidthFromLine(
    applyBorderLine,
    toNumber(firstDefined(raw?.applyBorderWidth, raw?.buttonBorderWidth), 0)
  ) : 0;
  const applyBorderRadius = applyBgPaddingActive ? toNumber(
    firstDefined(raw?.applyBorderRadius, raw?.buttonBorderRadius, raw?.buttonRadius, raw?.btnRadius),
    8
  ) : 0;
  const applyFontSize = toNumber(
    firstDefined(raw?.applyFontSize, raw?.buttonTextSize, raw?.buttonTextFontSize, raw?.buttonFontSize),
    14
  );
  const applyBold = toBoolean(raw?.buttonTextBold, false);
  const applyFontWeight = applyBold ? "700" : toFontWeight(
    firstDefined(raw?.applyFontWeight, raw?.buttonTextFontWeight, raw?.buttonFontWeight),
    "600"
  );
  const applyItalic = toBoolean(raw?.buttonTextItalic, false);
  const applyFontStyle = applyItalic ? "italic" : "normal";
  const applyUnderline = toBoolean(raw?.buttonTextUnderline, false);
  const applyStrikethrough = toBoolean(raw?.buttonTextStrikethrough, false);
  const applyTextDecoration = applyUnderline && applyStrikethrough
    ? "underline line-through"
    : applyUnderline
    ? "underline"
    : applyStrikethrough
    ? "line-through"
    : "none";
  const applyHeight = toNumber(raw?.buttonHeight ?? raw?.applyHeight, 44);
  const applyPadL = applyBgPaddingActive ? toNumber(
    firstDefined(raw?.applyPadL, raw?.applyPaddingLeft, raw?.buttonPl, raw?.buttonPaddingLeft, raw?.buttonPadL, raw?.buttonPaddingX, raw?.buttonPadX),
    Math.round(applyHeight * 0.4)
  ) : 0;
  const applyPadR = applyBgPaddingActive ? toNumber(
    firstDefined(raw?.applyPadR, raw?.applyPaddingRight, raw?.buttonPr, raw?.buttonPaddingRight, raw?.buttonPadR, raw?.buttonPaddingX, raw?.buttonPadX),
    Math.round(applyHeight * 0.4)
  ) : 0;
  const applyPadT = applyBgPaddingActive ? toNumber(
    firstDefined(raw?.applyPadT, raw?.applyPaddingTop, raw?.buttonPt, raw?.buttonPaddingTop, raw?.buttonPadT, raw?.buttonPaddingY, raw?.buttonPadY),
    0
  ) : 0;
  const applyPadB = applyBgPaddingActive ? toNumber(
    firstDefined(raw?.applyPadB, raw?.applyPaddingBottom, raw?.buttonPb, raw?.buttonPaddingBottom, raw?.buttonPadB, raw?.buttonPaddingY, raw?.buttonPadY),
    0
  ) : 0;

  // Apply button icon
  const showApplyIcon = toBoolean(raw?.buttonIconVisible, false);
  const applyIconRaw = toString(raw?.buttonIcon, "");
  const applyIconName = applyIconRaw ? resolveFA4IconName(applyIconRaw) : "";
  const applyIconSize = toNumber(raw?.buttonIconSize, 15);
  const applyIconColor = toString(raw?.buttonIconColor, applyTextColor);

  // Applied code chips ("Saved Codes")
  const showSavedCodes = toBoolean(raw?.savedCodesVisible, true);
  const chipBorderActive = toBoolean(raw?.border1Visible, true);
  const chipBgActive = toBoolean(raw?.bg1Visible, true);
  const chipBg = chipBgActive
    ? toString(raw?.savedCodesBgColor ?? raw?.chipBg ?? raw?.codeBg, "#F3F4F6")
    : "transparent";
  const chipTextColor = toString(raw?.savedCodesColor ?? raw?.chipTextColor ?? raw?.codeTextColor, "#111827");
  const chipBorderColor = toString(raw?.savedCodesBorderColor ?? raw?.chipBorderColor, "#E5E7EB");
  const chipBorderRadius = toNumber(raw?.savedCodesBorderRadius ?? raw?.chipBorderRadius, 6);
  const chipBorderWidth = chipBorderActive ? borderWidthFromLine(raw?.savedCodesBorderSide, 1) : 0;
  const chipFontSize = toNumber(raw?.savedCodesSize ?? raw?.chipFontSize, 13);
  const chipBold = toBoolean(raw?.savedCodesBold, false);
  const chipFontWeight = chipBold ? "700" : toFontWeight(raw?.savedCodesFontWeight, "400");
  const chipItalic = toBoolean(raw?.savedCodesItalic, false);
  const chipFontStyle = chipItalic ? "italic" : "normal";
  const chipUnderline = toBoolean(raw?.savedCodesUnderline, false);
  const chipStrikethrough = toBoolean(raw?.savedCodesStrikethrough, false);
  const chipTextDecoration = chipUnderline && chipStrikethrough
    ? "underline line-through"
    : chipUnderline
    ? "underline"
    : chipStrikethrough
    ? "line-through"
    : "none";
  const chipPadT = toNumber(raw?.savedCodesPt, 10);
  const chipPadB = toNumber(raw?.savedCodesPb, 10);
  const chipPadL = toNumber(raw?.savedCodesPl, 14);
  const chipPadR = toNumber(raw?.savedCodesPr, 14);
  const showRemoveIcon = toBoolean(raw?.iconVisible, true);
  const removeIconColor = toString(raw?.savedCodesIconColor ?? raw?.removeIconColor ?? raw?.closeColor, "#6B7280");
  const removeIconRaw = toString(raw?.savedCodesIcon, "");
  const removeIconName = removeIconRaw ? resolveFA4IconName(removeIconRaw) : "";
  const removeIconSize = toNumber(raw?.savedCodesIconSize, 16);
  const savedCodesLinkHref = toString(raw?.savedCodesLinkHref, "");

  // Font families
  const titleFontFamily = cleanFontFamily(toString(raw?.titleFontFamily ?? raw?.fontFamily, ""));
  const inputFontFamily = cleanFontFamily(toString(raw?.inputTextFontFamily ?? raw?.inputFontFamily ?? raw?.fontFamily, ""));
  const applyFontFamily = cleanFontFamily(toString(raw?.applyFontFamily ?? raw?.buttonTextFontFamily ?? raw?.buttonFontFamily ?? raw?.fontFamily, ""));
  const chipFontFamily  = cleanFontFamily(toString(raw?.savedCodesFontFamily ?? raw?.chipFontFamily ?? raw?.fontFamily, ""));
  const successColor = toString(raw?.successColor ?? raw?.validMessageColor, "#047857");
  const errorColor = toString(raw?.errorColor ?? raw?.invalidMessageColor, "#DC2626");
  const successMessage = toString(raw?.successMessage ?? raw?.validMessage, "Discount applied.");
  const duplicateMessage = toString(raw?.duplicateMessage, "Discount code is already applied.");
  const invalidMessage = toString(raw?.invalidMessage, "Discount code is not valid for this cart.");
  const emptyCartMessage = toString(raw?.emptyCartMessage, "Add products before applying a discount code.");
  const validationErrorMessage = toString(
    raw?.validationErrorMessage,
    "Coupon could not be checked right now. Please try again."
  );

  const cartFingerprint = useMemo(() => cartDiscountFingerprint(cartItems), [cartItems]);
  const appliedCodes = useMemo(
    () => activeDiscountRecords(discountRecords, cartFingerprint),
    [discountRecords, cartFingerprint]
  );
  const appliedCodesKey = useMemo(
    () => appliedCodes.map((entry) => entry.code).sort().join("|"),
    [appliedCodes]
  );
  const previousAppliedCodesKeyRef = useRef(appliedCodesKey);

  useEffect(() => {
    if (
      feedback?.type === "success" &&
      previousAppliedCodesKeyRef.current &&
      appliedCodesKey !== previousAppliedCodesKeyRef.current
    ) {
      setFeedback(null);
    }
    previousAppliedCodesKeyRef.current = appliedCodesKey;
  }, [appliedCodesKey, feedback?.type]);

  if (!enabled) return null;

  const handleApply = async () => {
    const code = normalizeDiscountCode(inputValue);
    if (!code || validating) return;

    if (!cartItems.length) {
      setFeedback({ type: "error", message: emptyCartMessage });
      return;
    }

    const existingCodes = appliedCodes.map((entry) => entry.code);
    if (existingCodes.includes(code)) {
      setFeedback({ type: "success", message: duplicateMessage });
      setInputValue("");
      return;
    }

    setValidating(true);
    setFeedback(null);
    try {
      const preview = await validateShopifyCartDiscounts({
        items: cartItems,
        discountCodes: [...existingCodes, code],
        options: {
          cartFingerprint,
          email: session?.user?.email || "",
          countryCode: session?.user?.country || undefined,
        },
      });
      const validDiscounts = normalizeDiscountRecords(preview?.discounts || []).filter(
        (entry) => entry.applicable === true && entry.cartFingerprint === cartFingerprint
      );
      dispatch(setDiscounts({ discounts: validDiscounts }));
      const applied = validDiscounts.find((entry) => entry.code === code);
      if (applied) {
        setInputValue("");
        setFeedback({ type: "success", message: successMessage });
      } else {
        const failed = normalizeDiscountRecords(preview?.discounts || []).find(
          (entry) => entry.code === code
        );
        setFeedback({ type: "error", message: failed?.message || invalidMessage });
      }
    } catch (error) {
      setFeedback({ type: "error", message: validationErrorMessage });
    } finally {
      setValidating(false);
    }
  };

  const handleRemove = (code) => {
    dispatch(removeDiscount({ code }));
    setFeedback(null);
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
          borderWidth: cardBorderWidth,
          borderColor: cardBorderColor,
        },
      ]}
    >
      {showTitle && !!titleText && (
        <LinkableText href={titleLinkHref}>
          <Text
            style={[
              styles.title,
              {
                color: titleColor,
                fontSize: titleSize,
                fontWeight: titleWeight,
                fontStyle: titleFontStyle,
                textDecorationLine: titleTextDecoration,
                textAlign: titleAlign,
                ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
              },
            ]}
          >
            {titleText}
          </Text>
        </LinkableText>
      )}

      {showInputField && showInputLabel && !!inputLabelText && (
        <LinkableText href={inputLabelLinkHref}>
          <Text
            style={[
              styles.inputLabel,
              {
                color: inputLabelColor,
                fontSize: inputLabelSize,
                fontWeight: inputLabelWeight,
                fontStyle: inputLabelFontStyle,
                textDecorationLine: inputLabelTextDecoration,
                textAlign: inputLabelAlign,
                ...(inputLabelFontFamily ? { fontFamily: inputLabelFontFamily } : {}),
              },
            ]}
          >
            {inputLabelText}
          </Text>
        </LinkableText>
      )}

      {/* Input row */}
      <View style={[styles.inputRow, { gap: inputButtonGap }]}>
        {showInputField && (
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: inputBg,
                borderColor: inputBorderColor,
                borderWidth: inputBorderWidth,
                borderRadius: inputBorderRadius,
                color: inputTextColor,
                fontSize: inputTextSize,
                fontWeight: inputTextWeight,
                fontStyle: inputTextFontStyle,
                textDecorationLine: inputTextDecoration,
                textAlign: inputTextAlign,
                height: inputHeight,
                paddingTop: inputPadT,
                paddingBottom: inputPadB,
                paddingLeft: inputPadL,
                paddingRight: inputPadR,
                ...(inputFontFamily ? { fontFamily: inputFontFamily } : {}),
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
            editable={!validating}
          />
        )}
        {showApplyButton && (
          <TouchableOpacity
            style={[
              styles.applyButton,
              {
                backgroundColor: applyBg,
                borderColor: applyBorderColor,
                borderWidth: applyBorderWidth,
                borderRadius: applyBorderRadius,
                height: applyHeight,
                paddingTop: applyPadT,
                paddingBottom: applyPadB,
                paddingLeft: applyPadL,
                paddingRight: applyPadR,
                opacity: validating ? 0.75 : 1,
              },
            ]}
            onPress={handleApply}
            disabled={validating}
            activeOpacity={0.8}
          >
            {validating ? (
              <ActivityIndicator size="small" color={applyTextColor} />
            ) : (
              <>
                {showApplyIcon && !!applyIconName && (
                  <FontAwesome
                    name={applyIconName}
                    size={applyIconSize}
                    color={applyIconColor}
                    style={styles.applyIcon}
                  />
                )}
                {showApplyButtonText && (
                  <LinkableText href={buttonTextLinkHref}>
                    <Text
                      style={[
                        styles.applyText,
                        {
                          color: applyTextColor,
                          fontSize: applyFontSize,
                          fontWeight: applyFontWeight,
                          fontStyle: applyFontStyle,
                          textDecorationLine: applyTextDecoration,
                          ...(applyFontFamily ? { fontFamily: applyFontFamily } : {}),
                        },
                      ]}
                    >
                      {applyText}
                    </Text>
                  </LinkableText>
                )}
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {!!feedback?.message && (
        <Text
          style={[
            styles.message,
            {
              color: feedback.type === "success" ? successColor : errorColor,
              ...(inputFontFamily ? { fontFamily: inputFontFamily } : {}),
            },
          ]}
        >
          {feedback.message}
        </Text>
      )}

      {/* Applied codes */}
      {showSavedCodes && appliedCodes.length > 0 && (
        <View style={styles.chipList}>
          {appliedCodes.map((discount) => (
            <View
              key={discount.code}
              style={[
                styles.chip,
                {
                  backgroundColor: chipBg,
                  borderColor: chipBorderColor,
                  borderRadius: chipBorderRadius,
                  borderWidth: chipBorderWidth,
                  paddingTop: chipPadT,
                  paddingBottom: chipPadB,
                  paddingLeft: chipPadL,
                  paddingRight: chipPadR,
                },
              ]}
            >
              <LinkableText href={savedCodesLinkHref}>
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: chipTextColor,
                      fontSize: chipFontSize,
                      fontWeight: chipFontWeight,
                      fontStyle: chipFontStyle,
                      textDecorationLine: chipTextDecoration,
                      ...(chipFontFamily ? { fontFamily: chipFontFamily } : {}),
                    },
                  ]}
                >
                  {discount.code}
                </Text>
              </LinkableText>
              {showRemoveIcon && (
                <TouchableOpacity
                  style={styles.chipRemove}
                  onPress={() => handleRemove(discount.code)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {removeIconName ? (
                    <FontAwesome name={removeIconName} size={removeIconSize} color={removeIconColor} />
                  ) : (
                    <Text style={[styles.chipRemoveText, { color: removeIconColor }]}>
                      x
                    </Text>
                  )}
                </TouchableOpacity>
              )}
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
  inputLabel: {
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
  applyButton: {
    flexDirection: "row",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  applyIcon: {
    marginRight: 6,
  },
  applyText: {},
  message: {
    fontSize: 12,
    lineHeight: 17,
  },
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
