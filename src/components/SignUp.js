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
import { convertStyles } from "../utils/convertStyles";
import { registerCustomer } from "../services/customerService";
import { resolveAppId } from "../utils/appId";
import { fetchStoreConfig } from "../services/storeService";
import { resolveFA4IconName } from "../utils/faIconAlias";
import Icon from "react-native-vector-icons/FontAwesome6";

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
  return "center";
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function SignUp({ section }) {
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();

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
    const pt = toNumber(raw.pt, 60);
    const pb = toNumber(raw.pb, 60);
    const pl = toNumber(raw.pl, 20);
    const pr = toNumber(raw.pr, 20);
    const bgColor = toString(raw.bgColor, "#FFFFFF");
    const cardBgColor = toString(raw.cardBgColor, "#FFFFFF");
    const cardBorderColor = toString(raw.cardBorderColor, "#0c9297");
    const borderRadius = toNumber(raw.borderRadius, 0);
    const inputBorderColor = toString(raw.inputBorderColor, "#027579");

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

    // Colors
    const titleColor = toString(raw.titleColor, "#027579");
    const headerTitleColor = toString(raw.headerTitleColor, "#000000");
    const buttonTextColor = toString(raw.buttonTextColor, "#000000");
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
    const buttonFontSize = fs(raw.buttonFontSize, 16);
    const buttonIconSize = toNumber(raw.buttonIconSize, 16);
    const footerTextFontSize = fs(raw.footerTextFontSize, 13);
    const footerLinkFontSize = fs(raw.footerLinkFontSize, 14);
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
    const headerTitleFontFamily = toString(raw.headerTitleFontFamily, "Inter, sans-serif");
    const buttonFontFamily = toString(raw.buttonFontFamily, "Inter, sans-serif");
    const footerLinkFontFamily = toString(raw.footerLinkFontFamily, "Inter, sans-serif");
    const firstNameLabelFontFamily = toString(raw.firstNameLabelFontFamily, "Inter, sans-serif");
    const lastNameLabelFontFamily = toString(raw.lastNameLabelFontFamily, "Inter, sans-serif");
    const emailLabelFontFamily = toString(raw.emailLabelFontFamily, "Inter, sans-serif");
    const passwordLabelFontFamily = toString(raw.passwordLabelFontFamily, "Inter, sans-serif");
    const firstNameInputTextFontFamily = toString(raw.firstNameInputTextFontFamily, "Inter, sans-serif");
    const lastNameInputTextFontFamily = toString(raw.lastNameInputTextFontFamily, "Inter, sans-serif");
    const emailInputTextFontFamily = toString(raw.emailInputTextFontFamily, "Inter, sans-serif");
    const passwordInputTextFontFamily = toString(raw.passwordInputTextFontFamily, "Inter, sans-serif");
    const firstNamePlaceholderFontFamily = toString(raw.firstNamePlaceholderFontFamily, "Inter, sans-serif");
    const lastNamePlaceholderFontFamily = toString(raw.lastNamePlaceholderFontFamily, "Inter, sans-serif");
    const emailPlaceholderFontFamily = toString(raw.emailPlaceholderFontFamily, "Inter, sans-serif");
    const passwordPlaceholderFontFamily = toString(raw.passwordPlaceholderFontFamily, "Inter, sans-serif");

    // Font weights
    const headerTitleFontWeight = toFontWeight(raw.headerTitleFontWeight) || "700";
    const buttonFontWeight = toFontWeight(raw.buttonFontWeight) || "700";
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
    const buttonBgColor = parseGradient(toString(raw.buttonBgColor, "#FFFFFF")) || "#FFFFFF";
    const buttonBorderColor = toString(raw.buttonBorderColor, "#0c9297");
    const buttonAutoUppercase = toBoolean(raw.buttonAutoUppercase, false);
    const buttonIcon = toString(raw.buttonIcon, "");

    // Profile picture — cap to 30% of screen width so it doesn't overflow on small screens
    const profilePictureUrl = toString(raw.profilePictureUrl, "");
    const profilePictureSize = toNumber(raw.profilePictureSize, 90);

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
      pt, pb, pl, pr, bgColor, cardBgColor, cardBorderColor, borderRadius, inputBorderColor,
      authVisible, logoVisible, bgPadVisible, buttonVisible, footerVisible, signInLinkVisible,
      showMenuIcon, showProfilePicture, firstNameVisible, lastNameVisible, emailInputVisible,
      passwordInputVisible, emailLabelVisible, firstNameLabelVisible, lastNameLabelVisible,
      passwordLabelVisible, buttonIconsVisible, redirectionVisible,
      authTitle, headerTitle, buttonText, footerText, footerLinkText,
      firstNameLabelText, lastNameLabelText, emailLabelText, passwordLabelText,
      firstNamePlaceholder, lastNamePlaceholder, emailPlaceholder, passwordPlaceholder,
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
      buttonWidth, buttonHeight, buttonRadius, buttonBgColor, buttonBorderColor, buttonAutoUppercase, buttonIcon,
      profilePictureUrl, profilePictureSize, navigateTo, selectScreen,
      footerPt, footerPb, footerPl, footerPr, signInLinkPt, signInLinkPb,
      signInLinkPl, signInLinkPr, footerBorderRadius, signInLinkBorderRadius,
      firstNameAutoUppercase, lastNameAutoUppercase, emailAutoUppercase, passwordAutoUppercase,
      firstNameInputTextAutoUppercase, lastNameInputTextAutoUppercase,
      emailInputTextAutoUppercase, passwordInputTextAutoUppercase, footerLinkAutoUppercase,
    };
  }, [raw, screenWidth]);

  // Destructure all props from extractedProps
  const {
    pt, pb, pl, pr, bgColor, cardBgColor, cardBorderColor, borderRadius, inputBorderColor,
    authVisible, logoVisible, bgPadVisible, buttonVisible, footerVisible, signInLinkVisible,
    showMenuIcon, showProfilePicture, firstNameVisible, lastNameVisible, emailInputVisible,
    passwordInputVisible, emailLabelVisible, firstNameLabelVisible, lastNameLabelVisible,
    passwordLabelVisible, buttonIconsVisible, redirectionVisible,
    authTitle, headerTitle, buttonText, footerText, footerLinkText,
    firstNameLabelText, lastNameLabelText, emailLabelText, passwordLabelText,
    firstNamePlaceholder, lastNamePlaceholder, emailPlaceholder, passwordPlaceholder,
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
    buttonWidth, buttonHeight, buttonRadius, buttonBgColor, buttonBorderColor, buttonAutoUppercase, buttonIcon,
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

  // If auth is not visible, don't render
  if (!authVisible) {
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
      const app_id = resolveAppId();
      const storeConfig = await fetchStoreConfig();
      const store_id = storeConfig?.id ?? null;
      if (!store_id) {
        throw new Error("Store not configured. Please try again.");
      }

      await registerCustomer({
        first_name: firstName.trim(),
        last_name: lastNameVisible ? lastName.trim() : "",
        email: email.trim(),
        password: password.trim(),
        store_id,
        app_id,
      });

      // Navigate to success screen or handle success
      if (navigateTo === "screen" && selectScreen) {
        const dest = selectScreen.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        if (dest === "home" || dest === "index") {
          navigation.navigate("LayoutScreen");
        } else {
          navigation.navigate("BottomNavScreen", { pageName: dest });
        }
      } else {
        Alert.alert("Success", "Account created successfully!", [
          { text: "Sign In", onPress: () => navigation.navigate("Auth") },
          { text: "OK" },
        ]);
      }
    } catch (err) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // "Sign In" footer link always goes to the Auth screen
  const handleSignInLink = () => {
    navigation.navigate("Auth");
  };

  const displayButtonText = buttonAutoUppercase ? buttonText.toUpperCase() : buttonText;
  const displayFooterLinkText = footerLinkAutoUppercase ? footerLinkText.toUpperCase() : footerLinkText;
  const compactScale = screenWidth < 380 ? 0.94 : 1;
  const contentWidth = Math.max(280, screenWidth - 32);
  const mobileProfilePictureSize = clamp(
    profilePictureSize * compactScale,
    52,
    Math.min(Math.round(contentWidth * 0.45), 140)
  );
  const mobileButtonWidthPct = clamp(buttonWidth, 72, 100);
  const mobileButtonHeight = clamp(buttonHeight * compactScale, 44, 52);
  const mobileButtonFontSize = clamp(buttonFontSize * compactScale, 14, 18);
  const mobileTitleFontSize = clamp(headerTitleFontSize * compactScale, 18, 30);
  const mobileFieldFontSize = (size) => clamp(size * compactScale, 14, 17);
  const mobileCardPaddingTop = bgPadVisible ? clamp(pt * compactScale, 10, 28) : 0;
  const mobileCardPaddingBottom = bgPadVisible ? clamp(pb * compactScale, 12, 28) : 0;
  const mobileCardPaddingLeft = bgPadVisible ? clamp(pl * compactScale, 12, 20) : 0;
  const mobileCardPaddingRight = bgPadVisible ? clamp(pr * compactScale, 12, 20) : 0;
  const resolvedButtonIcon = resolveFA4IconName(buttonIcon);
  const shouldShowProfilePicture =
    logoVisible && showProfilePicture && Boolean(String(profilePictureUrl || "").trim());
  const shouldShowHeaderTitle = Boolean(String(headerTitle || "").trim()) && !authTitle;

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
            paddingTop: mobileCardPaddingTop,
            paddingBottom: mobileCardPaddingBottom,
            paddingLeft: mobileCardPaddingLeft,
            paddingRight: mobileCardPaddingRight,
            borderColor: cardBorderColor,
            borderWidth: cardBorderColor ? 1 : 0,
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
        {shouldShowHeaderTitle && (
          <Text
            style={[
              styles.headerTitle,
              {
                color: headerTitleColor,
                fontSize: headerTitleFontSize,
                fontFamily: headerTitleFontFamily,
                fontWeight: headerTitleFontWeight,
              },
            ]}
          >
            {headerTitle}
          </Text>
        )}

        {/* Auth Title */}
        {authTitle && (
          <Text
            style={[
              styles.authTitle,
              {
                color: titleColor,
                fontSize: mobileTitleFontSize,
                fontWeight: toFontWeight(raw.headlineWeight) || "700",
                fontFamily: toString(raw.headlineFontFamily, headerTitleFontFamily || "Inter"),
              },
            ]}
          >
            {authTitle}
          </Text>
        )}

        {/* First Name Field */}
        {firstNameVisible && (
          <View style={[styles.fieldContainer, { alignItems: firstNameAlignment }]}>
            {firstNameLabelVisible && (
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
                  fontSize: mobileFieldFontSize(firstNameInputTextFontSize),
                  fontFamily: firstNameInputTextFontFamily,
                  fontWeight: firstNameInputTextFontWeight,
                  textAlign: firstNameInputTextAlignment,
                },
              ]}
              placeholder={firstNamePlaceholder}
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
          <View style={[styles.fieldContainer, { alignItems: lastNameAlignment }]}>
            {lastNameLabelVisible && (
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
                  fontSize: mobileFieldFontSize(lastNameInputTextFontSize),
                  fontFamily: lastNameInputTextFontFamily,
                  fontWeight: lastNameInputTextFontWeight,
                  textAlign: lastNameInputTextAlignment,
                },
              ]}
              placeholder={lastNamePlaceholder}
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
          <View style={[styles.fieldContainer, { alignItems: emailAlignment }]}>
            {emailLabelVisible && (
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
                  fontSize: mobileFieldFontSize(emailInputTextFontSize),
                  fontFamily: emailInputTextFontFamily,
                  fontWeight: emailInputTextFontWeight,
                  textAlign: emailInputTextAlignment,
                },
              ]}
              placeholder={emailPlaceholder}
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
          <View style={[styles.fieldContainer, { alignItems: passwordAlignment }]}>
            {passwordLabelVisible && (
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
                  fontSize: mobileFieldFontSize(passwordInputTextFontSize),
                  fontFamily: passwordInputTextFontFamily,
                  fontWeight: passwordInputTextFontWeight,
                  textAlign: passwordInputTextAlignment,
                },
              ]}
              placeholder={passwordPlaceholder}
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
                backgroundColor: buttonBgColor,
                borderColor: buttonBorderColor,
                borderWidth: buttonBorderColor ? 1 : 0,
                width: `${mobileButtonWidthPct}%`,
                height: mobileButtonHeight,
                borderRadius: buttonRadius,
              },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={buttonTextColor} />
            ) : (
              <View style={styles.buttonContent}>
                {buttonIconsVisible && resolvedButtonIcon && buttonIconAlignment === "left" && (
                  <Icon name={resolvedButtonIcon} size={buttonIconSize} color={buttonIconColor} style={styles.buttonIcon} />
                )}
                <Text
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
                paddingTop: footerPt || 8,
                paddingBottom: footerPb || 4,
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
                  fontFamily: toString(raw.subtextFontFamily, "Inter"),
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
                    paddingTop: signInLinkPt,
                    paddingBottom: signInLinkPb,
                    paddingLeft: signInLinkPl || 4,
                    paddingRight: signInLinkPr || 4,
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
    paddingVertical: 16,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
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
    marginBottom: 14,
    width: "100%",
  },
  label: {
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    width: "100%",
    minHeight: 46,
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
    marginTop: 16,
    marginBottom: 16,
    alignSelf: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  buttonIcon: {
    marginHorizontal: 6,
  },
  buttonText: {
    textAlign: "center",
  },
  footer: {
    marginTop: 16,
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  footerText: {
    textAlign: "center",
    marginBottom: 4,
  },
  signInLink: {
    marginTop: 4,
    marginLeft: 4,
  },
  signInLinkText: {
    textDecorationLine: "none",
  },
});
