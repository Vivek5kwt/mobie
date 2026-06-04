import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import { convertStyles } from "../utils/convertStyles";
import { useAuth } from "../services/AuthContext";
import { isAuthenticatedSession } from "../utils/authGate";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveFont } from "../services/typographyService";
import Icon from "react-native-vector-icons/FontAwesome6";
import { navigateToDslTarget } from "../utils/navigationTarget";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  return fallback;
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
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
    if (resolved !== undefined && resolved !== null && resolved !== "") return resolved;
  }
  return undefined;
};

const toFontWeight = (value) => {
  if (!value) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (raw === "bold" || raw === "700") return "700";
  if (raw === "semibold" || raw === "semi bold" || raw === "600") return "600";
  if (raw === "medium" || raw === "500") return "500";
  if (raw === "regular" || raw === "normal" || raw === "400") return "400";
  if (/^\d+$/.test(raw)) return raw;
  return undefined;
};

const parseGradient = (gradientStr) => {
  if (!gradientStr || typeof gradientStr !== "string") return null;
  if (gradientStr.includes("linear-gradient")) {
    // Extract color stops from gradient string
    const colorMatch = gradientStr.match(/rgba?\([^)]+\)/g);
    if (colorMatch && colorMatch.length > 0) {
      return colorMatch[0]; // Use first color as solid color fallback
    }
  }
  return gradientStr;
};

const resolveColor = (...values) => {
  for (const value of values) {
    const resolved = unwrapValue(value, undefined);
    if (resolved !== undefined && resolved !== null && resolved !== "") {
      const parsed = parseGradient(String(resolved));
      if (parsed) return parsed;
    }
  }
  return undefined;
};

const splitGradientParts = (value) => {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const resolveGradient = (value) => {
  const resolved = unwrapValue(value, "");
  if (typeof resolved !== "string" || !resolved.trim().startsWith("linear-gradient")) {
    return null;
  }
  const match = resolved.match(/linear-gradient\((.*)\)/);
  if (!match) return null;
  const parts = splitGradientParts(match[1]);
  const angleMatch = parts[0]?.match(/(-?\d+(?:\.\d+)?)deg/);
  const colors = parts
    .map((part) => part.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/)?.[0])
    .filter(Boolean);
  if (colors.length < 2) return null;
  return {
    colors,
    angle: angleMatch ? Number(angleMatch[1]) : 180,
  };
};

const resolveBorderWidth = (line, color, fallback = 1) => {
  const rawLine = toString(line, "").trim().toLowerCase();
  if (rawLine === "none" || rawLine === "0" || rawLine === "0px") return 0;
  const numeric = parseFloat(rawLine);
  if (Number.isFinite(numeric)) return numeric;
  if (!rawLine) return 0;
  const rawColor = toString(color, "").trim().toLowerCase();
  if (!rawColor || rawColor === "transparent") return 0;
  return fallback;
};

const getAlignment = (align) => {
  const normalized = String(align || "").toLowerCase();
  if (normalized === "left") return "flex-start";
  if (normalized === "right") return "flex-end";
  return "center";
};

const getTextAlign = (align) => {
  const normalized = String(align || "").toLowerCase();
  if (normalized === "left") return "left";
  if (normalized === "right") return "right";
  if (normalized === "center") return "center";
  return "left";
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const resolveResponsiveVerticalSpace = (value, viewportHeight, maxViewportShare) => {
  const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return normalized;
  return Math.round(Math.min(normalized, viewportHeight * maxViewportShare));
};

export default function SignUp({ section }) {
  const navigation = useNavigation();
  const { signup: signupUser, session, initializing } = useAuth();
  const isLoggedIn = isAuthenticatedSession(session);
  const { width: screenWidth, height: viewportHeight } = useWindowDimensions();

  // Use useMemo to extract props so component updates when section changes
  const rawProps = useMemo(() => {
    return section?.props || section?.properties?.props?.properties || section?.properties?.props || {};
  }, [section]);

  const raw = useMemo(() => {
    const rawNode = unwrapValue(rawProps?.raw, {});
    if (rawNode && typeof rawNode === "object") return { ...rawProps, ...rawNode };
    return rawProps || {};
  }, [rawProps]);

  const layoutCss = useMemo(() => {
    return rawProps?.presentation?.properties?.css || rawProps?.presentation?.css || {};
  }, [rawProps]);

  const hasRawData = Boolean(raw && Object.keys(raw).length > 0);

  // Extract all properties from raw using useMemo to update when raw changes
  const extractedProps = useMemo(() => {
    const containerCss = layoutCss?.container || {};
    const pt = toNumber(firstDefined(raw.pt, raw.paddingTop, containerCss.paddingTop), 0);
    const pb = toNumber(firstDefined(raw.pb, raw.paddingBottom, containerCss.paddingBottom), 0);
    const pl = toNumber(firstDefined(raw.pl, raw.paddingLeft, containerCss.paddingLeft), 20);
    const pr = toNumber(firstDefined(raw.pr, raw.paddingRight, containerCss.paddingRight), 20);
    const bgColor = toString(raw.bgColor, "#FFFFFF");
    const cardBgColor = toString(raw.cardBgColor, "#FFFFFF");
    const cardBorderColor = toString(raw.cardBorderColor ?? raw.borderColor, "#0c9297");
    const cardBorderWidth = resolveBorderWidth(raw.borderLine, cardBorderColor, 1);
    const borderRadius = toNumber(raw.borderRadius, 0);
    const inputBorderColor = toString(raw.inputBorderColor, "#027579");
    const inputBorderRadius = toNumber(raw.inputBorderRadius ?? raw.inputRadius, 6);
    const inputHeight = toNumber(raw.inputHeight ?? raw.fieldHeight, 46);
    const fieldGap = toNumber(firstDefined(raw.fieldGap, raw.inputGap, raw.fieldMarginBottom), 14);
    const inputPaddingHorizontal = toNumber(firstDefined(raw.inputPaddingHorizontal, raw.inputPx, raw.fieldPaddingHorizontal), 12);
    const inputPaddingVertical = toNumber(firstDefined(raw.inputPaddingVertical, raw.inputPy, raw.fieldPaddingVertical), 0);

    // Visibility flags
    const authVisible = toBoolean(raw.authVisible, true);
    const logoVisible = toBoolean(raw.logoVisible, true);
    const bgPadVisible = toBoolean(raw.bgPadVisible, true);
    const buttonVisible = toBoolean(raw.buttonVisible, true);
    const footerVisible = toBoolean(raw.footerVisible, true);
    const signInLinkVisible = toBoolean(raw.signInLinkVisible, true);
    const showMenuIcon = toBoolean(raw.showMenuIcon, false);
    const showProfilePicture = toBoolean(raw.showProfilePicture, false);
    const firstNameVisible = toBoolean(raw.firstNameVisible, true);
    const lastNameVisible = toBoolean(raw.lastNameVisible, true);
    const emailInputVisible = toBoolean(raw.emailInputVisible, true);
    const passwordInputVisible = toBoolean(raw.passwordInputVisible, true);
    const emailLabelVisible = toBoolean(raw.emailLabelVisible, false);
    const firstNameLabelVisible = toBoolean(raw.firstNameLabelVisible, false);
    const lastNameLabelVisible = toBoolean(raw.lastNameLabelVisible, false);
    const passwordLabelVisible = toBoolean(raw.passwordLabelVisible, false);
    const buttonIconsVisible = toBoolean(raw.buttonIconsVisible, true);
    const redirectionVisible = toBoolean(raw.redirectionVisible, true);

    // Text content
    const authTitle = toString(raw.authTitle, "Create an Account");
    const headerTitle = toString(raw.headerTitle, "Create an Account");
    const buttonText = toString(raw.buttonText, "Continue");
    const footerText = toString(raw.footerText, "Already have an account?");
    const footerLinkText = toString(raw.footerLinkText, "Sign in");

    // Labels
    const firstNameLabelText = toString(raw.firstNameLabelText, "First Name");
    const lastNameLabelText = toString(raw.lastNameLabelText, "Last Name");
    const emailLabelText = toString(raw.emailLabelText || raw.emailLabel, "Email");
    const passwordLabelText = toString(raw.passwordLabelText || raw.passwordLabel, "Password");

    // Placeholders
    const firstNamePlaceholder = toString(raw.firstNamePlaceholder, "First Name");
    const lastNamePlaceholder = toString(raw.lastNamePlaceholder, "Last Name");
    const emailPlaceholder = toString(raw.emailPlaceholder, "Enter email");
    const passwordPlaceholder = toString(raw.passwordPlaceholder, "Enter password");
    const firstNamePlaceholderVisible = toBoolean(raw.firstNamePlaceHolderVisible ?? raw.firstNamePlaceholderVisible, true);
    const lastNamePlaceholderVisible = toBoolean(raw.lastNamePlaceHolderVisible ?? raw.lastNamePlaceholderVisible, true);
    const emailPlaceholderVisible = toBoolean(raw.emailPlaceHolderVisible ?? raw.emailPlaceholderVisible, true);
    const passwordPlaceholderVisible = toBoolean(raw.passwordPlaceHolderVisible ?? raw.passwordPlaceholderVisible, true);

    // Colors
    const titleColor = toString(raw.titleColor, "#027579");
    const headerTitleColor = toString(raw.headerTitleColor, "#000000");
    const buttonTextColor = toString(
      firstDefined(raw.buttontextColor, raw.buttonTextColor, raw.buttonColor, raw.textColor),
      "#000000"
    );
    const buttonIconColor = toString(raw.buttonIconColor, "#FFFFFF");
    const footerTextColor = toString(raw.footerTextColor, "#0a0a0a");
    const footerLinkColor = toString(raw.footerLinkColor, "#027579");
    const firstNameLabelColor = toString(raw.firstNameLabelColor, "#000000");
    const lastNameLabelColor = toString(raw.lastNameLabelColor, "#000000");
    const emailLabelColor = toString(raw.emailLabelColor || raw.emailLabelColor, "#000000");
    const passwordLabelColor = toString(raw.passwordLabelColor || raw.passwordLabelColor, "#000000");
    const firstNameInputTextColor = toString(raw.firstNameInputTextColor, "#000000");
    const lastNameInputTextColor = toString(raw.lastNameInputTextColor, "#000000");
    const emailInputTextColor = toString(raw.emailInputTextColor, "#000000");
    const passwordInputTextColor = toString(raw.passwordInputTextColor, "#000000");
    const firstNamePlaceholderColor = toString(raw.firstNamePlaceholderColor, "#000000");
    const lastNamePlaceholderColor = toString(raw.lastNamePlaceholderColor, "#000000");
    const emailPlaceholderColor = toString(raw.emailPlaceholderColor, "#000000");
    const passwordPlaceholderColor = toString(raw.passwordPlaceholderColor, "#000000");
    const menuIconColor = toString(raw.menuIconColor, "#000000");
    const profilePictureBgColor = toString(raw.profilePictureBgColor, "#E5F3F4");
    const profilePictureBorderColor = toString(raw.profilePictureBorderColor, "#33B8C4");
    const footerBgColor = toString(raw.footerBgColor, "#FFFFFF");
    const signInLinkBgColor = toString(raw.signInLinkBgColor, "#FFFFFF");

    // Font sizes (DSL-driven, no hard clamps)
    const fs = (val, def) => toNumber(val, def);
    const headerTitleFontSize = fs(raw.headerTitleFontSize, 18);
    const buttonFontSize = fs(
      firstDefined(raw.buttonfontSize, raw.buttonFontSize, raw.buttonTextFontSize, raw.fontSize),
      16
    );
    const buttonIconSize = toNumber(raw.buttonIconSize, 16);
    const footerTextFontSize = fs(raw.footerTextfontSize ?? raw.footerTextFontSize, 13);
    const footerLinkFontSize = fs(raw.footerLinkfontSize ?? raw.footerLinkFontSize, 14);
    const firstNameLabelFontSize = fs(raw.firstNameLabelFontSize, 14);
    const lastNameLabelFontSize = fs(raw.lastNameLabelFontSize, 14);
    const emailLabelFontSize = fs(raw.emailLabelFontSize, 14);
    const passwordLabelFontSize = fs(raw.passwordLabelFontSize, 14);
    const firstNameInputTextFontSize = fs(raw.firstNameInputTextFontSize, 15);
    const lastNameInputTextFontSize = fs(raw.lastNameInputTextFontSize, 15);
    const emailInputTextFontSize = fs(raw.emailInputTextFontSize, 15);
    const passwordInputTextFontSize = fs(raw.passwordInputTextFontSize, 15);
    const firstNamePlaceholderFontSize = fs(raw.firstNamePlaceholderFontSize, 15);
    const lastNamePlaceholderFontSize = fs(raw.lastNamePlaceholderFontSize, 15);
    const emailPlaceholderFontSize = fs(raw.emailPlaceholderFontSize, 15);
    const passwordPlaceholderFontSize = fs(raw.passwordPlaceholderFontSize, 15);

    // Font families
    const baseFontFamily = toString(raw.fontFamily, "Inter");
    const headerTitleFontFamily = resolveFont(toString(raw.headerTitleFontFamily, baseFontFamily));
    const buttonFontFamily = resolveFont(toString(
      firstDefined(raw.buttonfontFamily, raw.buttonFontFamily, raw.buttonTextFontFamily, raw.fontFamily),
      baseFontFamily
    ));
    const footerLinkFontFamily = resolveFont(toString(raw.footerLinkFontFamily, baseFontFamily));
    const firstNameLabelFontFamily = resolveFont(toString(raw.firstNameLabelFontFamily, baseFontFamily));
    const lastNameLabelFontFamily = resolveFont(toString(raw.lastNameLabelFontFamily, baseFontFamily));
    const emailLabelFontFamily = resolveFont(toString(raw.emailLabelFontFamily, baseFontFamily));
    const passwordLabelFontFamily = resolveFont(toString(raw.passwordLabelFontFamily, baseFontFamily));
    const firstNameInputTextFontFamily = resolveFont(toString(raw.firstNameInputTextFontFamily, baseFontFamily));
    const lastNameInputTextFontFamily = resolveFont(toString(raw.lastNameInputTextFontFamily, baseFontFamily));
    const emailInputTextFontFamily = resolveFont(toString(raw.emailInputTextFontFamily, baseFontFamily));
    const passwordInputTextFontFamily = resolveFont(toString(raw.passwordInputTextFontFamily, baseFontFamily));
    const firstNamePlaceholderFontFamily = resolveFont(toString(raw.firstNamePlaceholderFontFamily, baseFontFamily));
    const lastNamePlaceholderFontFamily = resolveFont(toString(raw.lastNamePlaceholderFontFamily, baseFontFamily));
    const emailPlaceholderFontFamily = resolveFont(toString(raw.emailPlaceholderFontFamily, baseFontFamily));
    const passwordPlaceholderFontFamily = resolveFont(toString(raw.passwordPlaceholderFontFamily, baseFontFamily));

    // Font weights
    const headerTitleFontWeight = toFontWeight(raw.headerTitleFontWeight) || "700";
    const buttonFontWeight = toFontWeight(
      firstDefined(raw.buttonfontWeight, raw.buttonFontWeight, raw.buttonTextFontWeight, raw.fontWeight)
    ) || "700";
    const footerLinkFontWeight = toFontWeight(raw.footerLinkFontWeight) || "700";
    const firstNameLabelFontWeight = toFontWeight(raw.firstNameLabelFontWeight) || "700";
    const lastNameLabelFontWeight = toFontWeight(raw.lastNameLabelFontWeight) || "700";
    const emailLabelFontWeight = toFontWeight(raw.emailLabelFontWeight) || "700";
    const passwordLabelFontWeight = toFontWeight(raw.passwordLabelFontWeight) || "700";
    const firstNameInputTextFontWeight = toFontWeight(raw.firstNameInputTextFontWeight) || "700";
    const lastNameInputTextFontWeight = toFontWeight(raw.lastNameInputTextFontWeight) || "700";
    const emailInputTextFontWeight = toFontWeight(raw.emailInputTextFontWeight) || "700";
    const passwordInputTextFontWeight = toFontWeight(raw.passwordInputTextFontWeight) || "700";
    const firstNamePlaceholderFontWeight = toFontWeight(raw.firstNamePlaceholderFontWeight) || "700";
    const lastNamePlaceholderFontWeight = toFontWeight(raw.lastNamePlaceholderFontWeight) || "700";
    const emailPlaceholderFontWeight = toFontWeight(raw.emailPlaceholderFontWeight) || "700";
    const passwordPlaceholderFontWeight = toFontWeight(raw.passwordPlaceholderFontWeight) || "700";

    // Alignment
    const firstNameAlignment = getAlignment(raw.firstNameAlignment);
    const lastNameAlignment = getAlignment(raw.lastNameAlignment);
    const emailAlignment = getAlignment(raw.emailAlignment);
    const passwordAlignment = getAlignment(raw.passwordAlignment);
    const firstNameInputTextAlignment = getTextAlign(raw.firstNameInputTextAlignment);
    const lastNameInputTextAlignment = getTextAlign(raw.lastNameInputTextAlignment);
    const emailInputTextAlignment = getTextAlign(raw.emailInputTextAlignment);
    const passwordInputTextAlignment = getTextAlign(raw.passwordInputTextAlignment);
    const footerLinkAlignment = getAlignment(raw.footerLinkAlignment);
    const buttonIconAlignment = toString(raw.buttonIconAlignment, "Left").toLowerCase();

    // Button properties
    const buttonWidth = toNumber(raw.buttonWidth, 100);
    const buttonHeight = toNumber(raw.buttonHeight, 50);
    const buttonRadius = toNumber(raw.buttonRadius, 8);
    const buttonBgSource = firstDefined(
      raw.buttonbgColor,
      raw.buttonBgColor,
      raw.buttonBackgroundColor,
      raw.buttonFillColor,
      raw.buttonColor
    );
    const buttonBgColor = resolveColor(buttonBgSource, "#FFFFFF") || "#FFFFFF";
    const buttonGradient = resolveGradient(buttonBgSource);
    const buttonBorderColor = toString(raw.buttonBorderColor, "#0c9297");
    const buttonBorderWidth = resolveBorderWidth(raw.buttonBorderLine, buttonBorderColor, 1);
    const buttonAutoUppercase = toBoolean(raw.buttonAutoUppercase, false);
    const buttonIcon = toString(raw.buttonIcon, "");

    const profilePictureUrl = toString(raw.profilePictureUrl, "").trim();
    const profilePictureSize = toNumber(raw.profilePictureSize, 90);

    const subgpt = toNumber(raw.subgpt ?? raw.bgpt, 0);
    const subgpb = toNumber(raw.subgpb ?? raw.bgpb, 0);
    const subgpl = toNumber(raw.subgpl ?? raw.bgpl, 16);
    const subgpr = toNumber(raw.subgpr ?? raw.bgpr, 16);

    // Navigation
    const navigateTo = toString(raw.navigateTo, "screen");
    const selectScreen = toString(raw.selectScreen, "my-account");

    // Footer padding
    const footerPt = toNumber(raw.footerPt, 0);
    const footerPb = toNumber(raw.footerPb, 0);
    const footerPl = toNumber(raw.footerPl, 0);
    const footerPr = toNumber(raw.footerPr, 0);
    const signInLinkPt = toNumber(raw.signInLinkPt, 0);
    const signInLinkPb = toNumber(raw.signInLinkPb, 0);
    const signInLinkPl = toNumber(raw.signInLinkPl, 0);
    const signInLinkPr = toNumber(raw.signInLinkPr, 0);
    const footerBorderRadius = toNumber(raw.footerBorderRadius, 0);
    const signInLinkBorderRadius = toNumber(raw.signInLinkBorderRadius, 0);

    // Auto uppercase flags
    const firstNameAutoUppercase = toBoolean(raw.firstNameAutoUppercase, false);
    const lastNameAutoUppercase = toBoolean(raw.lastNameAutoUppercase, false);
    const emailAutoUppercase = toBoolean(raw.emailAutoUppercase, false);
    const passwordAutoUppercase = toBoolean(raw.passwordAutoUppercase, false);
    const firstNameInputTextAutoUppercase = toBoolean(raw.firstNameInputTextAutoUppercase, false);
    const lastNameInputTextAutoUppercase = toBoolean(raw.lastNameInputTextAutoUppercase, false);
    const emailInputTextAutoUppercase = toBoolean(raw.emailInputTextAutoUppercase, false);
    const passwordInputTextAutoUppercase = toBoolean(raw.passwordInputTextAutoUppercase, false);
    const footerLinkAutoUppercase = toBoolean(raw.footerLinkAutoUppercase, false);

    return {
      pt, pb, pl, pr, subgpt, subgpb, subgpl, subgpr, bgColor, cardBgColor, cardBorderColor, cardBorderWidth, borderRadius, inputBorderColor, inputBorderRadius, inputHeight,
      fieldGap, inputPaddingHorizontal, inputPaddingVertical,
      authVisible, logoVisible, bgPadVisible, buttonVisible, footerVisible, signInLinkVisible,
      showMenuIcon, showProfilePicture, firstNameVisible, lastNameVisible, emailInputVisible,
      passwordInputVisible, emailLabelVisible, firstNameLabelVisible, lastNameLabelVisible,
      passwordLabelVisible, buttonIconsVisible, redirectionVisible,
      authTitle, headerTitle, buttonText, footerText, footerLinkText,
      firstNameLabelText, lastNameLabelText, emailLabelText, passwordLabelText,
      firstNamePlaceholder, lastNamePlaceholder, emailPlaceholder, passwordPlaceholder,
      firstNamePlaceholderVisible, lastNamePlaceholderVisible, emailPlaceholderVisible, passwordPlaceholderVisible,
      titleColor, headerTitleColor, buttonTextColor, buttonIconColor, footerTextColor,
      footerLinkColor, firstNameLabelColor, lastNameLabelColor, emailLabelColor,
      passwordLabelColor, firstNameInputTextColor, lastNameInputTextColor,
      emailInputTextColor, passwordInputTextColor, firstNamePlaceholderColor,
      lastNamePlaceholderColor, emailPlaceholderColor, passwordPlaceholderColor,
      menuIconColor, profilePictureBgColor, profilePictureBorderColor, footerBgColor,
      signInLinkBgColor,
      headerTitleFontSize, buttonFontSize, buttonIconSize, footerTextFontSize,
      footerLinkFontSize, firstNameLabelFontSize, lastNameLabelFontSize,
      emailLabelFontSize, passwordLabelFontSize, firstNameInputTextFontSize,
      lastNameInputTextFontSize, emailInputTextFontSize, passwordInputTextFontSize,
      firstNamePlaceholderFontSize, lastNamePlaceholderFontSize, emailPlaceholderFontSize,
      passwordPlaceholderFontSize,
      headerTitleFontFamily, buttonFontFamily, footerLinkFontFamily,
      firstNameLabelFontFamily, lastNameLabelFontFamily, emailLabelFontFamily,
      passwordLabelFontFamily, firstNameInputTextFontFamily, lastNameInputTextFontFamily,
      emailInputTextFontFamily, passwordInputTextFontFamily, firstNamePlaceholderFontFamily,
      lastNamePlaceholderFontFamily, emailPlaceholderFontFamily, passwordPlaceholderFontFamily,
      headerTitleFontWeight, buttonFontWeight, footerLinkFontWeight,
      firstNameLabelFontWeight, lastNameLabelFontWeight, emailLabelFontWeight,
      passwordLabelFontWeight, firstNameInputTextFontWeight, lastNameInputTextFontWeight,
      emailInputTextFontWeight, passwordInputTextFontWeight, firstNamePlaceholderFontWeight,
      lastNamePlaceholderFontWeight, emailPlaceholderFontWeight, passwordPlaceholderFontWeight,
      firstNameAlignment, lastNameAlignment, emailAlignment, passwordAlignment,
      firstNameInputTextAlignment, lastNameInputTextAlignment, emailInputTextAlignment,
      passwordInputTextAlignment, footerLinkAlignment, buttonIconAlignment,
      buttonWidth, buttonHeight, buttonRadius, buttonBgColor, buttonGradient, buttonBorderColor, buttonBorderWidth, buttonAutoUppercase, buttonIcon,
      profilePictureUrl, profilePictureSize, navigateTo, selectScreen,
      footerPt, footerPb, footerPl, footerPr, signInLinkPt, signInLinkPb,
      signInLinkPl, signInLinkPr, footerBorderRadius, signInLinkBorderRadius,
      firstNameAutoUppercase, lastNameAutoUppercase, emailAutoUppercase, passwordAutoUppercase,
      firstNameInputTextAutoUppercase, lastNameInputTextAutoUppercase,
      emailInputTextAutoUppercase, passwordInputTextAutoUppercase, footerLinkAutoUppercase,
    };
  }, [layoutCss, raw]);

  // Destructure all props from extractedProps
  const {
    pt, pb, pl, pr, subgpt, subgpb, subgpl, subgpr, bgColor, cardBgColor, cardBorderColor, cardBorderWidth, borderRadius, inputBorderColor, inputBorderRadius, inputHeight,
    fieldGap, inputPaddingHorizontal, inputPaddingVertical,
    authVisible, logoVisible, bgPadVisible, buttonVisible, footerVisible, signInLinkVisible,
    showMenuIcon, showProfilePicture, firstNameVisible, lastNameVisible, emailInputVisible,
    passwordInputVisible, emailLabelVisible, firstNameLabelVisible, lastNameLabelVisible,
    passwordLabelVisible, buttonIconsVisible, redirectionVisible,
    authTitle, headerTitle, buttonText, footerText, footerLinkText,
    firstNameLabelText, lastNameLabelText, emailLabelText, passwordLabelText,
    firstNamePlaceholder, lastNamePlaceholder, emailPlaceholder, passwordPlaceholder,
    firstNamePlaceholderVisible, lastNamePlaceholderVisible, emailPlaceholderVisible, passwordPlaceholderVisible,
    titleColor, headerTitleColor, buttonTextColor, buttonIconColor, footerTextColor,
    footerLinkColor, firstNameLabelColor, lastNameLabelColor, emailLabelColor,
    passwordLabelColor, firstNameInputTextColor, lastNameInputTextColor,
    emailInputTextColor, passwordInputTextColor, firstNamePlaceholderColor,
    lastNamePlaceholderColor, emailPlaceholderColor, passwordPlaceholderColor,
    menuIconColor, profilePictureBgColor, profilePictureBorderColor, footerBgColor,
    signInLinkBgColor,
    headerTitleFontSize, buttonFontSize, buttonIconSize, footerTextFontSize,
    footerLinkFontSize, firstNameLabelFontSize, lastNameLabelFontSize,
    emailLabelFontSize, passwordLabelFontSize, firstNameInputTextFontSize,
    lastNameInputTextFontSize, emailInputTextFontSize, passwordInputTextFontSize,
    firstNamePlaceholderFontSize, lastNamePlaceholderFontSize, emailPlaceholderFontSize,
    passwordPlaceholderFontSize,
    headerTitleFontFamily, buttonFontFamily, footerLinkFontFamily,
    firstNameLabelFontFamily, lastNameLabelFontFamily, emailLabelFontFamily,
    passwordLabelFontFamily, firstNameInputTextFontFamily, lastNameInputTextFontFamily,
    emailInputTextFontFamily, passwordInputTextFontFamily, firstNamePlaceholderFontFamily,
    lastNamePlaceholderFontFamily, emailPlaceholderFontFamily, passwordPlaceholderFontFamily,
    headerTitleFontWeight, buttonFontWeight, footerLinkFontWeight,
    firstNameLabelFontWeight, lastNameLabelFontWeight, emailLabelFontWeight,
    passwordLabelFontWeight, firstNameInputTextFontWeight, lastNameInputTextFontWeight,
    emailInputTextFontWeight, passwordInputTextFontWeight, firstNamePlaceholderFontWeight,
    lastNamePlaceholderFontWeight, emailPlaceholderFontWeight, passwordPlaceholderFontWeight,
    firstNameAlignment, lastNameAlignment, emailAlignment, passwordAlignment,
    firstNameInputTextAlignment, lastNameInputTextAlignment, emailInputTextAlignment,
    passwordInputTextAlignment, footerLinkAlignment, buttonIconAlignment,
    buttonWidth, buttonHeight, buttonRadius, buttonBgColor, buttonGradient, buttonBorderColor, buttonBorderWidth, buttonAutoUppercase, buttonIcon,
    profilePictureUrl, profilePictureSize, navigateTo, selectScreen,
    footerPt, footerPb, footerPl, footerPr, signInLinkPt, signInLinkPb,
    signInLinkPl, signInLinkPr, footerBorderRadius, signInLinkBorderRadius,
    firstNameAutoUppercase, lastNameAutoUppercase, emailAutoUppercase, passwordAutoUppercase,
    firstNameInputTextAutoUppercase, lastNameInputTextAutoUppercase,
    emailInputTextAutoUppercase, passwordInputTextAutoUppercase, footerLinkAutoUppercase,
  } = extractedProps;

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Effect to ensure component refreshes when section changes (for auto-refresh)
  useEffect(() => {
    // This effect ensures the component is aware of section changes
    // The useMemo hooks above will automatically recalculate when section changes
    // This is just to force a re-render if needed
    if (section) {
      // Clear any errors when section updates
      setError("");
    }
  }, [section]);

  // Keep hook ordering stable across renders to avoid React hook mismatch crashes
  // when DSL data arrives after the first render.
  if (!hasRawData) {
    return null;
  }

  const handleSubmit = async () => {
    setError("");
    
    // Validation
    if (firstNameVisible && !firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    if (lastNameVisible && !lastName.trim()) {
      setError("Please enter your last name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }
    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const fullName = [firstName.trim(), lastNameVisible ? lastName.trim() : ""]
        .filter(Boolean)
        .join(" ");
      await signupUser(email.trim(), password.trim(), fullName || email.trim());

      // Navigate to success screen or handle success
      if (navigateTo === "screen" && selectScreen) {
        await navigateToDslTarget(navigation, {
          target: selectScreen,
          navigateRef: selectScreen,
          navigateType: "screen",
          fallbackTitle: selectScreen,
        });
      } else {
        Alert.alert("Success", "Account created successfully!", [
          { text: "OK", onPress: () => navigation.navigate("LayoutScreen") },
        ]);
      }
    } catch (err) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // "Sign In" footer link opens Auth only for users who still need to sign in.
  const handleSignInLink = () => {
    if (isLoggedIn) {
      navigation.navigate("BottomNavScreen", { pageName: "my-account", title: "My Account", link: "my-account" });
      return;
    }
    if (initializing) return;
    navigation.navigate("Auth", { initialMode: "login" });
  };

  const displayButtonText = buttonAutoUppercase ? buttonText.toUpperCase() : buttonText;
  const displayFooterLinkText = footerLinkAutoUppercase ? footerLinkText.toUpperCase() : footerLinkText;
  const maxProfilePictureSize = Math.max(
    0,
    screenWidth - subgpl - subgpr - (bgPadVisible ? pl + pr : 0)
  );
  const mobileProfilePictureSize = maxProfilePictureSize > 0
    ? Math.min(profilePictureSize, maxProfilePictureSize)
    : profilePictureSize;
  const mobileButtonWidthPct = buttonWidth;
  const mobileButtonHeight = buttonHeight;
  const mobileButtonFontSize = buttonFontSize;
  const mobileTitleFontSize = headerTitleFontSize;
  const mobileFieldFontSize = (size) => size;
  const inputAlignFor = (fieldAlign) => fieldAlign || "left";
  const firstNameLooksLikeFullName = `${firstNamePlaceholder} ${firstNameLabelText}`
    .toLowerCase()
    .includes("full name");
  const firstNameFieldTextAlign =
    !lastNameVisible && firstNameLooksLikeFullName && inputAlignFor(firstNameInputTextAlignment) === "center"
      ? "left"
      : inputAlignFor(firstNameInputTextAlignment);
  const shouldShowFieldLabel = (labelVisible, placeholderVisible) =>
    labelVisible && !placeholderVisible;
  const mobileCardPaddingTop = bgPadVisible ? resolveResponsiveVerticalSpace(pt, viewportHeight, 0.055) : 0;
  const mobileCardPaddingBottom = bgPadVisible ? resolveResponsiveVerticalSpace(pb, viewportHeight, 0.055) : 0;
  const mobileCardPaddingLeft = bgPadVisible ? pl : 0;
  const mobileCardPaddingRight = bgPadVisible ? pr : 0;
  const mobileSubgpt = resolveResponsiveVerticalSpace(subgpt, viewportHeight, 0.05);
  const mobileSubgpb = resolveResponsiveVerticalSpace(subgpb, viewportHeight, 0.05);
  const mobileFieldGap = resolveResponsiveVerticalSpace(fieldGap, viewportHeight, 0.03);
  const mobileFooterPt = resolveResponsiveVerticalSpace(footerPt, viewportHeight, 0.04);
  const mobileFooterPb = resolveResponsiveVerticalSpace(footerPb, viewportHeight, 0.04);
  const mobileSignInLinkPt = resolveResponsiveVerticalSpace(signInLinkPt, viewportHeight, 0.02);
  const mobileSignInLinkPb = resolveResponsiveVerticalSpace(signInLinkPb, viewportHeight, 0.02);
  const resolvedButtonIcon = resolveFA4IconName(buttonIcon);
  const shouldShowProfilePicture = logoVisible && showProfilePicture && Boolean(profilePictureUrl);
  const shouldShowHeaderTitle = Boolean(String(headerTitle || "").trim()) && !authTitle;
  const submitButtonContent = loading ? (
    <ActivityIndicator color={buttonTextColor} />
  ) : (
    <View style={styles.buttonContent}>
      {buttonIconsVisible && resolvedButtonIcon && buttonIconAlignment === "left" && (
        <Icon name={resolvedButtonIcon} size={buttonIconSize} color={buttonIconColor} style={styles.buttonIcon} />
      )}
      <Text
        allowFontScaling={false}
        style={[
          styles.buttonText,
          {
            color: buttonTextColor,
            fontSize: mobileButtonFontSize,
            fontFamily: buttonFontFamily,
            fontWeight: buttonFontWeight,
          },
        ]}
      >
        {displayButtonText}
      </Text>
      {buttonIconsVisible && resolvedButtonIcon && buttonIconAlignment === "right" && (
        <Icon name={resolvedButtonIcon} size={buttonIconSize} color={buttonIconColor} style={styles.buttonIcon} />
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.kavContainer, { backgroundColor: bgColor }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBgColor,
            borderRadius,
            marginLeft: subgpl,
            marginRight: subgpr,
            marginTop: mobileSubgpt,
            marginBottom: mobileSubgpb,
            paddingTop: mobileCardPaddingTop,
            paddingBottom: mobileCardPaddingBottom,
            paddingLeft: mobileCardPaddingLeft,
            paddingRight: mobileCardPaddingRight,
            borderColor: cardBorderColor,
            borderWidth: cardBorderWidth,
          },
        ]}
      >
        {/* Header with menu icon */}
        {showMenuIcon && (
          <TouchableOpacity
            style={styles.menuIcon}
            onPress={() => navigation.goBack()}
          >
            <Icon name="bars" size={24} color={menuIconColor} />
          </TouchableOpacity>
        )}

        {/* Logo/Profile Picture */}
        {shouldShowProfilePicture && (
          <View
            style={[
              styles.profilePictureContainer,
              {
                width: mobileProfilePictureSize,
                height: mobileProfilePictureSize,
                borderRadius: mobileProfilePictureSize / 2,
                backgroundColor: profilePictureBgColor,
                borderColor: profilePictureBorderColor,
                borderWidth: 2,
                marginBottom: mobileFieldGap,
              },
            ]}
          >
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.profilePicture}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Header Title */}
        {authVisible && shouldShowHeaderTitle && (
          <Text
            style={[
              styles.headerTitle,
              {
                color: headerTitleColor,
                fontSize: headerTitleFontSize,
                fontFamily: headerTitleFontFamily,
                fontWeight: headerTitleFontWeight,
                marginBottom: mobileFieldGap,
              },
            ]}
          >
            {headerTitle}
          </Text>
        )}

        {/* Auth Title */}
        {authVisible && authTitle && (
          <Text
            style={[
              styles.authTitle,
              {
                color: titleColor,
                fontSize: mobileTitleFontSize,
                fontWeight: toFontWeight(raw.headlineWeight) || "700",
                fontFamily: resolveFont(toString(raw.headlineFontFamily, headerTitleFontFamily || "Inter")),
                marginBottom: mobileFieldGap,
              },
            ]}
          >
            {authTitle}
          </Text>
        )}

        {/* First Name Field */}
        {firstNameVisible && (
          <View style={[styles.fieldContainer, { marginBottom: mobileFieldGap }]}>
            {shouldShowFieldLabel(firstNameLabelVisible, firstNamePlaceholderVisible) && (
              <Text style={[styles.label, { color: firstNameLabelColor, fontSize: firstNameLabelFontSize, fontFamily: firstNameLabelFontFamily, fontWeight: firstNameLabelFontWeight }]}>
                {firstNameLabelText}
              </Text>
            )}
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: inputBorderColor,
                  color: firstNameInputTextColor,
                  fontSize: mobileFieldFontSize(firstName ? firstNameInputTextFontSize : firstNamePlaceholderFontSize),
                  fontFamily: firstName ? firstNameInputTextFontFamily : firstNamePlaceholderFontFamily,
                  fontWeight: firstName ? firstNameInputTextFontWeight : firstNamePlaceholderFontWeight,
                  textAlign: firstNameFieldTextAlign,
                  textAlignVertical: "center",
                  borderRadius: inputBorderRadius,
                  minHeight: inputHeight,
                  paddingHorizontal: inputPaddingHorizontal,
                  paddingVertical: inputPaddingVertical,
                },
              ]}
              placeholder={firstNamePlaceholderVisible ? firstNamePlaceholder : ""}
              placeholderTextColor={firstNamePlaceholderColor}
              value={firstName}
              onChangeText={(text) =>
                setFirstName(firstNameAutoUppercase ? text.toUpperCase() : text)
              }
              autoCapitalize={firstNameInputTextAutoUppercase ? "characters" : "words"}
            />
          </View>
        )}

        {/* Last Name Field */}
        {lastNameVisible && (
          <View style={[styles.fieldContainer, { marginBottom: mobileFieldGap }]}>
            {shouldShowFieldLabel(lastNameLabelVisible, lastNamePlaceholderVisible) && (
              <Text style={[styles.label, { color: lastNameLabelColor, fontSize: lastNameLabelFontSize, fontFamily: lastNameLabelFontFamily, fontWeight: lastNameLabelFontWeight }]}>
                {lastNameLabelText}
              </Text>
            )}
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: inputBorderColor,
                  color: lastNameInputTextColor,
                  fontSize: mobileFieldFontSize(lastName ? lastNameInputTextFontSize : lastNamePlaceholderFontSize),
                  fontFamily: lastName ? lastNameInputTextFontFamily : lastNamePlaceholderFontFamily,
                  fontWeight: lastName ? lastNameInputTextFontWeight : lastNamePlaceholderFontWeight,
                  textAlign: inputAlignFor(lastNameInputTextAlignment),
                  textAlignVertical: "center",
                  borderRadius: inputBorderRadius,
                  minHeight: inputHeight,
                  paddingHorizontal: inputPaddingHorizontal,
                  paddingVertical: inputPaddingVertical,
                },
              ]}
              placeholder={lastNamePlaceholderVisible ? lastNamePlaceholder : ""}
              placeholderTextColor={lastNamePlaceholderColor}
              value={lastName}
              onChangeText={(text) =>
                setLastName(lastNameAutoUppercase ? text.toUpperCase() : text)
              }
              autoCapitalize={lastNameInputTextAutoUppercase ? "characters" : "words"}
            />
          </View>
        )}

        {/* Email Field */}
        {emailInputVisible && (
          <View style={[styles.fieldContainer, { marginBottom: mobileFieldGap }]}>
            {shouldShowFieldLabel(emailLabelVisible, emailPlaceholderVisible) && (
              <Text style={[styles.label, { color: emailLabelColor, fontSize: emailLabelFontSize, fontFamily: emailLabelFontFamily, fontWeight: emailLabelFontWeight }]}>
                {emailLabelText}
              </Text>
            )}
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: inputBorderColor,
                  color: emailInputTextColor,
                  fontSize: mobileFieldFontSize(email ? emailInputTextFontSize : emailPlaceholderFontSize),
                  fontFamily: email ? emailInputTextFontFamily : emailPlaceholderFontFamily,
                  fontWeight: email ? emailInputTextFontWeight : emailPlaceholderFontWeight,
                  textAlign: inputAlignFor(emailInputTextAlignment),
                  textAlignVertical: "center",
                  borderRadius: inputBorderRadius,
                  minHeight: inputHeight,
                  paddingHorizontal: inputPaddingHorizontal,
                  paddingVertical: inputPaddingVertical,
                },
              ]}
              placeholder={emailPlaceholderVisible ? emailPlaceholder : ""}
              placeholderTextColor={emailPlaceholderColor}
              value={email}
              onChangeText={(text) =>
                setEmail(emailAutoUppercase ? text.toUpperCase() : text)
              }
              keyboardType="email-address"
              autoCapitalize={emailInputTextAutoUppercase ? "characters" : "none"}
              autoCorrect={false}
            />
          </View>
        )}

        {/* Password Field */}
        {passwordInputVisible && (
          <View style={[styles.fieldContainer, { marginBottom: mobileFieldGap }]}>
            {shouldShowFieldLabel(passwordLabelVisible, passwordPlaceholderVisible) && (
              <Text style={[styles.label, { color: passwordLabelColor, fontSize: passwordLabelFontSize, fontFamily: passwordLabelFontFamily, fontWeight: passwordLabelFontWeight }]}>
                {passwordLabelText}
              </Text>
            )}
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: inputBorderColor,
                  color: passwordInputTextColor,
                  fontSize: mobileFieldFontSize(password ? passwordInputTextFontSize : passwordPlaceholderFontSize),
                  fontFamily: password ? passwordInputTextFontFamily : passwordPlaceholderFontFamily,
                  fontWeight: password ? passwordInputTextFontWeight : passwordPlaceholderFontWeight,
                  textAlign: inputAlignFor(passwordInputTextAlignment),
                  textAlignVertical: "center",
                  borderRadius: inputBorderRadius,
                  minHeight: inputHeight,
                  paddingHorizontal: inputPaddingHorizontal,
                  paddingVertical: inputPaddingVertical,
                },
              ]}
              placeholder={passwordPlaceholderVisible ? passwordPlaceholder : ""}
              placeholderTextColor={passwordPlaceholderColor}
              value={password}
              onChangeText={(text) =>
                setPassword(passwordAutoUppercase ? text.toUpperCase() : text)
              }
              secureTextEntry
              autoCapitalize={passwordInputTextAutoUppercase ? "characters" : "none"}
            />
          </View>
        )}

        {/* Error Message */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Submit Button */}
        {buttonVisible && (
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: buttonGradient ? "transparent" : buttonBgColor,
                borderColor: buttonBorderColor,
                borderWidth: buttonBorderWidth,
                width: `${mobileButtonWidthPct}%`,
                height: mobileButtonHeight,
                borderRadius: buttonRadius,
                overflow: "hidden",
              },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {buttonGradient ? (
              <LinearGradient
                colors={buttonGradient.colors}
                angle={buttonGradient.angle}
                useAngle
                style={[styles.buttonGradient, { borderRadius: buttonRadius }]}
              >
                {submitButtonContent}
              </LinearGradient>
            ) : (
              submitButtonContent
            )}
          </TouchableOpacity>
        )}

        {/* Footer */}
        {footerVisible && (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: footerBgColor,
                paddingTop: mobileFooterPt,
                paddingBottom: mobileFooterPb,
                paddingLeft: footerPl,
                paddingRight: footerPr,
                borderRadius: footerBorderRadius,
              },
            ]}
          >
            <Text
              style={[
                styles.footerText,
                {
                  color: footerTextColor,
                  fontSize: footerTextFontSize,
                  fontFamily: resolveFont(toString(raw.subtextFontFamily, baseFontFamily)),
                  fontWeight: toFontWeight(raw.subtextWeight) || "400",
                },
              ]}
            >
              {footerText}
            </Text>
            {signInLinkVisible && (
              <TouchableOpacity
                style={[
                  styles.signInLink,
                  {
                    backgroundColor: signInLinkBgColor,
                    paddingTop: mobileSignInLinkPt,
                    paddingBottom: mobileSignInLinkPb,
                    paddingLeft: signInLinkPl,
                    paddingRight: signInLinkPr,
                    borderRadius: signInLinkBorderRadius,
                    alignSelf: footerLinkAlignment,
                  },
                ]}
                onPress={handleSignInLink}
              >
                <Text
                  style={[
                    styles.signInLinkText,
                    {
                      color: footerLinkColor,
                      fontSize: footerLinkFontSize,
                      fontFamily: footerLinkFontFamily,
                      fontWeight: footerLinkFontWeight,
                    },
                  ]}
                >
                  {displayFooterLinkText}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kavContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
  },
  menuIcon: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  profilePictureContainer: {
    alignSelf: "center",
    marginBottom: 16,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  profilePicture: {
    width: "100%",
    height: "100%",
  },
  headerTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  authTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  fieldContainer: {
    width: "100%",
  },
  label: {
    marginBottom: 6,
    alignSelf: "stretch",
    textAlign: "left",
  },
  input: {
    borderWidth: 1,
    fontSize: 15,
    textAlign: "left",
    textAlignVertical: "center",
    width: "100%",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    marginBottom: 8,
    textAlign: "center",
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  buttonGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginHorizontal: 6,
  },
  buttonText: {
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  footerText: {
    textAlign: "center",
  },
  signInLink: {
  },
  signInLinkText: {
    textDecorationLine: "none",
  },
});
