import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome6';
import { useAuth } from '../services/AuthContext';
import { fetchDSL } from '../engine/dslHandler';
import authLayoutFallback from '../data/authLayoutFallback';
import DynamicRenderer from '../engine/DynamicRenderer';
import { resolveFont } from '../services/typographyService';
import { getBrandColorsSync, getPageBgColorSync } from '../services/brandKitService';
import { resolveDslNavigationTarget } from '../utils/navigationTarget';

const LIVE_DSL_REFRESH_INTERVAL_MS = 30000;

type ButtonGradient = {
  colors: string[];
  angle: number;
};

type SignInTokens = {
  emailInputVisible: boolean;
  passwordInputVisible: boolean;
  buttonVisible: boolean;
  iconsVisible: boolean;
  bgPadVisible: boolean;
  forgotPasswordText: string;
  forgotPasswordColor: string;
  forgotPasswordPt: number;
  forgotPasswordPb: number;
  forgotPasswordBold: boolean;
  forgotPasswordItalic: boolean;
  forgotPasswordUnderline: boolean;
  forgotPasswordStrikethrough: boolean;
  bgColor: string;
  titleColor: string;
  cardBgColor: string;
  cardBorderColor: string;
  cardBorderWidth: number;
  cardBorderRadius: number;
  cardPaddingTop: number;
  cardPaddingBottom: number;
  cardPaddingLeft: number;
  cardPaddingRight: number;
  formGap: number;
  fieldGap: number;
  inputPaddingHorizontal: number;
  inputPaddingVertical: number;
  formCardMarginBottom: number;
  buttonMarginTop: number;
  footerMarginTop: number;
  footerLinkMarginTop: number;
  footerInline: boolean;
  pagePaddingTop: number;
  pagePaddingBottom: number;
  pagePaddingLeft: number;
  pagePaddingRight: number;
  inputBorderColor: string;
  inputHeight: number;
  footerTextColor: string;
  footerLinkColor: string;
  buttonTextColor: string;
  buttonBorderColor: string;
  buttonBorderWidth: number;
  buttonFillColor: string;
  buttonGradient: ButtonGradient | null;
  buttonPaddingTop: number;
  buttonPaddingBottom: number;
  buttonAutoUppercase: boolean;
  authTitle: string;
  buttonText: string;
  footerText: string;
  footerLinkText: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  emailPlaceholderVisible: boolean;
  passwordPlaceholderVisible: boolean;
  emailLabelText: string;
  passwordLabelText: string;
  emailLabelVisible: boolean;
  passwordLabelVisible: boolean;
  emailLabelColor: string;
  passwordLabelColor: string;
  emailLabelFontSize: number;
  passwordLabelFontSize: number;
  emailLabelFontFamily: string;
  passwordLabelFontFamily: string;
  emailLabelFontWeight: string;
  passwordLabelFontWeight: string;
  emailInputTextColor: string;
  passwordInputTextColor: string;
  emailInputTextFontSize: number;
  passwordInputTextFontSize: number;
  emailInputTextFontFamily: string;
  passwordInputTextFontFamily: string;
  emailInputTextFontWeight: string;
  passwordInputTextFontWeight: string;
  emailPlaceholderColor: string;
  passwordPlaceholderColor: string;
  emailPlaceholderFontSize: number;
  passwordPlaceholderFontSize: number;
  emailPlaceholderFontFamily: string;
  passwordPlaceholderFontFamily: string;
  emailPlaceholderFontWeight: string;
  passwordPlaceholderFontWeight: string;
  buttonFontSize: number;
  buttonFontFamily: string;
  buttonFontWeight: string;
  buttonHeight: number;
  buttonWidth: number;
  footerTextFontSize: number;
  footerTextFontFamily: string;
  footerTextFontWeight: string;
  footerLinkFontSize: number;
  footerLinkFontFamily: string;
  footerLinkFontWeight: string;
  footerLinkAlignment: string;
  footerVisible: boolean;
  forgotPasswordVisible: boolean;
  authVisible: boolean;
  buttonRadius: number;
  inputBorderRadius: number;
  headlineSize: number;
  headlineWeight: string;
  headlineFontFamily: string;
  headlineFontStyle: 'normal' | 'italic';
  headlineTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  subtextSize: number;
  subtextWeight: string;
  subtextFontFamily: string;
  emailPlaceholderFontStyle: 'normal' | 'italic';
  emailPlaceholderTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  passwordPlaceholderFontStyle: 'normal' | 'italic';
  passwordPlaceholderTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  buttonTextFontStyle: 'normal' | 'italic';
  buttonTextTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  footerLinkFontStyle: 'normal' | 'italic';
  footerLinkTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  footerTextFontStyle: 'normal' | 'italic';
  footerTextTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  logoVisible: boolean;
  logoImageUrl: string;
  logoRatio: string;
  logoScale: string;
  logoBgColor: string;
  logoBorderColor: string;
  logoCorners: number;
  buttonIcon: string;
  buttonIconSize: number;
  buttonIconColor: string;
  buttonIconAlignment: string;
  navigateTo: string;
  selectScreen: string;
};

type SignUpTokens = SignInTokens & {
  headerTitle: string;
  headerTitleColor: string;
  headerTitleFontSize: number;
  headerTitleFontFamily: string;
  headerTitleFontWeight: string;
  emailAlignment: string;
  firstNameAlignment: string;
  lastNameAlignment: string;
  passwordAlignment: string;
  emailInputTextAlignment: string;
  firstNameInputTextAlignment: string;
  lastNameInputTextAlignment: string;
  passwordInputTextAlignment: string;
  emailLabelVisible: boolean;
  firstNameLabelVisible: boolean;
  lastNameLabelVisible: boolean;
  passwordLabelVisible: boolean;
  emailInputVisible: boolean;
  firstNameVisible: boolean;
  lastNameVisible: boolean;
  passwordInputVisible: boolean;
  emailLabelText: string;
  firstNameLabelText: string;
  lastNameLabelText: string;
  passwordLabelText: string;
  emailLabelColor: string;
  firstNameLabelColor: string;
  lastNameLabelColor: string;
  passwordLabelColor: string;
  emailLabelFontSize: number;
  firstNameLabelFontSize: number;
  lastNameLabelFontSize: number;
  passwordLabelFontSize: number;
  emailLabelFontFamily: string;
  firstNameLabelFontFamily: string;
  lastNameLabelFontFamily: string;
  passwordLabelFontFamily: string;
  emailLabelFontWeight: string;
  firstNameLabelFontWeight: string;
  lastNameLabelFontWeight: string;
  passwordLabelFontWeight: string;
  emailInputTextColor: string;
  firstNameInputTextColor: string;
  lastNameInputTextColor: string;
  passwordInputTextColor: string;
  emailInputTextFontSize: number;
  firstNameInputTextFontSize: number;
  lastNameInputTextFontSize: number;
  passwordInputTextFontSize: number;
  emailInputTextFontFamily: string;
  firstNameInputTextFontFamily: string;
  lastNameInputTextFontFamily: string;
  passwordInputTextFontFamily: string;
  emailInputTextFontWeight: string;
  firstNameInputTextFontWeight: string;
  lastNameInputTextFontWeight: string;
  passwordInputTextFontWeight: string;
  emailPlaceholderColor: string;
  firstNamePlaceholderColor: string;
  lastNamePlaceholderColor: string;
  passwordPlaceholderColor: string;
  firstNamePlaceholder: string;
  lastNamePlaceholder: string;
  firstNamePlaceholderVisible: boolean;
  lastNamePlaceholderVisible: boolean;
  firstNamePlaceholderFontSize: number;
  lastNamePlaceholderFontSize: number;
  firstNamePlaceholderFontFamily: string;
  lastNamePlaceholderFontFamily: string;
  firstNamePlaceholderFontWeight: string;
  lastNamePlaceholderFontWeight: string;
  buttonHeight: number;
  buttonWidth: number;
  buttonFontSize: number;
  buttonFontFamily: string;
  buttonFontWeight: string;
  footerTextFontSize: number;
  footerLinkFontSize: number;
  footerLinkFontFamily: string;
  footerLinkFontWeight: string;
  footerLinkAlignment: string;
  footerLinkAutoUppercase: boolean;
  footerVisible: boolean;
  signInLinkVisible: boolean;
  signInLinkTextVisible: boolean;
  buttonVisible: boolean;
  buttonIconsVisible: boolean;
  showProfilePicture: boolean;
  profilePictureUrl: string;
  profilePictureSize: number;
  profilePictureBgColor: string;
  profilePictureBorderColor: string;
  headerTitleFontStyle: 'normal' | 'italic';
  headerTitleTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  firstNamePlaceholderFontStyle: 'normal' | 'italic';
  firstNamePlaceholderTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  lastNamePlaceholderFontStyle: 'normal' | 'italic';
  lastNamePlaceholderTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
};

type ForgotPasswordTokens = {
  headlineVisible: boolean;
  bgPaddingVisible: boolean;
  borderLine: string;
  bgColor: string;
  titleColor: string;
  cardBgColor: string;
  cardBorderColor: string;
  cardBorderWidth: number;
  cardBorderRadius: number;
  cardPaddingTop: number;
  cardPaddingBottom: number;
  cardPaddingLeft: number;
  cardPaddingRight: number;
  buttonTextColor: string;
  buttonBorderColor: string;
  buttonBorderWidth: number;
  buttonFillColor: string;
  buttonRadius: number;
  buttonPaddingTop: number;
  buttonPaddingBottom: number;
  buttonPaddingLeft: number;
  buttonPaddingRight: number;
  buttonMarginTop: number;
  buttonFontSize: number;
  buttonFontFamily: string;
  buttonFontWeight: string;
  headlineText: string;
  headlineFontSize: number;
  headlineFontFamily: string;
  headlineFontWeight: string;
  headlineFontStyle: 'normal' | 'italic';
  headlineTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  headlineTextTransform: 'none' | 'uppercase';
  headlineTextAlign: string;
  loginLinkMarginTop: number;
  resetPasswordTitle: string;
  resetPasswordTitleColor: string;
  resetPasswordTitleFontSize: number;
  resetPasswordTitleFontFamily: string;
  resetPasswordTitleFontWeight: string;
  resetPasswordTitleMarginTop: number;
  resetPasswordButtonText: string;
  backToLoginText: string;
  emailPlaceholder: string;
  emailPlaceholderColor: string;
  inputTextColor: string;
  inputFontSize: number;
  inputFontFamily: string;
  inputBorderColor: string;
  inputBorderRadius: number;
  inputHeight: number;
  inputPaddingHorizontal: number;
  inputPaddingVertical: number;
  successMessageText: string;
  errorMessageText: string;
  successMessageBgColor: string;
  successMessageTextColor: string;
  errorMessageBgColor: string;
  errorMessageTextColor: string;
  messageFontSize: number;
  messageFontFamily: string;
  messageFontWeight: string;
  messageBorderRadius: number;
  requiredMessage: string;
  invalidEmailMessage: string;
  fields: ForgotPasswordFieldConfig[];
};

// Tokens for the full-screen Reset Password page content, sourced from Builder's
// separate "Reset Password" page (component id `reset_password`) — distinct from
// ForgotPasswordTokens above, which only covers the small "Forgot Password?" link
// shown on the SignIn page (component id `forgot_password`).
export type ResetPasswordTokens = {
  headingVisible: boolean;
  inputVisible: boolean;
  inputPlaceholderVisible: boolean;
  inputBgVisible: boolean;
  buttonVisible: boolean;
  buttonTextVisible: boolean;
  buttonIconVisible: boolean;
  buttonBgVisible: boolean;
  headingText: string;
  descriptionColor: string;
  descriptionFontSize: number;
  descriptionFontFamily: string;
  descriptionFontWeight: string;
  descriptionFontStyle: 'normal' | 'italic';
  descriptionTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  descriptionLineHeight: number;
  descriptionLetterSpacing: number;
  descriptionAlign: 'left' | 'center' | 'right';
  cardBgColor: string;
  cardBorderColor: string;
  cardBorderWidth: number;
  cardBorderRadius: number;
  cardPaddingTop: number;
  cardPaddingBottom: number;
  cardPaddingLeft: number;
  cardPaddingRight: number;
  emailPlaceholder: string;
  emailPlaceholderColor: string;
  emailPlaceholderFontSize: number;
  emailPlaceholderFontFamily: string;
  emailPlaceholderFontWeight: string;
  emailPlaceholderFontStyle: 'normal' | 'italic';
  emailPlaceholderTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  inputTextColor: string;
  inputFontSize: number;
  inputFontFamily: string;
  inputFontWeight: string;
  inputBgColor: string;
  inputBorderColor: string;
  inputBorderRadius: number;
  inputHeight: number;
  inputPaddingHorizontal: number;
  inputPaddingVertical: number;
  buttonText: string;
  buttonTextColor: string;
  buttonBorderColor: string;
  buttonBorderWidth: number;
  buttonFillColor: string;
  buttonRadius: number;
  buttonPaddingTop: number;
  buttonPaddingBottom: number;
  buttonPaddingLeft: number;
  buttonPaddingRight: number;
  buttonMarginTop: number;
  buttonFontSize: number;
  buttonFontFamily: string;
  buttonFontWeight: string;
  buttonFontStyle: 'normal' | 'italic';
  buttonTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  buttonUppercase: boolean;
  buttonIcon: string;
  buttonIconSize: number;
  buttonIconColor: string;
  buttonIconAlign: string;
  successMessageText: string;
  errorMessageText: string;
  successMessageBgColor: string;
  successMessageTextColor: string;
  errorMessageBgColor: string;
  errorMessageTextColor: string;
  messageFontSize: number;
  messageFontFamily: string;
  messageFontWeight: string;
  messageBorderRadius: number;
  requiredMessage: string;
  invalidEmailMessage: string;
};

type AuthFieldKeyboardType =
  | 'default'
  | 'email-address'
  | 'number-pad'
  | 'numeric'
  | 'phone-pad'
  | 'url';

type ForgotPasswordFieldConfig = {
  key: string;
  type: string;
  visible: boolean;
  label: string;
  labelVisible: boolean;
  placeholder: string;
  placeholderVisible: boolean;
  required: boolean;
  requiredMessage: string;
  invalidMessage: string;
  helperText: string;
  helperVisible: boolean;
  keyboardType: AuthFieldKeyboardType;
  autoCapitalize: 'none' | 'words' | 'sentences';
  autoCorrect: boolean;
  secureTextEntry: boolean;
  labelColor?: string;
  labelFontSize?: number;
  labelFontFamily?: string;
  labelFontWeight?: string;
  placeholderColor?: string;
  placeholderFontSize?: number;
  placeholderFontFamily?: string;
  placeholderFontWeight?: string;
  inputColor?: string;
  inputFontSize?: number;
  inputFontFamily?: string;
  inputFontWeight?: string;
  inputAlign?: 'left' | 'center' | 'right';
  inputBorderColor?: string;
  inputBorderRadius?: number;
  inputHeight?: number;
  helperColor?: string;
  helperFontSize?: number;
  helperFontFamily?: string;
  helperFontWeight?: string;
};

type AuthMode = 'login' | 'signup' | 'forgot';

const unwrapValue = <T,>(value: T, fallback: T): T => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'object') {
    if ((value as { value?: T }).value !== undefined) return (value as { value?: T }).value as T;
    if ((value as { const?: T }).const !== undefined) return (value as { const?: T }).const as T;
    if ((value as { properties?: T }).properties !== undefined) {
      return unwrapValue((value as { properties?: T }).properties as T, fallback);
    }
  }
  return value;
};

const toNumber = (value: unknown, fallback: number): number => {
  const resolved = unwrapValue(value as number | null | undefined, fallback);
  const parsed = Number(resolved);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  const resolved = unwrapValue(value as boolean | string | number | null | undefined, fallback);
  if (typeof resolved === 'boolean') return resolved;
  if (typeof resolved === 'number') return resolved !== 0;
  if (typeof resolved === 'string') {
    const normalized = resolved.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
};

const toStringValue = (value: unknown, fallback = ''): string => {
  const resolved = unwrapValue(value as string | null | undefined, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const toRecord = (value: unknown): Record<string, unknown> => {
  const resolved = unwrapValue(value as Record<string, unknown> | null | undefined, undefined as any);
  if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
    return resolved as Record<string, unknown>;
  }
  return {};
};

const firstDefined = (...values: unknown[]): unknown => {
  for (const value of values) {
    const resolved = unwrapValue(value as unknown, undefined as unknown);
    if (resolved !== undefined && resolved !== null && resolved !== '') return resolved;
  }
  return undefined;
};

// Centralized DSL alias resolver: tries each candidate key (in order) against
// rawProps and returns the first defined value. Builder property names have
// drifted across casing/typos over time (e.g. buttonwidth vs buttonWidth,
// emailInputColor vs emailInputTextColor) — this is the single place new
// aliases get registered instead of scattering ad hoc `??` chains.
const pick = (rawProps: Record<string, unknown>, keys: string[]): unknown =>
  firstDefined(...keys.map((key) => rawProps?.[key]));

const toLocalizedString = (value: unknown, fallback = ''): string => {
  const resolved = unwrapValue(value as unknown, undefined as unknown);
  if (resolved === undefined || resolved === null || resolved === '') return fallback;
  if (typeof resolved === 'string' || typeof resolved === 'number' || typeof resolved === 'boolean') {
    return String(resolved);
  }
  if (typeof resolved === 'object' && !Array.isArray(resolved)) {
    const record = resolved as Record<string, unknown>;
    return toLocalizedString(
      firstDefined(
        record.text,
        record.label,
        record.title,
        record.message,
        record.default,
        record.en,
        record.en_US,
        record['en-US']
      ),
      fallback
    );
  }
  return fallback;
};

// Builder's ResetPassword/Preview.tsx renders headingText via dangerouslySetInnerHTML
// (designers can bold/link portions of it); RN's <Text> can't render HTML, so strip
// tags and decode the handful of entities Builder's rich-text toolbar can emit.
const stripHtmlTags = (value: string): string =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

const toFontFamily = (value: unknown, fallback = 'System'): string => {
  const resolved = unwrapValue(value as string | null | undefined, fallback);
  if (typeof resolved !== 'string') return fallback;
  return resolveFont(resolved) ?? fallback;
};

const resolveButtonColor = (value: unknown, fallback: string): string => {
  const resolved = unwrapValue(value as string | null | undefined, fallback);
  if (typeof resolved === 'string' && resolved.trim().startsWith('linear-gradient')) {
    return resolved.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/)?.[0] ?? fallback;
  }
  return resolved ?? fallback;
};

const splitGradientParts = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const resolveButtonGradient = (value: unknown): ButtonGradient | null => {
  const resolved = unwrapValue(value as string | null | undefined, '');
  if (typeof resolved !== 'string' || !resolved.trim().startsWith('linear-gradient')) {
    return null;
  }
  const match = resolved.match(/linear-gradient\((.*)\)/);
  if (!match) return null;
  const parts = splitGradientParts(match[1]);
  const angleMatch = parts[0]?.match(/(-?\d+(?:\.\d+)?)deg/);
  const colors = parts
    .map((part) => part.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/)?.[0])
    .filter((color): color is string => Boolean(color));
  if (colors.length < 2) return null;
  return {
    colors,
    angle: angleMatch ? Number(angleMatch[1]) : 180,
  };
};

const getButtonBgValue = (rawProps: Record<string, unknown>): unknown =>
  firstDefined(
    rawProps?.buttonbgColor,
    rawProps?.buttonBgColor,
    rawProps?.buttonBackgroundColor,
    rawProps?.buttonFillColor,
    rawProps?.buttonColor
  );

const getButtonTextColorValue = (rawProps: Record<string, unknown>): unknown =>
  // Builder's SignIn/SignUp PreviewLive.tsx read ONLY `buttontextColor`
  // (default "#ffffff") for the button label — never `buttonColor`/`textColor`.
  // Falling back to those here let an unrelated text colour bleed into the
  // Sign In button label whenever `buttontextColor` was unset.
  firstDefined(
    rawProps?.buttontextColor,
    rawProps?.buttonTextColor
  );

const getButtonFontSizeValue = (rawProps: Record<string, unknown>): unknown =>
  firstDefined(
    rawProps?.buttonfontSize,
    rawProps?.buttonFontSize,
    rawProps?.buttonTextFontSize,
    rawProps?.fontSize
  );

const getButtonFontFamilyValue = (rawProps: Record<string, unknown>): unknown =>
  firstDefined(
    rawProps?.buttonfontFamily,
    rawProps?.buttonFontFamily,
    rawProps?.buttonTextFontFamily,
    rawProps?.fontFamily
  );

// SignIn's Inspector writes the button weight under the capitalized
// `buttonFontWeight` (its Preview reads that key directly, no lowercase
// variant exists there) — but SignUp's Inspector writes only the lowercase
// `buttonfontWeight`, and liveRegistry.ts seeds `buttonFontWeight: "700"` on
// every signup block regardless of what the merchant sets, so honoring the
// capitalized key for SignUp shows that stale seed instead of the real value.
// This helper is shared by both blocks, so the caller must say whether the
// capitalized key is trustworthy for its block (true for SignIn, false for
// SignUp).
const getButtonFontWeightValue = (rawProps: Record<string, unknown>, trustCapitalized: boolean): unknown =>
  firstDefined(
    rawProps?.buttonfontWeight,
    trustCapitalized ? rawProps?.buttonFontWeight : undefined,
    rawProps?.buttonTextFontWeight,
    rawProps?.fontWeight
  );

const resolveBorderWidth = (line: unknown, color: unknown, fallback: number): number => {
  const rawLine = String(unwrapValue(line as string | null | undefined, '') || '').trim().toLowerCase();
  if (rawLine === 'none' || rawLine === '0' || rawLine === '0px') return 0;
  const numeric = parseFloat(rawLine);
  if (Number.isFinite(numeric)) return numeric;
  if (!rawLine) return 0;
  const rawColor = String(unwrapValue(color as string | null | undefined, '') || '').trim().toLowerCase();
  if (!rawColor || rawColor === 'transparent') return 0;
  return fallback;
};

// Builder's BorderLineControl lets a merchant pick a single side
// (none/left/right/top/bottom/all) rather than always drawing a full
// 4-side border — produces the matching RN per-side border style object.
const borderSideStyleWeb = (
  line: string,
  width: number,
  color: string
): Record<string, number | string> => {
  const w = Math.max(0, width);
  switch (String(line || '').toLowerCase()) {
    case 'none':
      return { borderWidth: 0 };
    case 'top':
      return { borderWidth: 0, borderTopWidth: w, borderColor: color };
    case 'bottom':
      return { borderWidth: 0, borderBottomWidth: w, borderColor: color };
    case 'left':
      return { borderWidth: 0, borderLeftWidth: w, borderColor: color };
    case 'right':
      return { borderWidth: 0, borderRightWidth: w, borderColor: color };
    case 'all':
    default:
      return { borderWidth: w, borderColor: color };
  }
};

const resolveAuthVerticalSpace = (value: number, viewportHeight: number, maxViewportShare: number): number => {
  const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return normalized;
  return Math.round(Math.min(normalized, viewportHeight * maxViewportShare));
};

const withAuthViewport = (section: Record<string, unknown>, viewportHeight: number): Record<string, unknown> => ({
  ...section,
  __authVerticalViewport: viewportHeight,
});

const isForgotPasswordEnabled = (rawProps: Record<string, unknown>): boolean => {
  const visibility = rawProps?.visibility as Record<string, unknown> | undefined;
  return toBoolean(
    firstDefined(
      rawProps?.visible,
      rawProps?.isVisible,
      rawProps?.enabled,
      rawProps?.show,
      rawProps?.showComponent,
      rawProps?.forgotPasswordVisible,
      rawProps?.resetPasswordVisible,
      visibility?.component,
      visibility?.forgotPassword,
      visibility?.resetPassword
    ),
    true
  );
};

const normalizeSectionName = (value: unknown): string =>
  String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const SIGN_IN_COMPONENTS = new Set(['signin', 'sign_in']);
const SIGN_UP_COMPONENTS = new Set(['signup', 'sign_up']);
const FORGOT_PASSWORD_COMPONENTS = new Set(['forgot_password', 'forgotpassword']);
const RESET_PASSWORD_COMPONENTS = new Set(['reset_password', 'resetpassword']);
const AUTH_FORM_COMPONENTS = new Set([
  ...SIGN_IN_COMPONENTS,
  ...SIGN_UP_COMPONENTS,
  ...FORGOT_PASSWORD_COMPONENTS,
  ...RESET_PASSWORD_COMPONENTS,
]);
const AUTH_DECOR_BLOCKED_COMPONENTS = new Set([
  'bottom_navigation',
  'bottom_navigation_style_1',
  'bottom_navigation_style_2',
  'cart_line_items',
  'checkout_button',
  'discount_code',
  'discount_coupons',
  'free_shipping',
  'free_shipping_banner',
  'header',
  'header_2',
  'header_mobile',
  'order_summary',
  'price_line',
  'side_navigation',
]);

const getSectionComponent = (section: Record<string, unknown> | null | undefined): string => {
  const raw = unwrapValue((section?.component ?? (section?.properties as Record<string, unknown>)?.component) as string, '');
  return normalizeSectionName(raw);
};

const isSignInSection = (section: Record<string, unknown> | null | undefined): boolean =>
  SIGN_IN_COMPONENTS.has(getSectionComponent(section));

const isSignUpSection = (section: Record<string, unknown> | null | undefined): boolean =>
  SIGN_UP_COMPONENTS.has(getSectionComponent(section));

const isForgotPasswordSection = (section: Record<string, unknown> | null | undefined): boolean =>
  FORGOT_PASSWORD_COMPONENTS.has(getSectionComponent(section));

const isResetPasswordSection = (section: Record<string, unknown> | null | undefined): boolean =>
  RESET_PASSWORD_COMPONENTS.has(getSectionComponent(section));

const isAllowedAuthDecorSection = (section: Record<string, unknown> | null | undefined): boolean => {
  const component = getSectionComponent(section);
  return !AUTH_FORM_COMPONENTS.has(component) && !AUTH_DECOR_BLOCKED_COMPONENTS.has(component);
};

const isGeneratedFallbackSection = (section: Record<string, unknown> | null | undefined): boolean =>
  Boolean((section as { generatedFallback?: boolean } | null | undefined)?.generatedFallback);

const hasAuthSections = (
  sections: Record<string, unknown>[],
  matcher: (section: Record<string, unknown>) => boolean
): boolean => sections.some((section) => matcher(section));

const buildButtonStyleTokens = (
  rawProps: Record<string, unknown>,
  defaults: Pick<
    SignInTokens,
    'buttonTextColor' | 'buttonFillColor' | 'buttonFontSize' | 'buttonFontFamily' | 'buttonFontWeight'
  >,
  trustCapitalizedFontWeight: boolean = true
) => {
  const bgValue = getButtonBgValue(rawProps);
  return {
    buttonTextColor: (getButtonTextColorValue(rawProps) as string | undefined) ?? defaults.buttonTextColor,
    buttonFillColor: resolveButtonColor(bgValue, defaults.buttonFillColor),
    buttonGradient: resolveButtonGradient(bgValue),
    buttonFontSize: toNumber(getButtonFontSizeValue(rawProps), defaults.buttonFontSize),
    buttonFontFamily: toFontFamily(getButtonFontFamilyValue(rawProps), defaults.buttonFontFamily),
    buttonFontWeight: toFontWeight(getButtonFontWeightValue(rawProps, trustCapitalizedFontWeight), defaults.buttonFontWeight, rawProps?.buttonTextBold as boolean | undefined),
  };
};

const getSectionRawProps = (section: Record<string, unknown> | null | undefined): Record<string, unknown> => {
  const propsNode: Record<string, unknown> =
    ((section?.properties as Record<string, unknown>)?.props as Record<string, unknown>)?.properties as Record<string, unknown> ||
    (section?.properties as Record<string, unknown>)?.props as Record<string, unknown> ||
    section?.props as Record<string, unknown> ||
    {};
  const rawNode = unwrapValue((propsNode as Record<string, unknown>)?.raw, null);
  if (rawNode && typeof rawNode === 'object' && !Array.isArray(rawNode)) {
    return { ...propsNode, ...(rawNode as Record<string, unknown>) };
  }
  return propsNode;
};

// The auth blocks ship teal (#027579 / #0C9297 …) hardcoded defaults. Builder's
// brandKitUtils.ts re-themes those from the merchant's Brand Kit palette (Button
// Fill / Divider / Title Text) whenever the block's own value is still a default;
// the app never did the equivalent, so a black-and-gold app still rendered teal
// buttons, links and input borders. This swaps a still-default teal for the
// matching Brand Kit colour — apps with no Brand Kit palette are untouched.
const AUTH_TEAL_DEFAULTS = new Set([
  '#0c9297', '#027579', '#065f63', '#22b8ad', '#0d9488', '#016d77', '#017176', '#d1e7e7',
]);
const isAuthTealDefault = (v: unknown): boolean =>
  AUTH_TEAL_DEFAULTS.has(String(v ?? '').trim().toLowerCase());

const themeAuthColorTokens = <T extends Record<string, any>>(tokens: T): T => {
  const bk = getBrandColorsSync();
  if (!bk) return tokens;
  const accent: string | undefined = bk.primaryBtn || bk.iconActive || undefined;
  const out: Record<string, any> = { ...tokens };
  const swap = (key: string, ...candidates: (string | undefined)[]) => {
    if (out[key] === undefined || !isAuthTealDefault(out[key])) return;
    const next = candidates.find((c) => typeof c === 'string' && c.trim().length > 0);
    if (next) out[key] = next;
  };
  // Builder's SignIn button fill default is #000000 (not teal); brandKitUtils
  // then swaps it for primaryBtn. Mirror that order.
  swap('buttonFillColor', accent, '#000000');
  swap('buttonBorderColor', bk.btnBorder, accent);
  swap('titleColor', bk.titleText);
  swap('cardBorderColor', bk.divider, bk.btnBorder);
  swap('inputBorderColor', bk.divider, bk.btnBorder);
  swap('footerLinkColor', accent);
  swap('forgotPasswordColor', accent);
  swap('emailLabelColor', bk.titleText);
  swap('passwordLabelColor', bk.titleText);
  swap('firstNameLabelColor', bk.titleText);
  swap('lastNameLabelColor', bk.titleText);
  swap('headerTitleColor', bk.titleText);
  return out as T;
};

const defaultSignInTokens: SignInTokens = {
  emailInputVisible: true,
  passwordInputVisible: true,
  buttonVisible: true,
  iconsVisible: true,
  bgPadVisible: true,
  forgotPasswordText: 'Forgot Password?',
  forgotPasswordColor: '#027579',
  forgotPasswordPt: 12,
  forgotPasswordPb: 0,
  forgotPasswordBold: false,
  forgotPasswordItalic: false,
  forgotPasswordUnderline: false,
  forgotPasswordStrikethrough: false,
  bgColor: '#F3F7F7',
  titleColor: '#065F63',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#D1E7E7',
  cardBorderWidth: 0,
  cardBorderRadius: 0,
  cardPaddingTop: 20,
  cardPaddingBottom: 20,
  cardPaddingLeft: 20,
  cardPaddingRight: 20,
  formGap: 6,
  fieldGap: 14,
  inputPaddingHorizontal: 16,
  inputPaddingVertical: 14,
  formCardMarginBottom: 0,
  buttonMarginTop: 4,
  footerMarginTop: 20,
  footerLinkMarginTop: 6,
  footerInline: false,
  pagePaddingTop: 24,
  pagePaddingBottom: 32,
  pagePaddingLeft: 16,
  pagePaddingRight: 16,
  inputBorderColor: '#027579',
  inputHeight: 58,
  footerTextColor: '#0a0a0a',
  footerLinkColor: '#027579',
  buttonTextColor: '#FFFFFF',
  buttonBorderColor: '#0c9297',
  buttonBorderWidth: 1,
  buttonFillColor: '#0C9297',
  buttonGradient: null,
  buttonPaddingTop: 14,
  buttonPaddingBottom: 14,
  buttonAutoUppercase: false,
  authTitle: 'Authentication',
  buttonText: 'Continue',
  footerText: "Don't have an account?",
  footerLinkText: 'Create an Account',
  emailPlaceholder: 'Enter email',
  passwordPlaceholder: 'Enter password',
  emailPlaceholderVisible: true,
  passwordPlaceholderVisible: true,
  emailLabelText: 'Email',
  passwordLabelText: 'Password',
  emailLabelVisible: false,
  passwordLabelVisible: false,
  emailLabelColor: '#065F63',
  passwordLabelColor: '#065F63',
  emailLabelFontSize: 14,
  passwordLabelFontSize: 14,
  emailLabelFontFamily: 'Inter',
  passwordLabelFontFamily: 'Inter',
  emailLabelFontWeight: '600',
  passwordLabelFontWeight: '600',
  emailInputTextColor: '#0a0a0a',
  passwordInputTextColor: '#0a0a0a',
  emailInputTextFontSize: 16,
  passwordInputTextFontSize: 16,
  emailInputTextFontFamily: 'Inter',
  passwordInputTextFontFamily: 'Inter',
  emailInputTextFontWeight: '500',
  passwordInputTextFontWeight: '500',
  emailPlaceholderColor: '#000000',
  passwordPlaceholderColor: '#000000',
  emailPlaceholderFontSize: 16,
  passwordPlaceholderFontSize: 16,
  emailPlaceholderFontFamily: 'Inter',
  passwordPlaceholderFontFamily: 'Inter',
  emailPlaceholderFontWeight: '500',
  passwordPlaceholderFontWeight: '500',
  buttonFontSize: 22,
  buttonFontFamily: 'Inter',
  buttonFontWeight: '500',
  buttonHeight: 50,
  buttonWidth: 100,
  footerTextFontSize: 14,
  footerTextFontFamily: 'Inter',
  footerTextFontWeight: '400',
  footerLinkFontSize: 16,
  footerLinkFontFamily: 'Inter',
  footerLinkFontWeight: '600',
  // Builder's SignIn/PreviewLive.tsx defaults footerLinkAlignment to "Center"
  // when unset (PreviewLive.tsx:327) — this must match, or every Sign In
  // screen where the merchant never touches the "Create an Account" link's
  // Alignment control renders left-aligned in the app while Builder shows it
  // centered.
  footerLinkAlignment: 'Center',
  footerVisible: true,
  forgotPasswordVisible: false,
  authVisible: true,
  buttonRadius: 10,
  inputBorderRadius: 8,
  headlineSize: 18,
  headlineWeight: '400',
  headlineFontFamily: 'Inter',
  headlineFontStyle: 'normal',
  headlineTextDecoration: 'none',
  subtextSize: 14,
  subtextWeight: '400',
  subtextFontFamily: 'Inter',
  emailPlaceholderFontStyle: 'normal',
  emailPlaceholderTextDecoration: 'none',
  passwordPlaceholderFontStyle: 'normal',
  passwordPlaceholderTextDecoration: 'none',
  buttonTextFontStyle: 'normal',
  buttonTextTextDecoration: 'none',
  footerLinkFontStyle: 'normal',
  footerLinkTextDecoration: 'none',
  footerTextFontStyle: 'normal',
  footerTextTextDecoration: 'none',
  logoVisible: false,
  logoImageUrl: '',
  logoRatio: '1:1',
  logoScale: 'fit',
  logoBgColor: '#E0F7FA',
  logoBorderColor: '#027579',
  logoCorners: 0,
  buttonIcon: '',
  buttonIconSize: 16,
  buttonIconColor: '#FFFFFF',
  buttonIconAlignment: 'Left',
  navigateTo: '',
  selectScreen: '',
};

const defaultForgotPasswordTokens: ForgotPasswordTokens = {
  headlineVisible: true,
  bgPaddingVisible: true,
  borderLine: 'none',
  bgColor: '#FFFFFF',
  // titleColor/headlineText/headlineFontSize/Family/Weight/TextAlign below serve the
  // small "Forgot Password?" LINK shown on the Signin page (Builder's forgot_password
  // block) — kept separate from the full-screen reset form's own text (resetPasswordTitle*).
  titleColor: '#027579',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#D1E7E7',
  cardBorderWidth: 0,
  cardBorderRadius: 0,
  cardPaddingTop: 20,
  cardPaddingBottom: 20,
  cardPaddingLeft: 20,
  cardPaddingRight: 20,
  // Button styling matches Builder's ResetPassword/Preview.tsx hardcoded "Send Reset
  // Link" button (solid fill, white text, no border) — that component barely reads any
  // DSL props for button styling, so these defaults ARE effectively the real spec.
  buttonTextColor: '#FFFFFF',
  buttonBorderColor: '#22B8AD',
  buttonBorderWidth: 0,
  buttonFillColor: '#22B8AD',
  buttonRadius: 6,
  buttonPaddingTop: 15,
  buttonPaddingBottom: 15,
  buttonPaddingLeft: 14,
  buttonPaddingRight: 14,
  buttonMarginTop: 14,
  buttonFontSize: 18,
  buttonFontFamily: 'Inter',
  buttonFontWeight: '500',
  headlineText: 'Forgot Password?',
  headlineFontSize: 18,
  headlineFontFamily: 'Inter',
  headlineFontWeight: '700',
  headlineFontStyle: 'normal',
  headlineTextDecoration: 'none',
  headlineTextTransform: 'none',
  headlineTextAlign: 'Center',
  loginLinkMarginTop: 12,
  // resetPasswordTitle is the full-screen reset form's single subtitle line, matching
  // Builder's ResetPassword/Preview.tsx hardcoded "headingText" default/styling.
  resetPasswordTitle: "Enter your email and we'll send you a password reset link.",
  resetPasswordTitleColor: '#333333',
  resetPasswordTitleFontSize: 18,
  resetPasswordTitleFontFamily: 'Inter',
  resetPasswordTitleFontWeight: '400',
  resetPasswordTitleMarginTop: 0,
  resetPasswordButtonText: 'Send Reset Link',
  backToLoginText: 'Sign in',
  successMessageText: 'If an account exists for this email, a password reset link has been sent.',
  errorMessageText: 'Password reset is temporarily unavailable. Please try again later.',
  successMessageBgColor: '#ECFDF5',
  successMessageTextColor: '#047857',
  errorMessageBgColor: '#FEF2F2',
  errorMessageTextColor: '#DC2626',
  messageFontSize: 13,
  messageFontFamily: 'Inter',
  messageFontWeight: '500',
  messageBorderRadius: 8,
  requiredMessage: 'Email is required.',
  invalidEmailMessage: 'Enter a valid email address.',
  emailPlaceholder: 'you@example.com',
  emailPlaceholderColor: '#9CA3AF',
  inputTextColor: '#111827',
  inputFontSize: 14,
  inputFontFamily: 'Inter',
  inputBorderColor: '#D9DEE5',
  inputBorderRadius: 8,
  inputHeight: 52,
  inputPaddingHorizontal: 16,
  inputPaddingVertical: 0,
  fields: [],
};

// Matches Builder's ResetPassword/Preview.tsx — the ONLY DSL-driven text on that
// page is the description paragraph (headingText/description*); the input and
// button are entirely hardcoded there too (no live Inspector binding reaches the
// canvas), so these defaults ARE the real spec and are never overridden from DSL.
export const defaultResetPasswordTokens: ResetPasswordTokens = {
  headingVisible: true,
  inputVisible: true,
  inputPlaceholderVisible: true,
  inputBgVisible: true,
  buttonVisible: true,
  buttonTextVisible: true,
  buttonIconVisible: true,
  buttonBgVisible: true,
  headingText: "Enter your email and we'll send you a password reset link.",
  descriptionColor: '#333333',
  descriptionFontSize: 18,
  descriptionFontFamily: 'Inter',
  descriptionFontWeight: '400',
  descriptionFontStyle: 'normal',
  descriptionTextDecoration: 'none',
  descriptionLineHeight: 1.5,
  descriptionLetterSpacing: 0,
  descriptionAlign: 'center',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#DDD3D3',
  cardBorderWidth: 0,
  cardBorderRadius: 0,
  cardPaddingTop: 0,
  cardPaddingBottom: 0,
  cardPaddingLeft: 0,
  cardPaddingRight: 0,
  emailPlaceholder: 'you@example.com',
  emailPlaceholderColor: '#9CA3AF',
  emailPlaceholderFontSize: 14,
  emailPlaceholderFontFamily: 'Inter',
  emailPlaceholderFontWeight: '400',
  emailPlaceholderFontStyle: 'normal',
  emailPlaceholderTextDecoration: 'none',
  inputTextColor: '#111827',
  inputFontSize: 14,
  inputFontFamily: 'Inter',
  inputFontWeight: '400',
  inputBgColor: '#FFFFFF',
  inputBorderColor: '#D9DEE5',
  inputBorderRadius: 8,
  inputHeight: 52,
  inputPaddingHorizontal: 16,
  inputPaddingVertical: 0,
  buttonText: 'Send Reset Link',
  buttonTextColor: '#FFFFFF',
  buttonBorderColor: '#22B8AD',
  buttonBorderWidth: 0,
  buttonFillColor: '#22B8AD',
  buttonRadius: 6,
  buttonPaddingTop: 15,
  buttonPaddingBottom: 15,
  buttonPaddingLeft: 14,
  buttonPaddingRight: 14,
  buttonMarginTop: 20,
  buttonFontSize: 18,
  buttonFontFamily: 'Inter',
  buttonFontWeight: '500',
  buttonFontStyle: 'normal',
  buttonTextDecoration: 'none',
  buttonUppercase: false,
  buttonIcon: '',
  buttonIconSize: 16,
  buttonIconColor: '#3B3C40',
  buttonIconAlign: 'right',
  successMessageText: 'If an account exists for this email, a password reset link has been sent.',
  errorMessageText: 'Password reset is temporarily unavailable. Please try again later.',
  successMessageBgColor: '#ECFDF5',
  successMessageTextColor: '#047857',
  errorMessageBgColor: '#FEF2F2',
  errorMessageTextColor: '#DC2626',
  messageFontSize: 13,
  messageFontFamily: 'Inter',
  messageFontWeight: '500',
  messageBorderRadius: 8,
  requiredMessage: 'Email is required.',
  invalidEmailMessage: 'Enter a valid email address.',
};

const defaultSignUpTokens: SignUpTokens = {
  ...defaultSignInTokens,
  bgColor: '#F8FAFA',
  titleColor: '#027579',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#D1E7E7',
  cardBorderWidth: 0,
  cardBorderRadius: 0,
  cardPaddingTop: 20,
  cardPaddingBottom: 20,
  cardPaddingLeft: 20,
  cardPaddingRight: 20,
  formGap: 6,
  fieldGap: 14,
  inputPaddingHorizontal: 16,
  inputPaddingVertical: 14,
  formCardMarginBottom: 0,
  buttonMarginTop: 4,
  footerMarginTop: 20,
  footerLinkMarginTop: 6,
  footerInline: true,
  inputBorderColor: '#027579',
  inputHeight: 58,
  authTitle: 'Create an Account',
  buttonText: 'Create Account',
  footerText: 'Already have an account?',
  footerLinkText: 'Sign in',
  headerTitle: 'Create an Account',
  headerTitleColor: '#065F63',
  headerTitleFontSize: 18,
  headerTitleFontFamily: 'Inter',
  headerTitleFontWeight: '400',
  emailAlignment: 'Left',
  firstNameAlignment: 'Left',
  lastNameAlignment: 'Left',
  passwordAlignment: 'Left',
  emailInputTextAlignment: 'Left',
  firstNameInputTextAlignment: 'Left',
  lastNameInputTextAlignment: 'Left',
  passwordInputTextAlignment: 'Left',
  emailLabelVisible: false,
  firstNameLabelVisible: false,
  lastNameLabelVisible: false,
  passwordLabelVisible: false,
  emailInputVisible: true,
  firstNameVisible: true,
  lastNameVisible: true,
  passwordInputVisible: true,
  emailLabelText: 'Email',
  firstNameLabelText: 'First Name',
  lastNameLabelText: 'Last Name',
  passwordLabelText: 'Password',
  firstNamePlaceholder: 'Enter first name',
  lastNamePlaceholder: 'Enter last name',
  firstNamePlaceholderVisible: true,
  lastNamePlaceholderVisible: true,
  firstNamePlaceholderFontSize: 16,
  lastNamePlaceholderFontSize: 16,
  firstNamePlaceholderFontFamily: 'Inter',
  lastNamePlaceholderFontFamily: 'Inter',
  firstNamePlaceholderFontWeight: '500',
  lastNamePlaceholderFontWeight: '500',
  emailLabelColor: '#374151',
  firstNameLabelColor: '#374151',
  lastNameLabelColor: '#374151',
  passwordLabelColor: '#374151',
  emailLabelFontSize: 13,
  firstNameLabelFontSize: 13,
  lastNameLabelFontSize: 13,
  passwordLabelFontSize: 13,
  emailLabelFontFamily: 'Inter',
  firstNameLabelFontFamily: 'Inter',
  lastNameLabelFontFamily: 'Inter',
  passwordLabelFontFamily: 'Inter',
  emailLabelFontWeight: '600',
  firstNameLabelFontWeight: '600',
  lastNameLabelFontWeight: '600',
  passwordLabelFontWeight: '600',
  emailInputTextColor: '#111827',
  firstNameInputTextColor: '#111827',
  lastNameInputTextColor: '#111827',
  passwordInputTextColor: '#111827',
  emailInputTextFontSize: 16,
  firstNameInputTextFontSize: 16,
  lastNameInputTextFontSize: 16,
  passwordInputTextFontSize: 16,
  emailInputTextFontFamily: 'Inter',
  firstNameInputTextFontFamily: 'Inter',
  lastNameInputTextFontFamily: 'Inter',
  passwordInputTextFontFamily: 'Inter',
  emailInputTextFontWeight: '500',
  firstNameInputTextFontWeight: '500',
  lastNameInputTextFontWeight: '500',
  passwordInputTextFontWeight: '500',
  emailPlaceholderColor: '#000000',
  firstNamePlaceholderColor: '#000000',
  lastNamePlaceholderColor: '#000000',
  passwordPlaceholderColor: '#000000',
  buttonHeight: 50,
  buttonWidth: 100,
  buttonFontSize: 22,
  buttonFontFamily: 'Inter',
  buttonFontWeight: '500',
  footerTextFontSize: 16,
  footerLinkFontSize: 16,
  footerLinkFontFamily: 'Inter',
  footerLinkFontWeight: '500',
  footerLinkAlignment: 'Left',
  footerLinkAutoUppercase: false,
  footerVisible: true,
  signInLinkVisible: true,
  signInLinkTextVisible: true,
  buttonVisible: true,
  buttonIconsVisible: true,
  showProfilePicture: false,
  profilePictureUrl: '',
  profilePictureSize: 72,
  profilePictureBgColor: '#E5F3F4',
  profilePictureBorderColor: '#33B8C4',
  headerTitleFontStyle: 'normal',
  headerTitleTextDecoration: 'none',
  firstNamePlaceholderFontStyle: 'normal',
  firstNamePlaceholderTextDecoration: 'none',
  lastNamePlaceholderFontStyle: 'normal',
  lastNamePlaceholderTextDecoration: 'none',
};

const toFontWeight = (
  value: unknown,
  fallback: string,
  isBold?: boolean
): string => {
  // The explicit Bold flag is the source of truth when true — a separate
  // font-weight string (e.g. "500") must never silently override it.
  if (isBold === true) return '700';
  if (typeof value === 'string' && value.trim()) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'bold') return '700';
    if (normalized === 'normal') return '400';
    if (normalized === 'light') return '300';
    if (normalized === 'medium') return '500';
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (isBold !== undefined) {
    return isBold ? '700' : '400';
  }
  return fallback;
};

const toTextAlign = (
  value: unknown,
  fallback: 'left' | 'center' | 'right' = 'left'
): 'left' | 'center' | 'right' => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'center') return 'center';
    if (normalized === 'right') return 'right';
    if (normalized === 'left') return 'left';
  }
  return fallback;
};

const toFlexAlign = (value: unknown, fallback: 'flex-start' | 'center' | 'flex-end' = 'flex-start') => {
  const align = toTextAlign(value, fallback === 'center' ? 'center' : fallback === 'flex-end' ? 'right' : 'left');
  return align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
};

const toTextDecoration = (
  underline?: boolean,
  strikethrough?: boolean
): ForgotPasswordTokens['headlineTextDecoration'] => {
  if (underline && strikethrough) return 'underline line-through';
  if (underline) return 'underline';
  if (strikethrough) return 'line-through';
  return 'none';
};

const toOptionalNumber = (value: unknown): number | undefined => {
  const resolved = unwrapValue(value as number | string | null | undefined, undefined as any);
  const parsed = Number(resolved);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeForgotPasswordFieldType = (field: Record<string, unknown>, key: string): string => {
  const source = toStringValue(
    firstDefined(field.inputType, field.fieldType, field.format, field.type, key),
    key
  ).toLowerCase();
  const keySource = key.toLowerCase();
  if (source.includes('email') || keySource.includes('email')) return 'email';
  if (source.includes('password') || keySource.includes('password')) return 'password';
  if (source.includes('phone') || source.includes('tel') || keySource.includes('phone')) return 'tel';
  if (source.includes('number') || source.includes('numeric')) return 'number';
  if (source.includes('url')) return 'url';
  return 'text';
};

const getForgotPasswordKeyboardType = (type: string): AuthFieldKeyboardType => {
  if (type === 'email') return 'email-address';
  if (type === 'tel') return 'phone-pad';
  if (type === 'number') return 'numeric';
  if (type === 'url') return 'url';
  return 'default';
};

const getForgotPasswordFieldCandidates = (rawProps: Record<string, unknown>): unknown[] => {
  const directSources = [
    rawProps.fields,
    rawProps.formFields,
    rawProps.inputFields,
    rawProps.inputs,
    rawProps.items,
  ];
  for (const source of directSources) {
    const resolved = unwrapValue(source as unknown, undefined as unknown);
    if (Array.isArray(resolved)) return resolved;
    if (resolved && typeof resolved === 'object') {
      return Object.entries(resolved as Record<string, unknown>).map(([key, value]) => ({
        key,
        ...(toRecord(value)),
      }));
    }
  }

  const namedFields = [
    rawProps.emailField,
    rawProps.emailInput,
    rawProps.resetPasswordEmailField,
    rawProps.recoveryEmailField,
  ].filter((field) => field !== undefined && field !== null);
  return namedFields;
};

const buildForgotPasswordFields = (rawProps: Record<string, unknown>): ForgotPasswordFieldConfig[] =>
  getForgotPasswordFieldCandidates(rawProps)
    .map((field, index) => {
      const fieldRecord =
        typeof field === 'string'
          ? { key: field, label: field, placeholder: field }
          : toRecord(field);
      const validation = toRecord(firstDefined(fieldRecord.validation, fieldRecord.validations, fieldRecord.rules));
      const visibility = toRecord(fieldRecord.visibility);
      const keySeed = toStringValue(
        firstDefined(fieldRecord.key, fieldRecord.id, fieldRecord.name, fieldRecord.fieldName, fieldRecord.handle),
        ''
      );
      const fallbackKey = keySeed || `field_${index + 1}`;
      const key = fallbackKey.trim().replace(/\s+/g, '_').toLowerCase();
      const type = normalizeForgotPasswordFieldType(fieldRecord, key);
      const label = toLocalizedString(
        firstDefined(fieldRecord.label, fieldRecord.labelText, fieldRecord.title, fieldRecord.name),
        ''
      );
      const placeholder = toLocalizedString(
        firstDefined(fieldRecord.placeholder, fieldRecord.placeholderText, fieldRecord.hint, fieldRecord.hintText),
        label
      );
      const required = toBoolean(
        firstDefined(fieldRecord.required, validation.required, validation.isRequired),
        type === 'email'
      );
      const requiredMessage = toLocalizedString(
        firstDefined(
          fieldRecord.requiredMessage,
          validation.requiredMessage,
          validation.emptyMessage,
          rawProps.requiredMessage,
          rawProps.emailRequiredMessage
        ),
        `${label || placeholder || 'This field'} is required.`
      );
      const invalidMessage = toLocalizedString(
        firstDefined(
          fieldRecord.invalidMessage,
          fieldRecord.errorMessage,
          validation.invalidMessage,
          validation.emailMessage,
          validation.patternMessage,
          rawProps.invalidEmailMessage,
          rawProps.emailInvalidMessage
        ),
        type === 'email' ? defaultForgotPasswordTokens.invalidEmailMessage : ''
      );

      return {
        key,
        type,
        visible: toBoolean(firstDefined(fieldRecord.visible, visibility.field, visibility.input), true),
        label,
        labelVisible: toBoolean(firstDefined(fieldRecord.labelVisible, visibility.label), Boolean(label) && !placeholder),
        placeholder,
        placeholderVisible: toBoolean(firstDefined(fieldRecord.placeholderVisible, visibility.placeholder), Boolean(placeholder)),
        required,
        requiredMessage,
        invalidMessage,
        helperText: toLocalizedString(firstDefined(fieldRecord.helperText, fieldRecord.helpText, fieldRecord.description), ''),
        helperVisible: toBoolean(firstDefined(fieldRecord.helperVisible, visibility.helper, visibility.description), true),
        keyboardType: getForgotPasswordKeyboardType(type),
        autoCapitalize: type === 'email' || type === 'url' ? 'none' : 'sentences',
        autoCorrect: type !== 'email' && type !== 'url' && type !== 'password',
        secureTextEntry: type === 'password',
        labelColor: toLocalizedString(fieldRecord.labelColor, '') || undefined,
        labelFontSize: toOptionalNumber(fieldRecord.labelFontSize),
        labelFontFamily: toFontFamily(fieldRecord.labelFontFamily, '') || undefined,
        labelFontWeight: toStringValue(fieldRecord.labelFontWeight, '') || undefined,
        placeholderColor: toLocalizedString(fieldRecord.placeholderColor, '') || undefined,
        placeholderFontSize: toOptionalNumber(fieldRecord.placeholderFontSize),
        placeholderFontFamily: toFontFamily(fieldRecord.placeholderFontFamily, '') || undefined,
        placeholderFontWeight: toStringValue(fieldRecord.placeholderFontWeight, '') || undefined,
        inputColor: toLocalizedString(fieldRecord.inputTextColor ?? fieldRecord.textColor, '') || undefined,
        inputFontSize: toOptionalNumber(fieldRecord.inputFontSize ?? fieldRecord.fontSize),
        inputFontFamily: toFontFamily(fieldRecord.inputFontFamily ?? fieldRecord.fontFamily, '') || undefined,
        inputFontWeight: toStringValue(fieldRecord.inputFontWeight ?? fieldRecord.fontWeight, '') || undefined,
        inputAlign: toTextAlign(fieldRecord.inputAlign ?? fieldRecord.textAlign, 'left'),
        inputBorderColor: toLocalizedString(fieldRecord.inputBorderColor ?? fieldRecord.borderColor, '') || undefined,
        inputBorderRadius: toOptionalNumber(fieldRecord.inputBorderRadius ?? fieldRecord.borderRadius),
        inputHeight: toOptionalNumber(fieldRecord.inputHeight ?? fieldRecord.height),
        helperColor: toLocalizedString(fieldRecord.helperColor ?? fieldRecord.descriptionColor, '') || undefined,
        helperFontSize: toOptionalNumber(fieldRecord.helperFontSize ?? fieldRecord.descriptionFontSize),
        helperFontFamily: toFontFamily(fieldRecord.helperFontFamily ?? fieldRecord.descriptionFontFamily, '') || undefined,
        helperFontWeight: toStringValue(fieldRecord.helperFontWeight ?? fieldRecord.descriptionFontWeight, '') || undefined,
      };
    })
    .filter((field) => field.visible);

const buildSignInTokens = (rawProps: Record<string, unknown>): SignInTokens => themeAuthColorTokens({
  ...defaultSignInTokens,
  bgColor: (rawProps?.bgColor as string) ?? defaultSignInTokens.bgColor,
  titleColor: (rawProps?.titleColor as string) ?? defaultSignInTokens.titleColor,
  cardBgColor: (rawProps?.cardBgColor as string) ?? defaultSignInTokens.cardBgColor,
  // Inspector's live "Border Color" control (Background & Padding section)
  // writes `borderColor`, not `cardBorderColor` (the Authentication section's
  // own Card Background/Border color pickers are commented out/dead) — the
  // chosen color never reached the render without this alias.
  cardBorderColor: (pick(rawProps, ['borderColor', 'cardBorderColor']) as string) ?? defaultSignInTokens.cardBorderColor,
  cardBorderWidth: resolveBorderWidth(rawProps?.borderLine, rawProps?.borderColor ?? rawProps?.cardBorderColor, defaultSignInTokens.cardBorderWidth),
  cardBorderRadius: toNumber(rawProps?.borderRadius, defaultSignInTokens.cardBorderRadius),
  cardPaddingTop: toNumber(rawProps?.pt ?? rawProps?.paddingTop, defaultSignInTokens.cardPaddingTop),
  cardPaddingBottom: toNumber(rawProps?.pb ?? rawProps?.paddingBottom, defaultSignInTokens.cardPaddingBottom),
  cardPaddingLeft: toNumber(rawProps?.pl ?? rawProps?.paddingLeft, defaultSignInTokens.cardPaddingLeft),
  cardPaddingRight: toNumber(rawProps?.pr ?? rawProps?.paddingRight, defaultSignInTokens.cardPaddingRight),
  formGap: toNumber(rawProps?.formGap ?? rawProps?.titleFormGap ?? rawProps?.headerBottomGap, defaultSignInTokens.formGap),
  fieldGap: toNumber(rawProps?.fieldGap ?? rawProps?.inputGap ?? rawProps?.fieldMarginBottom, defaultSignInTokens.fieldGap),
  inputPaddingHorizontal: toNumber(rawProps?.inputPaddingHorizontal ?? rawProps?.inputPx ?? rawProps?.fieldPaddingHorizontal, defaultSignInTokens.inputPaddingHorizontal),
  inputPaddingVertical: toNumber(rawProps?.inputPaddingVertical ?? rawProps?.inputPy ?? rawProps?.fieldPaddingVertical, defaultSignInTokens.inputPaddingVertical),
  formCardMarginBottom: toNumber(rawProps?.formCardMarginBottom ?? rawProps?.cardMarginBottom, defaultSignInTokens.formCardMarginBottom),
  buttonMarginTop: toNumber(rawProps?.buttonMarginTop ?? rawProps?.buttonMt, defaultSignInTokens.buttonMarginTop),
  footerMarginTop: toNumber(rawProps?.footerMarginTop ?? rawProps?.footerMt ?? rawProps?.footerPt, defaultSignInTokens.footerMarginTop),
  footerLinkMarginTop: toNumber(rawProps?.footerLinkMarginTop ?? rawProps?.footerLinkMt ?? rawProps?.signInLinkPt, defaultSignInTokens.footerLinkMarginTop),
  footerInline: toBoolean(rawProps?.footerInline ?? rawProps?.footerSameLine, defaultSignInTokens.footerInline),
  pagePaddingTop: toNumber(rawProps?.subgpt ?? rawProps?.bgpt ?? rawProps?.pagePaddingTop, defaultSignInTokens.pagePaddingTop),
  pagePaddingBottom: toNumber(rawProps?.subgpb ?? rawProps?.bgpb ?? rawProps?.pagePaddingBottom, defaultSignInTokens.pagePaddingBottom),
  pagePaddingLeft: toNumber(rawProps?.subgpl ?? rawProps?.bgpl ?? rawProps?.pagePaddingLeft, defaultSignInTokens.pagePaddingLeft),
  pagePaddingRight: toNumber(rawProps?.subgpr ?? rawProps?.bgpr ?? rawProps?.pagePaddingRight, defaultSignInTokens.pagePaddingRight),
  inputBorderColor: (rawProps?.inputBorderColor as string) ?? defaultSignInTokens.inputBorderColor,
  inputHeight: toNumber(rawProps?.inputHeight ?? rawProps?.fieldHeight, defaultSignInTokens.inputHeight),
  footerTextColor: (rawProps?.footerTextColor as string) ?? defaultSignInTokens.footerTextColor,
  footerLinkColor: (rawProps?.footerLinkColor as string) ?? defaultSignInTokens.footerLinkColor,
  ...buildButtonStyleTokens(rawProps, defaultSignInTokens),
  // SignIn's Inspector reads/writes ONLY buttonborderColor (lowercase "b") —
  // liveRegistry.ts's signin.defaultProps ALSO seeds a capitalized
  // `buttonBorderColor: "#0c9297"` on every new block as boilerplate, but
  // that capitalized key is never read by the Inspector or by
  // PreviewLive.tsx (which defaults buttonborderColor to "#ffffff" when
  // unset) — it's dead seed data from Builder's own rendering perspective.
  // Falling back to it here (as a previous pass did, treating it as "the
  // same drift confirmed in SignUp") made the button render a visible teal
  // border in the app whenever the merchant had never touched the color
  // picker, even though Builder itself shows its own white default in that
  // exact case. Only the lowercase key reflects what Builder actually
  // renders; fall back to Builder's own literal default ("#ffffff") instead
  // of the unrelated seeded value or the app's own default token.
  buttonBorderColor: (rawProps?.buttonborderColor as string) || '#ffffff',
  // Sign In's Inspector has no line-side control for the button border (only
  // a Border Color picker) — Preview always draws a fixed 1px border
  // whenever that color is set (PreviewLive.tsx:820). When the merchant
  // clears/never sets a color, `buttonborderColor` is an empty string —
  // Preview's `border: 1px solid ${buttonborderColor}` becomes invalid CSS
  // with an empty color and the browser silently drops it (no border shown).
  // Always fall back to 0 width when no real (lowercase-key) color is set,
  // so "no border in Builder" means "no border in the app" instead of an
  // unrelated default color/width.
  buttonBorderWidth: rawProps?.buttonborderColor ? 1 : 0,
  buttonPaddingTop: toNumber(rawProps?.buttonPaddingTop, defaultSignInTokens.buttonPaddingTop),
  buttonPaddingBottom: toNumber(rawProps?.buttonPaddingBottom, defaultSignInTokens.buttonPaddingBottom),
  buttonAutoUppercase: (rawProps?.buttonAutoUppercase as boolean) ?? defaultSignInTokens.buttonAutoUppercase,
  authTitle: (rawProps?.authTitle as string) ?? defaultSignInTokens.authTitle,
  buttonText: (rawProps?.buttonText as string) ?? defaultSignInTokens.buttonText,
  footerText: (rawProps?.footerText as string) ?? defaultSignInTokens.footerText,
  footerLinkText: (rawProps?.footerLinkText as string) ?? defaultSignInTokens.footerLinkText,
  emailPlaceholder: (rawProps?.emailPlaceholder as string) ?? defaultSignInTokens.emailPlaceholder,
  passwordPlaceholder: (rawProps?.passwordPlaceholder as string) ?? defaultSignInTokens.passwordPlaceholder,
  emailPlaceholderVisible: toBoolean(rawProps?.emailPlaceHolderVisible ?? rawProps?.emailPlaceholderVisible, defaultSignInTokens.emailPlaceholderVisible),
  passwordPlaceholderVisible: toBoolean(rawProps?.passwordPlaceHolderVisible ?? rawProps?.passwordPlaceholderVisible, defaultSignInTokens.passwordPlaceholderVisible),
  emailLabelText: (rawProps?.emailLabelText as string) ?? defaultSignInTokens.emailLabelText,
  passwordLabelText: (rawProps?.passwordLabelText as string) ?? defaultSignInTokens.passwordLabelText,
  emailLabelVisible: (rawProps?.emailLabelVisible as boolean) ?? defaultSignInTokens.emailLabelVisible,
  passwordLabelVisible: (rawProps?.passwordLabelVisible as boolean) ?? defaultSignInTokens.passwordLabelVisible,
  emailLabelColor: (rawProps?.emailLabelColor as string) ?? defaultSignInTokens.emailLabelColor,
  passwordLabelColor: (rawProps?.passwordLabelColor as string) ?? defaultSignInTokens.passwordLabelColor,
  emailLabelFontSize: toNumber(rawProps?.emailLabelFontSize, defaultSignInTokens.emailLabelFontSize),
  passwordLabelFontSize: toNumber(rawProps?.passwordLabelFontSize, defaultSignInTokens.passwordLabelFontSize),
  emailLabelFontFamily: toFontFamily(rawProps?.emailLabelFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.emailLabelFontFamily),
  passwordLabelFontFamily: toFontFamily(rawProps?.passwordLabelFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.passwordLabelFontFamily),
  emailLabelFontWeight: toFontWeight(rawProps?.emailLabelFontWeight, defaultSignInTokens.emailLabelFontWeight),
  passwordLabelFontWeight: toFontWeight(rawProps?.passwordLabelFontWeight, defaultSignInTokens.passwordLabelFontWeight),
  // Builder's "Input" subsection writes emailInputColor/passInputColor (not
  // emailInputTextColor/passwordInputTextColor) — both spellings accepted.
  emailInputTextColor: (pick(rawProps, ['emailInputTextColor', 'emailInputColor']) as string) ?? defaultSignInTokens.emailInputTextColor,
  passwordInputTextColor: (pick(rawProps, ['passwordInputTextColor', 'passInputColor']) as string) ?? defaultSignInTokens.passwordInputTextColor,
  emailInputTextFontSize: toNumber(pick(rawProps, ['emailInputTextFontSize', 'emailInputFontSize', 'inputFontSize', 'fontSize']), defaultSignInTokens.emailInputTextFontSize),
  passwordInputTextFontSize: toNumber(pick(rawProps, ['passwordInputTextFontSize', 'passInputFontSize', 'inputFontSize', 'fontSize']), defaultSignInTokens.passwordInputTextFontSize),
  emailInputTextFontFamily: toFontFamily(pick(rawProps, ['emailInputTextFontFamily', 'emailInputFontFamily', 'fontFamily']), defaultSignInTokens.emailInputTextFontFamily),
  passwordInputTextFontFamily: toFontFamily(pick(rawProps, ['passwordInputTextFontFamily', 'passInputFontFamily', 'fontFamily']), defaultSignInTokens.passwordInputTextFontFamily),
  emailInputTextFontWeight: toFontWeight(pick(rawProps, ['emailInputTextFontWeight', 'emailInputFontWeight', 'fontWeight']), defaultSignInTokens.emailInputTextFontWeight),
  passwordInputTextFontWeight: toFontWeight(pick(rawProps, ['passwordInputTextFontWeight', 'passInputFontWeight', 'fontWeight']), defaultSignInTokens.passwordInputTextFontWeight),
  emailPlaceholderColor: (rawProps?.emailPlaceholderColor as string) ?? defaultSignInTokens.emailPlaceholderColor,
  passwordPlaceholderColor: (rawProps?.passwordPlaceholderColor as string) ?? defaultSignInTokens.passwordPlaceholderColor,
  emailPlaceholderFontSize: toNumber(rawProps?.emailPlaceholderFontSize ?? rawProps?.placeholderFontSize ?? rawProps?.fontSize, defaultSignInTokens.emailPlaceholderFontSize),
  passwordPlaceholderFontSize: toNumber(rawProps?.passwordPlaceholderFontSize ?? rawProps?.placeholderFontSize ?? rawProps?.fontSize, defaultSignInTokens.passwordPlaceholderFontSize),
  emailPlaceholderFontFamily: toFontFamily(rawProps?.emailPlaceholderFontFamily ?? rawProps?.placeholderFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.emailPlaceholderFontFamily),
  passwordPlaceholderFontFamily: toFontFamily(rawProps?.passwordPlaceholderFontFamily ?? rawProps?.placeholderFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.passwordPlaceholderFontFamily),
  // Builder's Format toolbar (Bold/Italic/Underline/Strike) and its separate
  // Weight slider both write independently — clicking Bold once and later only
  // ever touching the slider leaves a stale emailPlaceholderBold/
  // passwordPlaceholderBold flag sitting true alongside a non-700 numeric
  // weight. Forcing 700 whenever that stale flag is true made the weight look
  // hard-coded/stuck instead of tracking the slider. Trust the resolved
  // numeric weight only — no bold override.
  emailPlaceholderFontWeight: toFontWeight(rawProps?.emailPlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignInTokens.emailPlaceholderFontWeight),
  passwordPlaceholderFontWeight: toFontWeight(rawProps?.passwordPlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignInTokens.passwordPlaceholderFontWeight),
  buttonHeight: toNumber(rawProps?.buttonHeight, defaultSignInTokens.buttonHeight),
  buttonWidth: toNumber(rawProps?.buttonWidth, defaultSignInTokens.buttonWidth),
  footerTextFontSize: toNumber(rawProps?.footerTextFontSize ?? rawProps?.subtextSize ?? rawProps?.fontSize, defaultSignInTokens.footerTextFontSize),
  footerTextFontFamily: toFontFamily(rawProps?.footerTextFontFamily ?? rawProps?.subtextFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.footerTextFontFamily),
  footerTextFontWeight: toFontWeight(rawProps?.footerTextFontWeight ?? rawProps?.subtextWeight ?? rawProps?.fontWeight, defaultSignInTokens.footerTextFontWeight, rawProps?.footerTextBold as boolean | undefined),
  footerLinkFontSize: toNumber(rawProps?.footerLinkFontSize, defaultSignInTokens.footerLinkFontSize),
  footerLinkFontFamily: toFontFamily(rawProps?.footerLinkFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.footerLinkFontFamily),
  footerLinkFontWeight: toFontWeight(rawProps?.footerLinkFontWeight, defaultSignInTokens.footerLinkFontWeight, rawProps?.footerLinkTextBold as boolean | undefined),
  footerLinkAlignment: (rawProps?.footerLinkAlignment as string) ?? defaultSignInTokens.footerLinkAlignment,
  // Inspector's footer section writes createAccountLinkVisible (whole
  // section) and textVisible (its nested "Text" sub-toggle) — `footerVisible`
  // is a key nothing ever writes, so this was permanently stuck at its
  // default `true` regardless of either real toggle.
  footerVisible:
    toBoolean(rawProps?.createAccountLinkVisible, defaultSignInTokens.footerVisible) &&
    toBoolean(rawProps?.textVisible, true),
  // The embedded case (a Forgot Password block dragged onto the Sign In
  // block) toggles via `showForgotPassword`, written by AppNavigation.tsx —
  // `forgotPasswordVisible` alone is never set by that flow.
  forgotPasswordVisible: toBoolean(rawProps?.showForgotPassword ?? rawProps?.forgotPasswordVisible, defaultSignInTokens.forgotPasswordVisible),
  authVisible: toBoolean(rawProps?.authVisible, defaultSignInTokens.authVisible),
  emailInputVisible: toBoolean(rawProps?.emailInputVisible, defaultSignInTokens.emailInputVisible),
  passwordInputVisible: toBoolean(rawProps?.passwordInputVisible, defaultSignInTokens.passwordInputVisible),
  buttonVisible: toBoolean(rawProps?.buttonVisible, defaultSignInTokens.buttonVisible),
  iconsVisible: toBoolean(rawProps?.iconsVisible, defaultSignInTokens.iconsVisible),
  bgPadVisible: toBoolean(rawProps?.bgPadVisible, defaultSignInTokens.bgPadVisible),
  // Sign In has no dedicated Inspector UI for the "Forgot Password" link —
  // when a Forgot Password block is dragged onto the Sign In block in
  // Builder, these fields get written directly onto the Sign In section's
  // OWN props (see AppNavigation.tsx), not a separate forgot_password DSL
  // section. Reading them here lets the embedded case work even when no
  // standalone forgot_password section exists.
  forgotPasswordText: toLocalizedString(rawProps?.forgotPasswordText, defaultSignInTokens.forgotPasswordText),
  forgotPasswordColor: (rawProps?.forgotPasswordColor as string) ?? defaultSignInTokens.forgotPasswordColor,
  forgotPasswordPt: toNumber(rawProps?.forgotPasswordPt, defaultSignInTokens.forgotPasswordPt),
  forgotPasswordPb: toNumber(rawProps?.forgotPasswordPb, defaultSignInTokens.forgotPasswordPb),
  forgotPasswordBold: toBoolean(rawProps?.forgotPasswordBold, defaultSignInTokens.forgotPasswordBold),
  forgotPasswordItalic: toBoolean(rawProps?.forgotPasswordItalic, defaultSignInTokens.forgotPasswordItalic),
  forgotPasswordUnderline: toBoolean(rawProps?.forgotPasswordUnderline, defaultSignInTokens.forgotPasswordUnderline),
  forgotPasswordStrikethrough: toBoolean(rawProps?.forgotPasswordStrikethrough, defaultSignInTokens.forgotPasswordStrikethrough),
  buttonRadius: toNumber(rawProps?.buttonRadius ?? rawProps?.buttonBorderRadius, defaultSignInTokens.buttonRadius),
  // NOTE: `borderRadius` is the card's corner-radius field (see cardBorderRadius
  // above) — Builder's SignIn/PreviewLive.tsx renders the input radius as a flat
  // hardcoded 8px, completely independent of the card radius, so it must NOT be
  // aliased here. inputRadius/inputBorderRadius are kept for forward-compat but
  // Builder currently has no live control that writes either.
  inputBorderRadius: toNumber(rawProps?.inputRadius ?? rawProps?.inputBorderRadius, defaultSignInTokens.inputBorderRadius),
  headlineSize: toNumber(rawProps?.headlineSize, defaultSignInTokens.headlineSize),
  // authTitleBold (from Builder's rich-text title editor) overrides weight when
  // no explicit headlineWeight is set (Builder never writes headlineWeight itself).
  headlineWeight: toFontWeight(rawProps?.headlineWeight, defaultSignInTokens.headlineWeight, rawProps?.authTitleBold as boolean | undefined),
  headlineFontFamily: toFontFamily(rawProps?.headlineFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.headlineFontFamily),
  headlineFontStyle: toBoolean(rawProps?.authTitleItalic, false) ? 'italic' : 'normal',
  headlineTextDecoration: toTextDecoration(toBoolean(rawProps?.authTitleUnderline, false), toBoolean(rawProps?.authTitleStrikethrough, false)),
  subtextSize: toNumber(rawProps?.subtextSize, defaultSignInTokens.subtextSize),
  subtextWeight: toFontWeight(rawProps?.subtextWeight, defaultSignInTokens.subtextWeight),
  subtextFontFamily: toFontFamily(rawProps?.subtextFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.subtextFontFamily),
  emailPlaceholderFontStyle: toBoolean(rawProps?.emailPlaceholderItalic, false) ? 'italic' : 'normal',
  emailPlaceholderTextDecoration: toTextDecoration(toBoolean(rawProps?.emailPlaceholderUnderline, false), toBoolean(rawProps?.emailPlaceholderStrikethrough, false)),
  passwordPlaceholderFontStyle: toBoolean(rawProps?.passwordPlaceholderItalic, false) ? 'italic' : 'normal',
  passwordPlaceholderTextDecoration: toTextDecoration(toBoolean(rawProps?.passwordPlaceholderUnderline, false), toBoolean(rawProps?.passwordPlaceholderStrikethrough, false)),
  buttonTextFontStyle: toBoolean(rawProps?.buttonTextItalic, false) ? 'italic' : 'normal',
  buttonTextTextDecoration: toTextDecoration(toBoolean(rawProps?.buttonTextUnderline, false), toBoolean(rawProps?.buttonTextStrikethrough, false)),
  footerLinkFontStyle: toBoolean(rawProps?.footerLinkTextItalic, false) ? 'italic' : 'normal',
  footerLinkTextDecoration: toTextDecoration(toBoolean(rawProps?.footerLinkTextUnderline, false), toBoolean(rawProps?.footerLinkTextStrikethrough, false)),
  footerTextFontStyle: toBoolean(rawProps?.footerTextItalic, false) ? 'italic' : 'normal',
  // Builder's "Text" section writes footerTextAccountStrikethrough (irregular
  // name) rather than footerTextStrikethrough for this specific toggle.
  footerTextTextDecoration: toTextDecoration(toBoolean(rawProps?.footerTextUnderline, false), toBoolean(rawProps?.footerTextAccountStrikethrough, false)),
  logoVisible: toBoolean(rawProps?.logoVisible, defaultSignInTokens.logoVisible),
  logoImageUrl: (rawProps?.logoImage as string) ?? defaultSignInTokens.logoImageUrl,
  logoRatio: (rawProps?.imageRatio as string) ?? defaultSignInTokens.logoRatio,
  logoScale: (rawProps?.imageScale as string) ?? defaultSignInTokens.logoScale,
  logoBgColor: (rawProps?.imageBgColor as string) ?? defaultSignInTokens.logoBgColor,
  logoBorderColor: (rawProps?.imageBorderColor as string) ?? defaultSignInTokens.logoBorderColor,
  logoCorners: toNumber(rawProps?.imageCorners, defaultSignInTokens.logoCorners),
  buttonIcon: (rawProps?.buttonIcon as string) ?? defaultSignInTokens.buttonIcon,
  buttonIconSize: toNumber(rawProps?.buttonIconSize, defaultSignInTokens.buttonIconSize),
  buttonIconColor: (rawProps?.buttonIconColor as string) ?? defaultSignInTokens.buttonIconColor,
  buttonIconAlignment: (rawProps?.buttonIconAlignment as string) ?? defaultSignInTokens.buttonIconAlignment,
  navigateTo: (rawProps?.navigateTo as string) ?? defaultSignInTokens.navigateTo,
  selectScreen: (rawProps?.selectScreen as string) ?? defaultSignInTokens.selectScreen,
});

const buildForgotPasswordTokens = (rawProps: Record<string, unknown>): ForgotPasswordTokens => themeAuthColorTokens({
  ...defaultForgotPasswordTokens,
  // Headline (InspectorLive.tsx:179) and Background & Padding
  // (InspectorLive.tsx:456) each have their own independent eye toggle —
  // neither was previously read at all, so turning either off in Builder
  // had zero effect on the APK.
  headlineVisible: toBoolean(rawProps?.headlineVisible, defaultForgotPasswordTokens.headlineVisible),
  bgPaddingVisible: toBoolean(rawProps?.bgPaddingVisible, defaultForgotPasswordTokens.bgPaddingVisible),
  borderLine: toStringValue(rawProps?.borderLine, defaultForgotPasswordTokens.borderLine).toLowerCase(),
  bgColor: toLocalizedString(rawProps?.bgColor ?? rawProps?.backgroundColor, defaultForgotPasswordTokens.bgColor),
  titleColor: toLocalizedString(
    firstDefined(rawProps?.headlineColor, rawProps?.titleColor),
    defaultForgotPasswordTokens.titleColor
  ),
  cardBgColor: toLocalizedString(rawProps?.cardBgColor, defaultForgotPasswordTokens.cardBgColor),
  cardBorderColor: toLocalizedString(rawProps?.borderColor ?? rawProps?.cardBorderColor, defaultForgotPasswordTokens.cardBorderColor),
  cardBorderWidth: resolveBorderWidth(rawProps?.borderLine, rawProps?.borderColor ?? rawProps?.cardBorderColor, defaultForgotPasswordTokens.cardBorderWidth),
  // Real Inspector key is "borderCorners" (InspectorLive.tsx:529) — the
  // never-editable "borderRadius" key was always a static, unwritten value.
  cardBorderRadius: toNumber(rawProps?.borderCorners ?? rawProps?.borderRadius, defaultForgotPasswordTokens.cardBorderRadius),
  cardPaddingTop: toNumber(rawProps?.pt ?? rawProps?.paddingTop, defaultForgotPasswordTokens.cardPaddingTop),
  cardPaddingBottom: toNumber(rawProps?.pb ?? rawProps?.paddingBottom, defaultForgotPasswordTokens.cardPaddingBottom),
  cardPaddingLeft: toNumber(rawProps?.pl ?? rawProps?.paddingLeft, defaultForgotPasswordTokens.cardPaddingLeft),
  cardPaddingRight: toNumber(rawProps?.pr ?? rawProps?.paddingRight, defaultForgotPasswordTokens.cardPaddingRight),
  // Builder's forgot_password Inspector has NO button controls at all (only
  // Headline + Background/Padding) — any buttonXxx/resetPasswordButtonText keys
  // occasionally present in older stored sections are orphaned/legacy leftovers
  // from a prior schema version with no UI to edit or clear them. Deliberately
  // NOT reading them keeps this screen matching the current, real Builder spec
  // (ResetPassword/Preview.tsx's hardcoded "Send Reset Link" button) instead of
  // stale data. Only genuinely-editable Inspector fields (bg/padding/border,
  // headline text+color+font) are read from rawProps above/below.
  buttonTextColor: defaultForgotPasswordTokens.buttonTextColor,
  buttonBorderColor: defaultForgotPasswordTokens.buttonBorderColor,
  buttonBorderWidth: defaultForgotPasswordTokens.buttonBorderWidth,
  buttonFillColor: defaultForgotPasswordTokens.buttonFillColor,
  buttonRadius: defaultForgotPasswordTokens.buttonRadius,
  buttonPaddingTop: defaultForgotPasswordTokens.buttonPaddingTop,
  buttonPaddingBottom: defaultForgotPasswordTokens.buttonPaddingBottom,
  buttonPaddingLeft: defaultForgotPasswordTokens.buttonPaddingLeft,
  buttonPaddingRight: defaultForgotPasswordTokens.buttonPaddingRight,
  buttonMarginTop: toNumber(rawProps?.buttonMarginTop ?? rawProps?.buttonMt, defaultForgotPasswordTokens.buttonMarginTop),
  buttonFontSize: defaultForgotPasswordTokens.buttonFontSize,
  buttonFontFamily: defaultForgotPasswordTokens.buttonFontFamily,
  buttonFontWeight: defaultForgotPasswordTokens.buttonFontWeight,
  headlineText: toLocalizedString(
    firstDefined(rawProps?.headlineText, rawProps?.title, rawProps?.heading),
    defaultForgotPasswordTokens.headlineText
  ),
  headlineFontSize: toNumber(rawProps?.headlineFontSize, defaultForgotPasswordTokens.headlineFontSize),
  headlineFontFamily: toFontFamily(rawProps?.headlineFontFamily ?? rawProps?.fontFamily, defaultForgotPasswordTokens.headlineFontFamily),
  headlineFontWeight: toFontWeight(rawProps?.headlineFontWeight, defaultForgotPasswordTokens.headlineFontWeight, rawProps?.headlineBold as boolean | undefined),
  headlineFontStyle: (rawProps?.headlineItalic as boolean | undefined) ? 'italic' : 'normal',
  headlineTextDecoration: toTextDecoration(rawProps?.headlineUnderline as boolean | undefined, rawProps?.headlineStrikethrough as boolean | undefined),
  headlineTextTransform: (rawProps?.headlineAutoUppercase as boolean | undefined) ? 'uppercase' : 'none',
  headlineTextAlign:
    toStringValue(
      firstDefined(rawProps?.headlineAlign, rawProps?.headtextAlign, rawProps?.titleAlign, rawProps?.textAlign),
      defaultForgotPasswordTokens.headlineTextAlign
    ),
  loginLinkMarginTop: toNumber(
    rawProps?.loginLinkMarginTop ??
      rawProps?.forgotPasswordMarginTop ??
      rawProps?.cardMarginTop ??
      rawProps?.mt ??
      rawProps?.pt ??
      rawProps?.paddingTop,
    defaultForgotPasswordTokens.loginLinkMarginTop
  ),
  // Builder's real ResetPassword component reads this subtitle as headingText/
  // descriptionColor/descriptionFontSize/descriptionFontFamily/descriptionFontWeight.
  // forgot_password's Inspector has no separate subtitle/description field or
  // button field (only Headline + Background/Padding) — resetPasswordTitle/
  // resetPasswordButtonText are legacy leftover keys with no live UI to edit
  // them, so they're intentionally NOT read from rawProps (avoids surfacing
  // stale content). The single real heading is headlineText, read below.
  resetPasswordTitle: defaultForgotPasswordTokens.resetPasswordTitle,
  resetPasswordTitleColor: defaultForgotPasswordTokens.resetPasswordTitleColor,
  resetPasswordTitleFontSize: defaultForgotPasswordTokens.resetPasswordTitleFontSize,
  resetPasswordTitleFontFamily: defaultForgotPasswordTokens.resetPasswordTitleFontFamily,
  resetPasswordTitleFontWeight: defaultForgotPasswordTokens.resetPasswordTitleFontWeight,
  resetPasswordTitleMarginTop: defaultForgotPasswordTokens.resetPasswordTitleMarginTop,
  resetPasswordButtonText: defaultForgotPasswordTokens.resetPasswordButtonText,
  emailPlaceholder: toLocalizedString(firstDefined(rawProps?.emailPlaceholder, rawProps?.placeholder), defaultForgotPasswordTokens.emailPlaceholder),
  emailPlaceholderColor: toLocalizedString(rawProps?.emailPlaceholderColor, defaultForgotPasswordTokens.emailPlaceholderColor),
  inputTextColor: toLocalizedString(rawProps?.inputTextColor, defaultForgotPasswordTokens.inputTextColor),
  inputFontSize: toNumber(rawProps?.inputFontSize, defaultForgotPasswordTokens.inputFontSize),
  inputFontFamily: toFontFamily(rawProps?.inputFontFamily, defaultForgotPasswordTokens.inputFontFamily),
  inputBorderColor: toLocalizedString(rawProps?.inputBorderColor, defaultForgotPasswordTokens.inputBorderColor),
  inputBorderRadius: toNumber(rawProps?.inputBorderRadius, defaultForgotPasswordTokens.inputBorderRadius),
  inputHeight: toNumber(rawProps?.inputHeight, defaultForgotPasswordTokens.inputHeight),
  inputPaddingHorizontal: toNumber(rawProps?.inputPaddingHorizontal, defaultForgotPasswordTokens.inputPaddingHorizontal),
  inputPaddingVertical: toNumber(rawProps?.inputPaddingVertical, defaultForgotPasswordTokens.inputPaddingVertical),
  backToLoginText: toLocalizedString(
    firstDefined(rawProps?.backToLoginText, rawProps?.loginText, rawProps?.signInText),
    defaultForgotPasswordTokens.backToLoginText
  ),
  successMessageText: toLocalizedString(
    firstDefined(rawProps?.successMessageText, rawProps?.resetPasswordSuccessMessage, rawProps?.successText, rawProps?.successMessage),
    defaultForgotPasswordTokens.successMessageText
  ),
  errorMessageText: toLocalizedString(
    firstDefined(rawProps?.errorMessageText, rawProps?.resetPasswordErrorMessage, rawProps?.unavailableMessageText, rawProps?.errorMessage),
    defaultForgotPasswordTokens.errorMessageText
  ),
  successMessageBgColor: toLocalizedString(rawProps?.successMessageBgColor ?? rawProps?.successBgColor, defaultForgotPasswordTokens.successMessageBgColor),
  successMessageTextColor: toLocalizedString(rawProps?.successMessageTextColor ?? rawProps?.successColor, defaultForgotPasswordTokens.successMessageTextColor),
  errorMessageBgColor: toLocalizedString(rawProps?.errorMessageBgColor ?? rawProps?.errorBgColor, defaultForgotPasswordTokens.errorMessageBgColor),
  errorMessageTextColor: toLocalizedString(rawProps?.errorMessageTextColor ?? rawProps?.errorColor, defaultForgotPasswordTokens.errorMessageTextColor),
  messageFontSize: toNumber(rawProps?.messageFontSize ?? rawProps?.feedbackFontSize, defaultForgotPasswordTokens.messageFontSize),
  messageFontFamily: toFontFamily(rawProps?.messageFontFamily ?? rawProps?.fontFamily, defaultForgotPasswordTokens.messageFontFamily),
  messageFontWeight: toFontWeight(rawProps?.messageFontWeight ?? rawProps?.fontWeight, defaultForgotPasswordTokens.messageFontWeight),
  messageBorderRadius: toNumber(rawProps?.messageBorderRadius ?? rawProps?.feedbackBorderRadius, defaultForgotPasswordTokens.messageBorderRadius),
  requiredMessage: toLocalizedString(
    firstDefined(rawProps?.requiredMessage, rawProps?.emailRequiredMessage, rawProps?.validationRequiredMessage),
    defaultForgotPasswordTokens.requiredMessage
  ),
  invalidEmailMessage: toLocalizedString(
    firstDefined(rawProps?.invalidEmailMessage, rawProps?.emailInvalidMessage, rawProps?.validationEmailMessage),
    defaultForgotPasswordTokens.invalidEmailMessage
  ),
  fields: buildForgotPasswordFields(rawProps),
});

// When a "Forgot Password" block is dragged onto the Sign In block in
// Builder, its text/color/spacing/format fields (forgotPasswordText,
// forgotPasswordColor, forgotPasswordPt/Pb, forgotPasswordBold/Italic/
// Underline/Strikethrough) get written directly onto the Sign In section's
// OWN props (see AppNavigation.tsx) rather than becoming a separate
// forgot_password DSL section — this is the common case in practice. Builds
// a ForgotPasswordTokens-shaped object from those embedded fields so the
// same render path can be reused; there's no separate box/background
// control in this embedded variant, so the box styling stays off.
const buildEmbeddedForgotPasswordTokens = (signInRawProps: Record<string, unknown>): ForgotPasswordTokens => themeAuthColorTokens({
  ...defaultForgotPasswordTokens,
  headlineVisible: true,
  bgPaddingVisible: false,
  headlineText: toLocalizedString(signInRawProps?.forgotPasswordText, defaultForgotPasswordTokens.headlineText),
  titleColor: (signInRawProps?.forgotPasswordColor as string) ?? defaultForgotPasswordTokens.titleColor,
  headlineFontWeight: toFontWeight(undefined, defaultForgotPasswordTokens.headlineFontWeight, signInRawProps?.forgotPasswordBold as boolean | undefined),
  headlineFontStyle: (signInRawProps?.forgotPasswordItalic as boolean | undefined) ? 'italic' : 'normal',
  headlineTextDecoration: toTextDecoration(signInRawProps?.forgotPasswordUnderline as boolean | undefined, signInRawProps?.forgotPasswordStrikethrough as boolean | undefined),
  loginLinkMarginTop: toNumber(signInRawProps?.forgotPasswordPt, defaultForgotPasswordTokens.loginLinkMarginTop),
});

// Reads Builder's real "Reset Password" page component (`reset_password`). Its
// background/border/padding controls are nested under `buyNow`/`addToCart` (a
// schema borrowed from the AddToCart block) rather than the flat pt/pb/pl/pr keys
// used elsewhere in this file — confirmed by reading ResetPassword/Preview.tsx and
// Inspector.tsx directly. Button styling (buttonText/Bold/Italic/Underline/
// Strikethrough/FontSize/FontFamily/Color) is now read from rawProps too —
// Builder's own canvas used to ignore those Inspector fields and render a
// static button, but that was fixed on the builder side, so the app must match.
export const buildResetPasswordTokens = (rawProps: Record<string, unknown>): ResetPasswordTokens => {
  const buyNow = toRecord(rawProps?.buyNow);
  const addToCart = toRecord(rawProps?.addToCart);
  const visibility = toRecord(rawProps?.visibility);
  const showBgSection = toBoolean(firstDefined(visibility?.buyNowBgPadding), true);
  const showInputBgSection = toBoolean(firstDefined(visibility?.inputBg), true);
  // `title` is deliberately excluded from this chain: liveRegistry.ts seeds a
  // registry-default `title` on every reset_password block, which would always
  // shadow the RN default below before the merchant ever touches the Text field.
  const heading = stripHtmlTags(
    toLocalizedString(
      firstDefined(rawProps?.headingText, rawProps?.heading),
      defaultResetPasswordTokens.headingText
    )
  );
  return {
    ...defaultResetPasswordTokens,
    // Inspector's VIS_DEFAULT toggles (Inspector.tsx:142-149) — only
    // visibility.buyNowBgPadding was previously read; the other 5 (heading,
    // inputBg, button, buttonIcon, buttonBg) had no reader at all.
    headingVisible: toBoolean(firstDefined(visibility?.heading), defaultResetPasswordTokens.headingVisible),
    inputVisible: toBoolean(firstDefined(visibility?.input), defaultResetPasswordTokens.inputVisible),
    inputPlaceholderVisible: toBoolean(firstDefined(visibility?.inputPlaceholder), defaultResetPasswordTokens.inputPlaceholderVisible),
    inputBgVisible: toBoolean(firstDefined(visibility?.inputBg), defaultResetPasswordTokens.inputBgVisible),
    buttonVisible: toBoolean(firstDefined(visibility?.button), defaultResetPasswordTokens.buttonVisible),
    buttonTextVisible: toBoolean(firstDefined(visibility?.buttonText), defaultResetPasswordTokens.buttonTextVisible),
    buttonIconVisible: toBoolean(firstDefined(visibility?.buttonIcon), defaultResetPasswordTokens.buttonIconVisible),
    buttonBgVisible: toBoolean(firstDefined(visibility?.buttonBg), defaultResetPasswordTokens.buttonBgVisible),
    headingText: heading || defaultResetPasswordTokens.headingText,
    descriptionColor: toLocalizedString(rawProps?.descriptionColor, defaultResetPasswordTokens.descriptionColor),
    descriptionFontSize: toNumber(rawProps?.descriptionFontSize, defaultResetPasswordTokens.descriptionFontSize),
    descriptionFontFamily: toFontFamily(rawProps?.descriptionFontFamily, defaultResetPasswordTokens.descriptionFontFamily),
    descriptionFontWeight: toBoolean(rawProps?.headingBold, false)
      ? '700'
      : toFontWeight(rawProps?.descriptionFontWeight, defaultResetPasswordTokens.descriptionFontWeight),
    descriptionFontStyle: toBoolean(rawProps?.headingItalic, false) ? 'italic' : 'normal',
    descriptionTextDecoration: toTextDecoration(
      toBoolean(rawProps?.headingUnderline, false),
      toBoolean(rawProps?.headingStrikethrough, false)
    ),
    descriptionLineHeight: toNumber(rawProps?.descriptionLineHeight, defaultResetPasswordTokens.descriptionLineHeight),
    descriptionLetterSpacing: toNumber(rawProps?.descriptionLetterSpacing, defaultResetPasswordTokens.descriptionLetterSpacing),
    descriptionAlign: toTextAlign(rawProps?.descriptionAlign, defaultResetPasswordTokens.descriptionAlign),
    cardBgColor: showBgSection ? toLocalizedString(buyNow?.bgColor, defaultResetPasswordTokens.cardBgColor) : 'transparent',
    cardBorderColor: toLocalizedString(buyNow?.borderColor, defaultResetPasswordTokens.cardBorderColor),
    // buyNow.borderLine's real values are the words "left/right/top/bottom/
    // all/none" (BorderLineControl), never a numeric pixel string —
    // resolveBorderWidth's non-numeric branch was falling through to the
    // token's own "off" default (0), so a border never actually rendered
    // even with a side/color explicitly chosen. Preview always draws 1px
    // solid when a border is on, so pass that literal as the fallback.
    cardBorderWidth: showBgSection
      ? resolveBorderWidth(buyNow?.borderLine, buyNow?.borderColor, 1)
      : 0,
    // Inspector's Container Background & Padding now writes buyNow.borderRadius
    // (moved from addToCart.contBorderRadius so every field in this group
    // lives under the same parent) — addToCart kept as a fallback for
    // already-saved pages using the old key.
    cardBorderRadius: showBgSection ? toNumber(firstDefined(buyNow?.borderRadius, addToCart?.contBorderRadius), defaultResetPasswordTokens.cardBorderRadius) : 0,
    cardPaddingTop: showBgSection ? toNumber(buyNow?.pt, defaultResetPasswordTokens.cardPaddingTop) : 0,
    cardPaddingBottom: showBgSection ? toNumber(buyNow?.pb, defaultResetPasswordTokens.cardPaddingBottom) : 0,
    cardPaddingLeft: showBgSection ? toNumber(buyNow?.pl, defaultResetPasswordTokens.cardPaddingLeft) : 0,
    cardPaddingRight: showBgSection ? toNumber(buyNow?.pr, defaultResetPasswordTokens.cardPaddingRight) : 0,
    buttonText: toLocalizedString(rawProps?.buttonText, defaultResetPasswordTokens.buttonText),
    buttonTextColor: toLocalizedString(
      firstDefined(rawProps?.buttonColor, rawProps?.buttonTextColor),
      defaultResetPasswordTokens.buttonTextColor
    ),
    // The Button "Background & Padding" panel's real keys all live nested
    // under buyNow.* (buttonbgColor/buttonborderColor/buttonborderLine/
    // buttonpt-pr) or addToCart.* (buttonBorderRadius) — the flat top-level
    // keys read below were never written by the Inspector, so this whole
    // panel had zero effect regardless of what the merchant set.
    buttonBorderColor: toLocalizedString(firstDefined(buyNow?.buttonborderColor, rawProps?.buttonBorderColor), defaultResetPasswordTokens.buttonBorderColor),
    // buyNow.buttonborderLine is a side word (left/right/top/bottom/all/none),
    // not a pixel width — mirror the same fallback-to-1 fix as cardBorderWidth.
    buttonBorderWidth: resolveBorderWidth(buyNow?.buttonborderLine, buyNow?.buttonborderColor, 1),
    buttonFillColor: toLocalizedString(
      firstDefined(buyNow?.buttonbgColor, rawProps?.buttonBgColor, rawProps?.buttonFillColor),
      defaultResetPasswordTokens.buttonFillColor
    ),
    // Moved from addToCart.buttonBorderRadius to buyNow.buttonBorderRadius,
    // alongside every other Button Background & Padding field.
    buttonRadius: toNumber(firstDefined(buyNow?.buttonBorderRadius, addToCart?.buttonBorderRadius, rawProps?.buttonRadius), defaultResetPasswordTokens.buttonRadius),
    buttonPaddingTop: toNumber(firstDefined(buyNow?.buttonpt, rawProps?.buttonPaddingTop), defaultResetPasswordTokens.buttonPaddingTop),
    buttonPaddingBottom: toNumber(firstDefined(buyNow?.buttonpb, rawProps?.buttonPaddingBottom), defaultResetPasswordTokens.buttonPaddingBottom),
    buttonPaddingLeft: toNumber(firstDefined(buyNow?.buttonpl, rawProps?.buttonPaddingLeft), defaultResetPasswordTokens.buttonPaddingLeft),
    buttonPaddingRight: toNumber(firstDefined(buyNow?.buttonpr, rawProps?.buttonPaddingRight), defaultResetPasswordTokens.buttonPaddingRight),
    buttonMarginTop: toNumber(rawProps?.buttonMarginTop, defaultResetPasswordTokens.buttonMarginTop),
    buttonFontSize: toNumber(rawProps?.buttonFontSize, defaultResetPasswordTokens.buttonFontSize),
    buttonFontFamily: toFontFamily(rawProps?.buttonFontFamily, defaultResetPasswordTokens.buttonFontFamily),
    buttonFontWeight: toBoolean(rawProps?.buttonBold, false)
      ? '700'
      : toFontWeight(rawProps?.buttonFontWeight, defaultResetPasswordTokens.buttonFontWeight),
    buttonFontStyle: toBoolean(rawProps?.buttonItalic, false) ? 'italic' : 'normal',
    buttonTextDecoration: toTextDecoration(
      toBoolean(rawProps?.buttonUnderline, false),
      toBoolean(rawProps?.buttonStrikethrough, false)
    ),
    buttonUppercase: toBoolean(rawProps?.buttonUppercase, defaultResetPasswordTokens.buttonUppercase),
    buttonIcon: toStringValue(rawProps?.buttonIcon, defaultResetPasswordTokens.buttonIcon),
    buttonIconSize: toNumber(rawProps?.buttonIconSize, defaultResetPasswordTokens.buttonIconSize),
    buttonIconColor: toLocalizedString(rawProps?.buttonIconColor, defaultResetPasswordTokens.buttonIconColor),
    buttonIconAlign: toStringValue(rawProps?.buttonIconAlign, defaultResetPasswordTokens.buttonIconAlign),
    // Input's "Placeholder" panel (Inspector.tsx, nested under the "Input"
    // parent) writes emailPlaceholder/emailPlaceholderColor/
    // emailPlaceholderFontSize/emailPlaceholderFontFamily/
    // emailPlaceholderFontWeight/emailPlaceholderBold/Italic/Underline/
    // Strikethrough flat on rawProps — none of these were ever resolved
    // here, so the placeholder text and its styling were permanently stuck
    // at the hardcoded default.
    emailPlaceholder: toLocalizedString(rawProps?.emailPlaceholder, defaultResetPasswordTokens.emailPlaceholder),
    emailPlaceholderColor: toLocalizedString(rawProps?.emailPlaceholderColor, defaultResetPasswordTokens.emailPlaceholderColor),
    emailPlaceholderFontSize: toNumber(rawProps?.emailPlaceholderFontSize, defaultResetPasswordTokens.emailPlaceholderFontSize),
    emailPlaceholderFontFamily: toFontFamily(rawProps?.emailPlaceholderFontFamily, defaultResetPasswordTokens.emailPlaceholderFontFamily),
    emailPlaceholderFontWeight: toBoolean(rawProps?.emailPlaceholderBold, false)
      ? '700'
      : toFontWeight(rawProps?.emailPlaceholderFontWeight, defaultResetPasswordTokens.emailPlaceholderFontWeight),
    emailPlaceholderFontStyle: toBoolean(rawProps?.emailPlaceholderItalic, false) ? 'italic' : 'normal',
    emailPlaceholderTextDecoration: toTextDecoration(
      toBoolean(rawProps?.emailPlaceholderUnderline, false),
      toBoolean(rawProps?.emailPlaceholderStrikethrough, false)
    ),
    // Input's "Input Text" panel writes inputFontSize/inputFontFamily/
    // inputFontWeight/inputTextColor flat on rawProps — same
    // resolved-but-never-assigned gap as the placeholder fields above.
    inputTextColor: toLocalizedString(rawProps?.inputTextColor, defaultResetPasswordTokens.inputTextColor),
    inputFontSize: toNumber(rawProps?.inputFontSize, defaultResetPasswordTokens.inputFontSize),
    inputFontFamily: toFontFamily(rawProps?.inputFontFamily, defaultResetPasswordTokens.inputFontFamily),
    inputFontWeight: toFontWeight(rawProps?.inputFontWeight, defaultResetPasswordTokens.inputFontWeight),
    // Input's "Background & Padding" panel (Inspector.tsx, nested under the
    // new "Input" parent) writes buyNow.inputBgColor/inputBorderLine/
    // inputBorderColor/inputBorderRadius/inputpt-pr — none of these were
    // ever resolved here, so the whole panel was 100% cosmetic in Builder
    // only and had zero effect in the APK (always the hardcoded default).
    inputBgColor: showInputBgSection ? toLocalizedString(buyNow?.inputBgColor, defaultResetPasswordTokens.inputBgColor) : 'transparent',
    inputBorderColor: toLocalizedString(buyNow?.inputBorderColor, defaultResetPasswordTokens.inputBorderColor),
    inputBorderRadius: showInputBgSection
      ? toNumber(buyNow?.inputBorderRadius, defaultResetPasswordTokens.inputBorderRadius)
      : 0,
    inputPaddingHorizontal: showInputBgSection
      ? toNumber(buyNow?.inputpl ?? buyNow?.inputpr, defaultResetPasswordTokens.inputPaddingHorizontal)
      : 0,
    inputPaddingVertical: showInputBgSection
      ? toNumber(buyNow?.inputpt ?? buyNow?.inputpb, defaultResetPasswordTokens.inputPaddingVertical)
      : 0,
  };
};

const buildSignUpTokens = (rawProps: Record<string, unknown>): SignUpTokens => themeAuthColorTokens({
  ...defaultSignUpTokens,
  bgColor: (rawProps?.bgColor as string) ?? defaultSignUpTokens.bgColor,
  titleColor: (rawProps?.titleColor as string) ?? defaultSignUpTokens.titleColor,
  cardBgColor: (rawProps?.cardBgColor as string) ?? defaultSignUpTokens.cardBgColor,
  // Inspector's live "Border Color" control (Background & Padding section)
  // writes `borderColor`, not `cardBorderColor` (the Authentication
  // section's own Card Background/Border pickers are commented out/dead).
  cardBorderColor: (pick(rawProps, ['borderColor', 'cardBorderColor']) as string) ?? defaultSignUpTokens.cardBorderColor,
  cardBorderWidth: resolveBorderWidth(rawProps?.borderLine, rawProps?.borderColor ?? rawProps?.cardBorderColor, defaultSignUpTokens.cardBorderWidth),
  // SignUp's "Background & Padding" section writes borderRadiusBox, not borderRadius.
  cardBorderRadius: toNumber(pick(rawProps, ['borderRadiusBox', 'borderRadius']), defaultSignUpTokens.cardBorderRadius),
  // The "Background & Padding" PaddingGrid writes subgpt/subgpb/subgpl/subgpr
  // — these are the real, live-editable card-content padding values (Preview
  // applies them inside the card, around the fields). `pt/pb/pl/pr` are
  // never written by any control, so reading those left this permanently
  // stuck at the hardcoded 20px default.
  cardPaddingTop: toNumber(rawProps?.subgpt ?? rawProps?.pt ?? rawProps?.paddingTop, defaultSignUpTokens.cardPaddingTop),
  cardPaddingBottom: toNumber(rawProps?.subgpb ?? rawProps?.pb ?? rawProps?.paddingBottom, defaultSignUpTokens.cardPaddingBottom),
  cardPaddingLeft: toNumber(rawProps?.subgpl ?? rawProps?.pl ?? rawProps?.paddingLeft, defaultSignUpTokens.cardPaddingLeft),
  cardPaddingRight: toNumber(rawProps?.subgpr ?? rawProps?.pr ?? rawProps?.paddingRight, defaultSignUpTokens.cardPaddingRight),
  formGap: toNumber(rawProps?.formGap ?? rawProps?.titleFormGap ?? rawProps?.headerBottomGap, defaultSignUpTokens.formGap),
  fieldGap: toNumber(rawProps?.fieldGap ?? rawProps?.inputGap ?? rawProps?.fieldMarginBottom, defaultSignUpTokens.fieldGap),
  inputPaddingHorizontal: toNumber(rawProps?.inputPaddingHorizontal ?? rawProps?.inputPx ?? rawProps?.fieldPaddingHorizontal, defaultSignUpTokens.inputPaddingHorizontal),
  inputPaddingVertical: toNumber(rawProps?.inputPaddingVertical ?? rawProps?.inputPy ?? rawProps?.fieldPaddingVertical, defaultSignUpTokens.inputPaddingVertical),
  formCardMarginBottom: toNumber(rawProps?.formCardMarginBottom ?? rawProps?.cardMarginBottom, defaultSignUpTokens.formCardMarginBottom),
  buttonMarginTop: toNumber(rawProps?.buttonMarginTop ?? rawProps?.buttonMt, defaultSignUpTokens.buttonMarginTop),
  footerMarginTop: toNumber(rawProps?.footerMarginTop ?? rawProps?.footerMt ?? rawProps?.footerPt, defaultSignUpTokens.footerMarginTop),
  footerLinkMarginTop: toNumber(rawProps?.footerLinkMarginTop ?? rawProps?.footerLinkMt ?? rawProps?.signInLinkPt, defaultSignUpTokens.footerLinkMarginTop),
  footerInline: toBoolean(rawProps?.footerInline ?? rawProps?.footerSameLine, defaultSignUpTokens.footerInline),
  // subgpt/subgpb/subgpl/subgpr are the card's own content padding (see
  // cardPaddingTop/etc above) — they must not also feed the outer page
  // margin, or the same slider would double up on two unrelated things.
  // There's no live Inspector control for outer page margin on Sign Up, so
  // this stays at its fixed default.
  pagePaddingTop: toNumber(rawProps?.bgpt ?? rawProps?.pagePaddingTop, defaultSignUpTokens.pagePaddingTop),
  pagePaddingBottom: toNumber(rawProps?.bgpb ?? rawProps?.pagePaddingBottom, defaultSignUpTokens.pagePaddingBottom),
  pagePaddingLeft: toNumber(rawProps?.bgpl ?? rawProps?.pagePaddingLeft, defaultSignUpTokens.pagePaddingLeft),
  pagePaddingRight: toNumber(rawProps?.bgpr ?? rawProps?.pagePaddingRight, defaultSignUpTokens.pagePaddingRight),
  inputBorderColor: (rawProps?.inputBorderColor as string) ?? defaultSignUpTokens.inputBorderColor,
  inputHeight: toNumber(rawProps?.inputHeight ?? rawProps?.fieldHeight, defaultSignUpTokens.inputHeight),
  authTitle: (rawProps?.authTitle as string) ?? defaultSignUpTokens.authTitle,
  buttonText: (rawProps?.buttonText as string) ?? defaultSignUpTokens.buttonText,
  footerText: (rawProps?.footerText as string) ?? defaultSignUpTokens.footerText,
  footerLinkText: (rawProps?.footerLinkText as string) ?? defaultSignUpTokens.footerLinkText,
  emailPlaceholder: (rawProps?.emailPlaceholder as string) ?? defaultSignUpTokens.emailPlaceholder,
  passwordPlaceholder: (rawProps?.passwordPlaceholder as string) ?? defaultSignUpTokens.passwordPlaceholder,
  firstNamePlaceholder: (rawProps?.firstNamePlaceholder as string) ?? defaultSignUpTokens.firstNamePlaceholder,
  lastNamePlaceholder: (rawProps?.lastNamePlaceholder as string) ?? defaultSignUpTokens.lastNamePlaceholder,
  emailPlaceholderVisible: toBoolean(rawProps?.emailPlaceHolderVisible ?? rawProps?.emailPlaceholderVisible, defaultSignUpTokens.emailPlaceholderVisible),
  passwordPlaceholderVisible: toBoolean(rawProps?.passwordPlaceHolderVisible ?? rawProps?.passwordPlaceholderVisible, defaultSignUpTokens.passwordPlaceholderVisible),
  firstNamePlaceholderVisible: toBoolean(rawProps?.firstNamePlaceHolderVisible ?? rawProps?.firstNamePlaceholderVisible, defaultSignUpTokens.firstNamePlaceholderVisible),
  lastNamePlaceholderVisible: toBoolean(rawProps?.lastNamePlaceHolderVisible ?? rawProps?.lastNamePlaceholderVisible, defaultSignUpTokens.lastNamePlaceholderVisible),
  // The Inspector's Title controls write authTitle/titleColor (the same keys
  // buildSignInTokens uses) — these must be the first candidates. The signup
  // JSX renders headerTitle/headerTitleColor, and liveRegistry.ts previously
  // seeded those directly, which always shadowed the Inspector's real value.
  headerTitle: (pick(rawProps, ['authTitle', 'headerTitle']) as string) ?? defaultSignUpTokens.headerTitle,
  headerTitleColor: (pick(rawProps, ['titleColor', 'headerTitleColor']) as string) ?? defaultSignUpTokens.headerTitleColor,
  headerTitleFontSize: toNumber(rawProps?.headerTitleFontSize, defaultSignUpTokens.headerTitleFontSize),
  headerTitleFontFamily: toFontFamily(rawProps?.headerTitleFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.headerTitleFontFamily),
  headerTitleFontWeight: toFontWeight(rawProps?.headerTitleFontWeight, defaultSignUpTokens.headerTitleFontWeight, rawProps?.authTitleBold as boolean | undefined),
  // Builder's per-field alignment control writes {field}AlignmenT (typo'd
  // trailing capital T) — the field group's actual rendered alignment. The
  // correctly-spelled *Alignment/*InputTextAlignment keys are kept as
  // forward-compatible aliases in case the typo gets fixed upstream.
  emailAlignment: (pick(rawProps, ['emailAlignmenT', 'emailAlignment']) as string) ?? defaultSignUpTokens.emailAlignment,
  firstNameAlignment: (pick(rawProps, ['firstNameAlignmenT', 'firstNameAlignment']) as string) ?? defaultSignUpTokens.firstNameAlignment,
  lastNameAlignment: (pick(rawProps, ['lastNameAlignmenT', 'lastNameAlignment']) as string) ?? defaultSignUpTokens.lastNameAlignment,
  passwordAlignment: (pick(rawProps, ['passwordAlignmenT', 'passwordAlignment']) as string) ?? defaultSignUpTokens.passwordAlignment,
  // Builder emits the input-text alignment under the "*AlignmenT" (capital T)
  // key (see SignUp/PreviewLive.tsx: textAlign: getTextAlign(lastNameAlignmenT)).
  // Check THAT first for every field — email/lastName/password previously
  // checked a "*InputTextAlignment" key the builder never writes, which, when
  // a schema-style DSL happened to surface one, overrode the real value (this
  // is why Last Name rendered centred while First Name — already checking
  // "*AlignmenT" first — did not).
  emailInputTextAlignment: (pick(rawProps, ['emailAlignmenT', 'emailInputTextAlignment', 'emailInputAlignment', 'emailTextAlignment']) as string) ?? defaultSignUpTokens.emailInputTextAlignment,
  firstNameInputTextAlignment: (pick(rawProps, ['firstNameAlignmenT', 'firstNameInputTextAlignment', 'firstNameInputAlignment', 'firstNameTextAlignment']) as string) ?? defaultSignUpTokens.firstNameInputTextAlignment,
  lastNameInputTextAlignment: (pick(rawProps, ['lastNameAlignmenT', 'lastNameInputTextAlignment', 'lastNameInputAlignment', 'lastNameTextAlignment']) as string) ?? defaultSignUpTokens.lastNameInputTextAlignment,
  passwordInputTextAlignment: (pick(rawProps, ['passwordAlignmenT', 'passwordInputTextAlignment', 'passwordInputAlignment', 'passwordTextAlignment']) as string) ?? defaultSignUpTokens.passwordInputTextAlignment,
  emailLabelVisible: (rawProps?.emailLabelVisible as boolean) ?? defaultSignUpTokens.emailLabelVisible,
  firstNameLabelVisible: (rawProps?.firstNameLabelVisible as boolean) ?? defaultSignUpTokens.firstNameLabelVisible,
  lastNameLabelVisible: (rawProps?.lastNameLabelVisible as boolean) ?? defaultSignUpTokens.lastNameLabelVisible,
  passwordLabelVisible: (rawProps?.passwordLabelVisible as boolean) ?? defaultSignUpTokens.passwordLabelVisible,
  // The field-level eye toggle writes {prefix}Visible (emailVisible/passwordVisible) —
  // NOT emailInputVisible/passwordInputVisible, which liveRegistry.ts seeds to `true`
  // on every signup block and would otherwise always win.
  emailInputVisible: toBoolean(pick(rawProps, ['emailVisible', 'emailInputVisible']), defaultSignUpTokens.emailInputVisible),
  firstNameVisible: (rawProps?.firstNameVisible as boolean) ?? defaultSignUpTokens.firstNameVisible,
  lastNameVisible: (rawProps?.lastNameVisible as boolean) ?? defaultSignUpTokens.lastNameVisible,
  passwordInputVisible: toBoolean(pick(rawProps, ['passwordVisible', 'passwordInputVisible']), defaultSignUpTokens.passwordInputVisible),
  emailLabelText: (rawProps?.emailLabelText as string) ?? defaultSignUpTokens.emailLabelText,
  firstNameLabelText: (rawProps?.firstNameLabelText as string) ?? defaultSignUpTokens.firstNameLabelText,
  lastNameLabelText: (rawProps?.lastNameLabelText as string) ?? defaultSignUpTokens.lastNameLabelText,
  passwordLabelText: (rawProps?.passwordLabelText as string) ?? defaultSignUpTokens.passwordLabelText,
  emailLabelColor: (rawProps?.emailLabelColor as string) ?? defaultSignUpTokens.emailLabelColor,
  firstNameLabelColor: (rawProps?.firstNameLabelColor as string) ?? defaultSignUpTokens.firstNameLabelColor,
  lastNameLabelColor: (rawProps?.lastNameLabelColor as string) ?? defaultSignUpTokens.lastNameLabelColor,
  passwordLabelColor: (rawProps?.passwordLabelColor as string) ?? defaultSignUpTokens.passwordLabelColor,
  emailLabelFontSize: toNumber(rawProps?.emailLabelFontSize, defaultSignUpTokens.emailLabelFontSize),
  firstNameLabelFontSize: toNumber(rawProps?.firstNameLabelFontSize, defaultSignUpTokens.firstNameLabelFontSize),
  lastNameLabelFontSize: toNumber(rawProps?.lastNameLabelFontSize, defaultSignUpTokens.lastNameLabelFontSize),
  passwordLabelFontSize: toNumber(rawProps?.passwordLabelFontSize, defaultSignUpTokens.passwordLabelFontSize),
  emailLabelFontFamily: toFontFamily(rawProps?.emailLabelFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.emailLabelFontFamily),
  firstNameLabelFontFamily: toFontFamily(rawProps?.firstNameLabelFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.firstNameLabelFontFamily),
  lastNameLabelFontFamily: toFontFamily(rawProps?.lastNameLabelFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.lastNameLabelFontFamily),
  passwordLabelFontFamily: toFontFamily(rawProps?.passwordLabelFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.passwordLabelFontFamily),
  emailLabelFontWeight: toFontWeight(rawProps?.emailLabelFontWeight, defaultSignUpTokens.emailLabelFontWeight),
  firstNameLabelFontWeight: toFontWeight(rawProps?.firstNameLabelFontWeight, defaultSignUpTokens.firstNameLabelFontWeight),
  lastNameLabelFontWeight: toFontWeight(rawProps?.lastNameLabelFontWeight, defaultSignUpTokens.lastNameLabelFontWeight),
  passwordLabelFontWeight: toFontWeight(rawProps?.passwordLabelFontWeight, defaultSignUpTokens.passwordLabelFontWeight),
  emailInputTextColor: (rawProps?.emailInputTextColor as string) ?? defaultSignUpTokens.emailInputTextColor,
  firstNameInputTextColor: (rawProps?.firstNameInputTextColor as string) ?? defaultSignUpTokens.firstNameInputTextColor,
  lastNameInputTextColor: (rawProps?.lastNameInputTextColor as string) ?? defaultSignUpTokens.lastNameInputTextColor,
  passwordInputTextColor: (rawProps?.passwordInputTextColor as string) ?? defaultSignUpTokens.passwordInputTextColor,
  // Builder's per-field "Input Text" subsection writes {field}InputTextfontSize
  // and {field}InputTextfontWeight (lowercase "font") — this MUST be the first
  // candidate in each chain. liveRegistry.ts seeds the capitalized spelling on
  // every signup block, so putting it first would always shadow the Inspector's
  // real value (this was SignIn's original Bug A, re-created here).
  emailInputTextFontSize: toNumber(pick(rawProps, ['emailInputTextfontSize', 'emailInputTextFontSize']), defaultSignUpTokens.emailInputTextFontSize),
  firstNameInputTextFontSize: toNumber(pick(rawProps, ['firstNameInputTextfontSize', 'firstNameInputTextFontSize']), defaultSignUpTokens.firstNameInputTextFontSize),
  lastNameInputTextFontSize: toNumber(pick(rawProps, ['lastNameInputTextfontSize', 'lastNameInputTextFontSize']), defaultSignUpTokens.lastNameInputTextFontSize),
  passwordInputTextFontSize: toNumber(pick(rawProps, ['passwordInputTextfontSize', 'passwordInputTextFontSize']), defaultSignUpTokens.passwordInputTextFontSize),
  emailInputTextFontFamily: toFontFamily(rawProps?.emailInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.emailInputTextFontFamily),
  firstNameInputTextFontFamily: toFontFamily(rawProps?.firstNameInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.firstNameInputTextFontFamily),
  lastNameInputTextFontFamily: toFontFamily(rawProps?.lastNameInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.lastNameInputTextFontFamily),
  passwordInputTextFontFamily: toFontFamily(rawProps?.passwordInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.passwordInputTextFontFamily),
  // Unlike FontSize/FontFamily above, the capitalized "{field}InputTextFontWeight"
  // is NOT a legitimate alias here — PreviewLive.tsx never reads it under any
  // name; only the lowercase "{field}InputTextfontWeight" ever reaches render.
  // liveRegistry.ts seeds the capitalized key to "700" on every signup block
  // regardless of what the merchant configures, so treating it as a fallback
  // made every untouched field render bold in the APK while Builder showed its
  // real (unbolded) default. Must fall straight to the hardcoded default once
  // the lowercase key is absent, matching Preview's own behavior.
  emailInputTextFontWeight: toFontWeight(rawProps?.emailInputTextfontWeight, defaultSignUpTokens.emailInputTextFontWeight),
  firstNameInputTextFontWeight: toFontWeight(rawProps?.firstNameInputTextfontWeight, defaultSignUpTokens.firstNameInputTextFontWeight),
  lastNameInputTextFontWeight: toFontWeight(rawProps?.lastNameInputTextfontWeight, defaultSignUpTokens.lastNameInputTextFontWeight),
  passwordInputTextFontWeight: toFontWeight(rawProps?.passwordInputTextfontWeight, defaultSignUpTokens.passwordInputTextFontWeight),
  emailPlaceholderColor: (rawProps?.emailPlaceholderColor as string) ?? defaultSignUpTokens.emailPlaceholderColor,
  firstNamePlaceholderColor: (rawProps?.firstNamePlaceholderColor as string) ?? defaultSignUpTokens.firstNamePlaceholderColor,
  lastNamePlaceholderColor: (rawProps?.lastNamePlaceholderColor as string) ?? defaultSignUpTokens.lastNamePlaceholderColor,
  passwordPlaceholderColor: (rawProps?.passwordPlaceholderColor as string) ?? defaultSignUpTokens.passwordPlaceholderColor,
  emailPlaceholderFontSize: toNumber(rawProps?.emailPlaceholderFontSize ?? rawProps?.placeholderFontSize ?? rawProps?.fontSize, defaultSignUpTokens.emailPlaceholderFontSize),
  firstNamePlaceholderFontSize: toNumber(rawProps?.firstNamePlaceholderFontSize ?? rawProps?.placeholderFontSize ?? rawProps?.fontSize, defaultSignUpTokens.firstNamePlaceholderFontSize),
  lastNamePlaceholderFontSize: toNumber(rawProps?.lastNamePlaceholderFontSize ?? rawProps?.placeholderFontSize ?? rawProps?.fontSize, defaultSignUpTokens.lastNamePlaceholderFontSize),
  passwordPlaceholderFontSize: toNumber(rawProps?.passwordPlaceholderFontSize ?? rawProps?.placeholderFontSize ?? rawProps?.fontSize, defaultSignUpTokens.passwordPlaceholderFontSize),
  emailPlaceholderFontFamily: toFontFamily(rawProps?.emailPlaceholderFontFamily ?? rawProps?.placeholderFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.emailPlaceholderFontFamily),
  firstNamePlaceholderFontFamily: toFontFamily(rawProps?.firstNamePlaceholderFontFamily ?? rawProps?.placeholderFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.firstNamePlaceholderFontFamily),
  lastNamePlaceholderFontFamily: toFontFamily(rawProps?.lastNamePlaceholderFontFamily ?? rawProps?.placeholderFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.lastNamePlaceholderFontFamily),
  passwordPlaceholderFontFamily: toFontFamily(rawProps?.passwordPlaceholderFontFamily ?? rawProps?.placeholderFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.passwordPlaceholderFontFamily),
  // Builder's per-field placeholder subsection writes {field}PlaceholderfontWeight
  // (lowercase "font") and PreviewLive.tsx only ever reads that lowercase key —
  // the capitalized "{field}PlaceholderFontWeight" is never read by Preview under
  // any circumstance. liveRegistry.ts nonetheless seeds it to "700" on every
  // signup block, so including it as a fallback candidate made every field the
  // merchant hadn't touched via the weight slider render bold in the APK while
  // Builder showed its real default. Must go straight from the lowercase key to
  // the hardcoded default (matching Preview's own destructuring default) if the
  // lowercase key is absent — never fall back to the capitalized seed.
  // Builder's placeholder Format toolbar (Bold/Italic/Underline/Strike) writes
  // BOTH `{field}Placeholderbold` and `{field}PlaceholderfontWeight` together
  // (bold ? 700 : 500) on every click, but the separate Weight slider next to
  // it only ever writes `{field}PlaceholderfontWeight` — so a merchant who
  // drags the slider after toggling Bold ends up with a stale `bold: true`
  // alongside a non-700 weight. Builder's own PreviewLive.tsx renders
  // `--ph-weight` from the raw fontWeight number only and never reads the
  // bold flag, so passing `isBold` here (forcing 700 whenever the stale flag
  // is true) could show a different weight per field than Builder actually
  // renders. Trust the resolved fontWeight value only, like Preview does.
  emailPlaceholderFontWeight: toFontWeight(rawProps?.emailPlaceholderfontWeight, defaultSignUpTokens.emailPlaceholderFontWeight),
  firstNamePlaceholderFontWeight: toFontWeight(rawProps?.firstNamePlaceholderfontWeight, defaultSignUpTokens.firstNamePlaceholderFontWeight),
  lastNamePlaceholderFontWeight: toFontWeight(rawProps?.lastNamePlaceholderfontWeight, defaultSignUpTokens.lastNamePlaceholderFontWeight),
  passwordPlaceholderFontWeight: toFontWeight(rawProps?.passwordPlaceholderfontWeight, defaultSignUpTokens.passwordPlaceholderFontWeight),
  ...buildButtonStyleTokens(rawProps, defaultSignUpTokens, false),
  // Builder's Button section writes buttonborderColor (lowercase "b") — must be
  // the first candidate; liveRegistry.ts seeds buttonBorderColor on every signup
  // block, which would otherwise always shadow the Inspector's real value.
  buttonBorderColor: (pick(rawProps, ['buttonborderColor', 'buttonBorderColor']) as string) ?? defaultSignUpTokens.buttonBorderColor,
  buttonBorderWidth: resolveBorderWidth(rawProps?.buttonBorderLine, pick(rawProps, ['buttonborderColor', 'buttonBorderColor']), defaultSignUpTokens.buttonBorderWidth),
  buttonPaddingTop: toNumber(rawProps?.buttonPaddingTop, defaultSignUpTokens.buttonPaddingTop),
  buttonPaddingBottom: toNumber(rawProps?.buttonPaddingBottom, defaultSignUpTokens.buttonPaddingBottom),
  buttonAutoUppercase: (rawProps?.buttonAutoUppercase as boolean) ?? defaultSignUpTokens.buttonAutoUppercase,
  // Builder's Button section writes buttonheightt (typo, double "t") and
  // buttonwidth (lowercase "w") — correctly-spelled keys kept as aliases.
  buttonHeight: toNumber(pick(rawProps, ['buttonheightt', 'buttonHeight']), defaultSignUpTokens.buttonHeight),
  buttonWidth: toNumber(pick(rawProps, ['buttonwidth', 'buttonWidth']), defaultSignUpTokens.buttonWidth),
  footerTextColor: (rawProps?.footerTextColor as string) ?? defaultSignUpTokens.footerTextColor,
  footerLinkColor: (rawProps?.footerLinkColor as string) ?? defaultSignUpTokens.footerLinkColor,
  // Builder writes footerTextfontSize/footerLinkfontSize/footerLinkfontWeight
  // (lowercase "font") — must be the first candidate; liveRegistry.ts seeds the
  // capitalized spellings on every signup block, which would otherwise always
  // shadow the Inspector's real value.
  footerTextFontSize: toNumber(pick(rawProps, ['footerTextfontSize', 'footerTextFontSize']) ?? rawProps?.subtextSize ?? rawProps?.fontSize, defaultSignUpTokens.footerTextFontSize),
  footerTextFontFamily: toFontFamily(rawProps?.footerTextFontFamily ?? rawProps?.subtextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.footerTextFontFamily),
  footerTextFontWeight: toFontWeight(rawProps?.footerTextFontWeight ?? rawProps?.subtextWeight ?? rawProps?.fontWeight, defaultSignUpTokens.footerTextFontWeight, rawProps?.footerTextBold as boolean | undefined),
  footerLinkFontSize: toNumber(pick(rawProps, ['footerLinkfontSize', 'footerLinkFontSize']), defaultSignUpTokens.footerLinkFontSize),
  footerLinkFontFamily: toFontFamily(rawProps?.footerLinkFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.footerLinkFontFamily),
  // Capitalized footerLinkFontWeight is seed-only here too (liveRegistry.ts
  // writes "700" on every signup block; Preview never reads it) — only the
  // lowercase key is real.
  footerLinkFontWeight: toFontWeight(rawProps?.footerLinkfontWeight, defaultSignUpTokens.footerLinkFontWeight, rawProps?.footerLinkTextBold as boolean | undefined),
  // Builder's live Alignment control for this section writes
  // footerTextAlignmenT (the odd capital "T" is intentional, matches the DSL
  // key) — its footerLinkAlignment control is dead/commented out in
  // InspectorLive.tsx, so that key is kept only as a legacy fallback.
  footerLinkAlignment: (rawProps?.footerTextAlignmenT as string) ?? (rawProps?.footerLinkAlignment as string) ?? defaultSignUpTokens.footerLinkAlignment,
  footerLinkAutoUppercase: (rawProps?.footerLinkAutoUppercase as boolean) ?? defaultSignUpTokens.footerLinkAutoUppercase,
  footerVisible: (rawProps?.footerVisible as boolean) ?? defaultSignUpTokens.footerVisible,
  signInLinkVisible: (rawProps?.signInLinkVisible as boolean) ?? defaultSignUpTokens.signInLinkVisible,
  // Preview only ever gates the link on signInLinkTextVisible (the nested
  // "Text" sub-toggle) — signInLinkVisible (whole-section toggle) is
  // destructured in Preview but never actually applied. RN previously did
  // the opposite (only read signInLinkVisible). Honor both so either real
  // toggle hides the link.
  signInLinkTextVisible: toBoolean(rawProps?.signInLinkTextVisible, defaultSignUpTokens.signInLinkTextVisible),
  buttonVisible: (rawProps?.buttonVisible as boolean) ?? defaultSignUpTokens.buttonVisible,
  buttonIconsVisible: toBoolean(rawProps?.buttonIconsVisible, defaultSignUpTokens.buttonIconsVisible),
  // SignUp's Logo/Image section writes logoImgVisible/logoImage/logoBgColor/
  // logoBorderColor (distinct from SignIn's logoVisible/imageBgColor/
  // imageBorderColor) — the profile-picture-styled avatar block reuses these.
  showProfilePicture: toBoolean(pick(rawProps, ['logoImgVisible', 'showProfilePicture']), defaultSignUpTokens.showProfilePicture),
  profilePictureUrl: toStringValue(pick(rawProps, ['logoImage', 'profilePictureUrl']), defaultSignUpTokens.profilePictureUrl).trim(),
  profilePictureSize: toNumber(rawProps?.profilePictureSize, defaultSignUpTokens.profilePictureSize),
  profilePictureBgColor: (pick(rawProps, ['logoBgColor', 'profilePictureBgColor']) as string) ?? defaultSignUpTokens.profilePictureBgColor,
  profilePictureBorderColor: (pick(rawProps, ['logoBorderColor', 'profilePictureBorderColor']) as string) ?? defaultSignUpTokens.profilePictureBorderColor,
  buttonRadius: toNumber(rawProps?.buttonRadius ?? rawProps?.buttonBorderRadius, defaultSignUpTokens.buttonRadius),
  // NOTE: `borderRadius` is SignUp's card corner-radius alias fallback (the real
  // field is borderRadiusBox, see cardBorderRadius above) — Builder's
  // SignUp/PreviewLive.tsx renders the input radius as a flat hardcoded 8px,
  // completely independent of the card radius, so it must NOT be aliased here.
  inputBorderRadius: toNumber(rawProps?.inputRadius ?? rawProps?.inputBorderRadius, defaultSignUpTokens.inputBorderRadius),
  headlineSize: toNumber(rawProps?.headlineSize, defaultSignUpTokens.headlineSize),
  headlineWeight: toFontWeight(rawProps?.headlineWeight, defaultSignUpTokens.headlineWeight),
  headlineFontFamily: toFontFamily(rawProps?.headlineFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.headlineFontFamily),
  headlineFontStyle: toBoolean(rawProps?.authTitleItalic, false) ? 'italic' : 'normal',
  headlineTextDecoration: toTextDecoration(toBoolean(rawProps?.authTitleUnderline, false), toBoolean(rawProps?.authTitleStrikethrough, false)),
  subtextSize: toNumber(rawProps?.subtextSize, defaultSignUpTokens.subtextSize),
  subtextWeight: toFontWeight(rawProps?.subtextWeight, defaultSignUpTokens.subtextWeight),
  subtextFontFamily: toFontFamily(rawProps?.subtextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.subtextFontFamily),
  emailPlaceholderFontStyle: toBoolean(rawProps?.emailPlaceholderItalic, false) ? 'italic' : 'normal',
  emailPlaceholderTextDecoration: toTextDecoration(toBoolean(rawProps?.emailPlaceholderUnderline, false), toBoolean(rawProps?.emailPlaceholderStrikethrough, false)),
  passwordPlaceholderFontStyle: toBoolean(rawProps?.passwordPlaceholderItalic, false) ? 'italic' : 'normal',
  passwordPlaceholderTextDecoration: toTextDecoration(toBoolean(rawProps?.passwordPlaceholderUnderline, false), toBoolean(rawProps?.passwordPlaceholderStrikethrough, false)),
  firstNamePlaceholderFontStyle: toBoolean(rawProps?.firstNamePlaceholderItalic, false) ? 'italic' : 'normal',
  firstNamePlaceholderTextDecoration: toTextDecoration(toBoolean(rawProps?.firstNamePlaceholderUnderline, false), toBoolean(rawProps?.firstNamePlaceholderStrikethrough, false)),
  lastNamePlaceholderFontStyle: toBoolean(rawProps?.lastNamePlaceholderItalic, false) ? 'italic' : 'normal',
  lastNamePlaceholderTextDecoration: toTextDecoration(toBoolean(rawProps?.lastNamePlaceholderUnderline, false), toBoolean(rawProps?.lastNamePlaceholderStrikethrough, false)),
  buttonTextFontStyle: toBoolean(rawProps?.buttonTextItalic, false) ? 'italic' : 'normal',
  buttonTextTextDecoration: toTextDecoration(toBoolean(rawProps?.buttonTextUnderline, false), toBoolean(rawProps?.buttonTextStrikethrough, false)),
  footerLinkFontStyle: toBoolean(rawProps?.footerLinkTextItalic, false) ? 'italic' : 'normal',
  footerLinkTextDecoration: toTextDecoration(toBoolean(rawProps?.footerLinkTextUnderline, false), toBoolean(rawProps?.footerLinkTextStrikethrough, false)),
  footerTextFontStyle: toBoolean(rawProps?.footerTextItalic, false) ? 'italic' : 'normal',
  // SignUp's footer "Strikethrough" toggle writes accountStrikethrough (not
  // footerTextAccountStrikethrough like SignIn's does).
  footerTextTextDecoration: toTextDecoration(toBoolean(rawProps?.footerTextUnderline, false), toBoolean(rawProps?.accountStrikethrough, false)),
  logoVisible: toBoolean(pick(rawProps, ['logoImgVisible', 'logoVisible']), defaultSignUpTokens.logoVisible),
  logoImageUrl: (pick(rawProps, ['logoImage']) as string) ?? defaultSignUpTokens.logoImageUrl,
  logoRatio: (rawProps?.imageRatio as string) ?? defaultSignUpTokens.logoRatio,
  logoScale: (rawProps?.imageScale as string) ?? defaultSignUpTokens.logoScale,
  logoBgColor: (pick(rawProps, ['logoBgColor']) as string) ?? defaultSignUpTokens.logoBgColor,
  logoBorderColor: (pick(rawProps, ['logoBorderColor']) as string) ?? defaultSignUpTokens.logoBorderColor,
  logoCorners: toNumber(rawProps?.imageCorners, defaultSignUpTokens.logoCorners),
  buttonIcon: (rawProps?.buttonIcon as string) ?? defaultSignUpTokens.buttonIcon,
  buttonIconSize: toNumber(rawProps?.buttonIconSize, defaultSignUpTokens.buttonIconSize),
  buttonIconColor: (rawProps?.buttonIconColor as string) ?? defaultSignUpTokens.buttonIconColor,
  // SignUp's icon-alignment control writes buttonIconAlignmenT (typo).
  buttonIconAlignment: (pick(rawProps, ['buttonIconAlignmenT', 'buttonIconAlignment']) as string) ?? defaultSignUpTokens.buttonIconAlignment,
  navigateTo: (rawProps?.navigateTo as string) ?? defaultSignUpTokens.navigateTo,
  selectScreen: (rawProps?.selectScreen as string) ?? defaultSignUpTokens.selectScreen,
});

// ─── Field components ────────────────────────────────────────────────────────

type FieldProps = {
  label?: string;
  labelVisible: boolean;
  labelColor: string;
  labelFontSize: number;
  labelFontFamily: string;
  labelFontWeight: string;
  labelAlign?: 'left' | 'center' | 'right';
  placeholder: string;
  placeholderVisible?: boolean;
  placeholderColor: string;
  placeholderFontSize?: number;
  placeholderFontFamily?: string;
  placeholderFontWeight?: string;
  placeholderFontStyle?: 'normal' | 'italic';
  placeholderTextDecoration?: 'none' | 'underline' | 'line-through' | 'underline line-through';
  value: string;
  onChangeText: (v: string) => void;
  inputColor: string;
  inputFontSize: number;
  inputFontFamily: string;
  inputFontWeight: string;
  inputAlign?: 'left' | 'center' | 'right';
  inputBorderColor: string;
  inputBorderRadius: number;
  inputHeight: number;
  fieldGap: number;
  inputPaddingHorizontal: number;
  inputPaddingVertical: number;
  cardBgColor: string;
  keyboardType?: AuthFieldKeyboardType;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  helperText?: string;
  helperVisible?: boolean;
  helperColor?: string;
  helperFontSize?: number;
  helperFontFamily?: string;
  helperFontWeight?: string;
  rightSlot?: React.ReactNode;
};

// Perceived-luminance dark check + auto-contrast text colour. The sign-in /
// sign-up blocks default *InputTextColor to near-black; on a dark themed
// card (Brand Kit page background, or a dark cardBgColor set in the block)
// the typed text is then invisible. When the colour is unset or one of those
// neutral black/white defaults, pick white-or-dark based on the field's own
// background instead.
const _isDarkColor = (hex?: string): boolean => {
  if (!hex || typeof hex !== 'string') return false;
  let c = hex.trim().replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};
const _NEUTRAL_INPUT_COLORS = new Set([
  '', '#000', '#000000', '#0a0a0a', '#111', '#111827', '#1a1a1a', '#1f2937',
  '#fff', '#ffffff', '#f9fafb', '#6b7280', '#9ca3af',
]);
const _resolvableColor = (c?: string) => {
  const v = String(c || '').trim().toLowerCase();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v) ? v : '';
};
const _autoContrastText = (given: string | undefined, bg: string | undefined, forPlaceholder = false): string | undefined => {
  const g = String(given || '').trim().toLowerCase();
  if (g && !_NEUTRAL_INPUT_COLORS.has(g)) return given; // merchant chose a real colour
  // Effective background: the field's own bg if it's a real colour, else the
  // Brand Kit page background the screen now sits on.
  const effBg = _resolvableColor(bg) || _resolvableColor(getPageBgColorSync() || '') || '#ffffff';
  const dark = _isDarkColor(effBg);
  if (forPlaceholder) return dark ? 'rgba(255,255,255,0.55)' : (given || 'rgba(17,24,39,0.45)');
  return dark ? '#FFFFFF' : (given || '#111827');
};

const FormField: React.FC<FieldProps> = ({
  label,
  labelVisible,
  labelColor,
  labelFontSize,
  labelFontFamily,
  labelFontWeight,
  labelAlign = 'left',
  placeholder,
  placeholderVisible = true,
  placeholderColor,
  placeholderFontSize,
  placeholderFontFamily,
  placeholderFontWeight,
  placeholderFontStyle = 'normal',
  placeholderTextDecoration = 'none',
  value,
  onChangeText,
  inputColor,
  inputFontSize,
  inputFontFamily,
  inputFontWeight,
  inputAlign = 'left',
  inputBorderColor,
  inputBorderRadius,
  inputHeight,
  fieldGap,
  inputPaddingHorizontal,
  inputPaddingVertical,
  cardBgColor,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  secureTextEntry = false,
  helperText = '',
  helperVisible = false,
  helperColor = '#6B7280',
  helperFontSize = 12,
  helperFontFamily = 'System',
  helperFontWeight = '400',
  rightSlot,
}) => {
  const shouldShowLabel = labelVisible && !placeholderVisible && Boolean(label);
  const usePlaceholderTypography = placeholderVisible && !value;
  const resolvedInputFontSize = usePlaceholderTypography ? placeholderFontSize ?? inputFontSize : inputFontSize;
  const resolvedInputFontFamily = usePlaceholderTypography ? placeholderFontFamily ?? inputFontFamily : inputFontFamily;
  const resolvedInputFontWeight = usePlaceholderTypography ? placeholderFontWeight ?? inputFontWeight : inputFontWeight;
  const resolvedFontStyle = usePlaceholderTypography ? placeholderFontStyle : 'normal';
  const resolvedTextDecoration = usePlaceholderTypography ? placeholderTextDecoration : 'none';
  const resolvedInputAlign = inputAlign;
  const effInputColor = _autoContrastText(inputColor, cardBgColor, false);
  const effPlaceholderColor = _autoContrastText(placeholderColor, cardBgColor, true);
  return (
  <View style={[fieldStyles.group, { marginBottom: fieldGap }]}>
    {shouldShowLabel ? (
      <Text
        style={[
          fieldStyles.label,
          {
            color: labelColor,
            fontSize: labelFontSize,
            fontFamily: labelFontFamily !== 'System' ? labelFontFamily : undefined,
            fontWeight: labelFontWeight as any,
            textAlign: labelAlign,
          },
        ]}
      >
        {label}
      </Text>
    ) : null}
    <View style={[fieldStyles.inputWrap, { borderColor: inputBorderColor, borderRadius: inputBorderRadius, backgroundColor: cardBgColor, minHeight: inputHeight }]}>
      <TextInput
        placeholder={placeholderVisible ? placeholder : ''}
        placeholderTextColor={effPlaceholderColor}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={[
          fieldStyles.input,
          {
            color: effInputColor,
            fontSize: resolvedInputFontSize,
            fontFamily: resolvedInputFontFamily !== 'System' ? resolvedInputFontFamily : undefined,
            fontWeight: resolvedInputFontWeight as any,
            fontStyle: resolvedFontStyle,
            textDecorationLine: resolvedTextDecoration,
            textAlign: resolvedInputAlign,
            textAlignVertical: 'center',
            flex: rightSlot ? 1 : undefined,
            width: rightSlot ? undefined : '100%',
            minHeight: inputHeight,
            paddingHorizontal: inputPaddingHorizontal,
            paddingVertical: inputPaddingVertical,
          },
        ]}
      />
      {rightSlot ?? null}
    </View>
    {helperVisible && helperText ? (
      <Text
        style={[
          fieldStyles.helper,
          {
            color: helperColor,
            fontSize: helperFontSize,
            fontFamily: helperFontFamily !== 'System' ? helperFontFamily : undefined,
            fontWeight: helperFontWeight as any,
          },
        ]}
      >
        {helperText}
      </Text>
    ) : null}
  </View>
  );
};

const fieldStyles = StyleSheet.create({
  group: { width: '100%' },
  label: { marginBottom: 6 },
  helper: { marginTop: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    minHeight: 50,
  },
  input: {
    minHeight: 50,
    width: '100%',
    textAlign: 'left',
    textAlignVertical: 'center',
  },
});

// ─── Logo ─────────────────────────────────────────────────────────────────────
// Shared by SignIn and SignUp — Builder's "Logo/Image" section (imageRatio/
// imageScale/imageCorners + a bg/border-colored container) uses the same
// concept on both blocks, just under different key names on the SignUp side
// (handled by the alias reads in buildSignUpTokens above).

const AUTH_LOGO_BASE_WIDTH = 120;

const parseAuthLogoRatio = (ratio: string): number => {
  const match = String(ratio || '').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return 1;
  const w = Number(match[1]);
  const h = Number(match[2]);
  return w > 0 && h > 0 ? w / h : 1;
};

type AuthLogoProps = {
  visible: boolean;
  imageUrl: string;
  ratio: string;
  scale: string;
  bgColor: string;
  borderColor: string;
  corners: number;
};

const AuthLogo: React.FC<AuthLogoProps> = ({ visible, imageUrl, ratio, scale, bgColor, borderColor, corners }) => {
  if (!visible || !imageUrl.trim()) return null;
  // Builder shape convention: "Auto" ratio renders as a round image (independent
  // of imageCorners); every other explicit W:H ratio renders at that aspect with
  // imageCorners driving the corner radius (0 = square corners).
  const isAutoRatio = String(ratio || '').trim().toLowerCase() === 'auto';
  const ratioValue = parseAuthLogoRatio(ratio);
  const width = AUTH_LOGO_BASE_WIDTH;
  const height = isAutoRatio ? width : Math.round(width / ratioValue);
  const borderRadius = isAutoRatio ? width / 2 : corners;
  return (
    <View
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: bgColor,
        borderWidth: borderColor?.trim() ? 1 : 0,
        borderColor,
        alignSelf: 'center',
        marginBottom: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Image
        source={{ uri: imageUrl }}
        style={{ width, height }}
        resizeMode={scale === 'fill' ? 'cover' : 'contain'}
      />
    </View>
  );
};

const AuthSkeletonBone = ({ style }: { style?: any }) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.85],
  });

  return <Animated.View style={[authSkeletonStyles.bone, style, { opacity }]} />;
};

const AuthLayoutSkeleton = () => (
  <SafeAreaView style={[authSkeletonStyles.safeArea, { backgroundColor: getPageBgColorSync() || '#F8FAFC' }]}>
    <View style={authSkeletonStyles.content}>
      <AuthSkeletonBone style={authSkeletonStyles.titleLine} />
      <View style={authSkeletonStyles.card}>
        <AuthSkeletonBone style={authSkeletonStyles.inputLine} />
        <AuthSkeletonBone style={authSkeletonStyles.inputLine} />
        <AuthSkeletonBone style={authSkeletonStyles.buttonLine} />
        <AuthSkeletonBone style={authSkeletonStyles.footerLine} />
      </View>
    </View>
  </SafeAreaView>
);

const authSkeletonStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    gap: 14,
  },
  bone: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerTitle: {
    width: 116,
    height: 18,
    borderRadius: 6,
  },
  titleLine: {
    width: '54%',
    height: 22,
    borderRadius: 8,
    marginBottom: 16,
  },
  inputLine: {
    width: '100%',
    height: 50,
    borderRadius: 10,
  },
  buttonLine: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    marginTop: 4,
  },
  footerLine: {
    width: '58%',
    height: 14,
    alignSelf: 'center',
    borderRadius: 6,
    marginTop: 8,
  },
});

// Builder's button-icon dropdown offers a fixed 9-icon FontAwesome set —
// mapped to their FontAwesome6 solid names (a couple were renamed in FA6).
const BUTTON_ICON_NAME_MAP: Record<string, string> = {
  heart: 'heart',
  star: 'star',
  tag: 'tag',
  gift: 'gift',
  fire: 'fire',
  bell: 'bell',
  cart: 'cart-shopping',
  truck: 'truck',
  info: 'circle-info',
};

const resolveButtonIconName = (value: string): string | null => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  return BUTTON_ICON_NAME_MAP[key] ?? key;
};

// ─── Main screen ─────────────────────────────────────────────────────────────

const AuthScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { login, signup, recoverPassword, session, initializing } = useAuth();
  const { height: viewportHeight } = useWindowDimensions();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [forgotFieldValues, setForgotFieldValues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signInTokens, setSignInTokens] = useState<SignInTokens>(() => themeAuthColorTokens(defaultSignInTokens));
  const [signUpTokens, setSignUpTokens] = useState<SignUpTokens>(() => themeAuthColorTokens(defaultSignUpTokens));
  const [forgotPasswordTokens, setForgotPasswordTokens] = useState<ForgotPasswordTokens>(() => themeAuthColorTokens(defaultForgotPasswordTokens));
  const [resetPasswordTokens, setResetPasswordTokens] = useState<ResetPasswordTokens>(defaultResetPasswordTokens);
  const [signInDslSections, setSignInDslSections] = useState<Record<string, unknown>[]>([]);
  const [signUpDslSections, setSignUpDslSections] = useState<Record<string, unknown>[]>([]);
  const [resetPasswordDslSections, setResetPasswordDslSections] = useState<Record<string, unknown>[]>([]);
  const [hasForgotPasswordSection, setHasForgotPasswordSection] = useState(false);
  const [dslLoaded, setDslLoaded] = useState(false);
  const [authLayoutBlocking, setAuthLayoutBlocking] = useState(true);
  const isMountedRef = useRef(true);
  const loginToastPendingRef = useRef(false);
  const currentModeRef = useRef<AuthMode>('login');
  const dslLoadedRef = useRef(false);
  const authLayoutBlockingRef = useRef(true);
  const authLayoutRequestSeqRef = useRef(0);
  const hasLiveSignInLayoutRef = useRef(false);
  const hasLiveSignUpLayoutRef = useRef(false);
  const hasLiveResetPasswordLayoutRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const emailRef = useRef('');

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    currentModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  const resetAuthFormFields = useCallback(() => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setForgotFieldValues({});
    setError('');
    setSuccessMessage('');
  }, []);

  const switchAuthMode = useCallback((nextMode: Exclude<AuthMode, 'forgot'>) => {
    if (currentModeRef.current === nextMode) return;
    currentModeRef.current = nextMode;
    resetAuthFormFields();
    setMode(nextMode);
  }, [resetAuthFormFields]);

  const openForgotPasswordMode = useCallback(() => {
    if (currentModeRef.current === 'forgot') return;
    currentModeRef.current = 'forgot';
    setPassword('');
    setFirstName('');
    setLastName('');
    setForgotFieldValues((prev) => ({ ...prev, email: emailRef.current }));
    setError('');
    setSuccessMessage('');
    setMode('forgot');
  }, []);

  const loadAuthLayout = useCallback(async (
    options: boolean | { showRefreshIndicator?: boolean; showBlockingSkeleton?: boolean } = {}
  ) => {
    const normalizedOptions = typeof options === 'boolean'
      ? { showRefreshIndicator: options }
      : options;
    const showRefreshIndicator = Boolean(normalizedOptions.showRefreshIndicator);
    const shouldBlockForLayout = Boolean(normalizedOptions.showBlockingSkeleton) || !dslLoadedRef.current;
    if (!shouldBlockForLayout && authLayoutBlockingRef.current) return;
    const requestSeq = authLayoutRequestSeqRef.current + 1;
    authLayoutRequestSeqRef.current = requestSeq;
    if (showRefreshIndicator) setRefreshing(true);
    if (shouldBlockForLayout) {
      authLayoutBlockingRef.current = true;
      setAuthLayoutBlocking(true);
    }
    try {
      const [signInDsl, signUpDsl, resetPasswordDsl] = await Promise.all([
        fetchDSL(undefined, 'signin'),
        fetchDSL(undefined, 'create-account'),
        fetchDSL(undefined, 'reset-password'),
      ]);
      if (!isMountedRef.current || authLayoutRequestSeqRef.current !== requestSeq) return;

      const liveSignInSections = Array.isArray(signInDsl?.dsl?.sections) ? signInDsl.dsl.sections : [];
      const liveSignUpSections = Array.isArray(signUpDsl?.dsl?.sections) ? signUpDsl.dsl.sections : [];
      const liveResetPasswordSections = Array.isArray(resetPasswordDsl?.dsl?.sections) ? resetPasswordDsl.dsl.sections : [];
      const hasLiveResetPasswordPage = hasAuthSections(
        liveResetPasswordSections,
        (section) => isResetPasswordSection(section) && !isGeneratedFallbackSection(section)
      );
      const resetPasswordSections = hasLiveResetPasswordPage
        ? liveResetPasswordSections
        : hasLiveResetPasswordLayoutRef.current
          ? null
          : [];
      const hasLiveSignInPage = hasAuthSections(liveSignInSections, (section) =>
        (isSignInSection(section) || isForgotPasswordSection(section)) && !isGeneratedFallbackSection(section)
      );
      const hasLiveSignUpPage = hasAuthSections(
        liveSignUpSections,
        (section) => isSignUpSection(section) && !isGeneratedFallbackSection(section)
      );
      const hasLiveSignUpInSignInPage = hasAuthSections(
        liveSignInSections,
        (section) => isSignUpSection(section) && !isGeneratedFallbackSection(section)
      );
      const resolvedLiveSignUpSections = hasLiveSignUpPage
        ? liveSignUpSections
        : hasLiveSignUpInSignInPage
          ? liveSignInSections
          : [];
      const signInSections = hasLiveSignInPage
        ? liveSignInSections
        : hasLiveSignInLayoutRef.current
          ? null
          : (authLayoutFallback.sections || []);
      const hasResolvedLiveSignUpPage = hasLiveSignUpPage || hasLiveSignUpInSignInPage;
      const signUpSections = hasResolvedLiveSignUpPage
        ? resolvedLiveSignUpSections
        : hasLiveSignUpLayoutRef.current
          ? null
          : [];

      if (signInSections) {
        const signInSection = signInSections.find(isSignInSection);
        const forgotSection = signInSections.find(isForgotPasswordSection);
        const signInRawProps = signInSection ? getSectionRawProps(signInSection) : {};
        const forgotRawProps = forgotSection ? getSectionRawProps(forgotSection) : {};
        const nextSignInTokens = signInSection ? buildSignInTokens(signInRawProps) : themeAuthColorTokens(defaultSignInTokens);
        const hasEnabledForgotPasswordSection =
          Boolean(forgotSection) && hasLiveSignInPage && isForgotPasswordEnabled(forgotRawProps);
        setSignInDslSections(signInSections as Record<string, unknown>[]);
        setHasForgotPasswordSection(hasEnabledForgotPasswordSection || nextSignInTokens.forgotPasswordVisible);
        setSignInTokens(nextSignInTokens);
        setForgotPasswordTokens(
          forgotSection
            ? buildForgotPasswordTokens(forgotRawProps)
            : nextSignInTokens.forgotPasswordVisible
              ? buildEmbeddedForgotPasswordTokens(signInRawProps)
              : themeAuthColorTokens(defaultForgotPasswordTokens)
        );
        if (hasLiveSignInPage) hasLiveSignInLayoutRef.current = true;
      }

      if (signUpSections) {
        const signUpSection = signUpSections.find(isSignUpSection);
        setSignUpDslSections(signUpSections as Record<string, unknown>[]);
        setSignUpTokens(signUpSection ? buildSignUpTokens(getSectionRawProps(signUpSection)) : themeAuthColorTokens(defaultSignUpTokens));
        if (hasResolvedLiveSignUpPage) hasLiveSignUpLayoutRef.current = true;
      }

      if (resetPasswordSections) {
        const resetPasswordSection = resetPasswordSections.find(isResetPasswordSection);
        setResetPasswordTokens(resetPasswordSection ? buildResetPasswordTokens(getSectionRawProps(resetPasswordSection)) : defaultResetPasswordTokens);
        setResetPasswordDslSections(resetPasswordSections as Record<string, unknown>[]);
        if (hasLiveResetPasswordPage) hasLiveResetPasswordLayoutRef.current = true;
      }
    } finally {
      if (isMountedRef.current && authLayoutRequestSeqRef.current === requestSeq) {
        setRefreshing(false);
        dslLoadedRef.current = true;
        setDslLoaded(true);
        authLayoutBlockingRef.current = false;
        setAuthLayoutBlocking(false);
      }
    }
  }, []);

  useEffect(() => {
    if (session) {
      const displayName =
        session?.user?.name?.trim() ||
        session?.user?.email?.split('@')?.[0] ||
        session?.user?.email ||
        'User';
      const loginSuccessToast = loginToastPendingRef.current
        ? { message: `Successfully logged in, ${displayName}`, key: `${Date.now()}-${displayName}` }
        : undefined;
      loginToastPendingRef.current = false;

      const postLoginTarget = (route?.params as { postLoginTarget?: { name?: string; params?: Record<string, unknown> } } | undefined)?.postLoginTarget;
      const hasPostLoginTarget = Boolean(postLoginTarget?.name);

      // Precedence: an explicit caller-supplied postLoginTarget (e.g. "return to
      // checkout after login") wins over the designer's DSL-configured redirect,
      // which in turn wins over the hardcoded LayoutScreen fallback.
      let targetName = 'LayoutScreen';
      let targetParams: Record<string, unknown> | undefined;

      if (hasPostLoginTarget) {
        targetName = postLoginTarget?.name as string;
        targetParams = postLoginTarget?.params as Record<string, unknown> | undefined;
      } else {
        const activeTokens = currentModeRef.current === 'signup' ? signUpTokens : signInTokens;
        const dslTarget = activeTokens.selectScreen
          ? resolveDslNavigationTarget({
              navigateType: activeTokens.navigateTo === 'url' ? 'url' : undefined,
              target: activeTokens.selectScreen,
              navigateRef: activeTokens.selectScreen,
              label: activeTokens.selectScreen,
            })
          : null;
        if (dslTarget?.type === 'stack') {
          targetName = dslTarget.name;
          targetParams = dslTarget.params as Record<string, unknown> | undefined;
        }
      }

      const mergedParams = loginSuccessToast ? { ...(targetParams || {}), loginSuccessToast } : targetParams;

      navigation.reset({ index: 0, routes: [{ name: targetName as never, params: mergedParams as never }] });
    }
  }, [session, navigation, route?.params, signInTokens, signUpTokens]);

  useEffect(() => { loadAuthLayout(); }, [loadAuthLayout]);

  useEffect(() => {
    const id = setInterval(() => { loadAuthLayout(); }, LIVE_DSL_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadAuthLayout]);

  useFocusEffect(useCallback(() => { loadAuthLayout(); }, [loadAuthLayout]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if ((previousState === 'background' || previousState === 'inactive') && nextState === 'active') {
        loadAuthLayout({ showBlockingSkeleton: true });
      }
    });
    return () => subscription.remove();
  }, [loadAuthLayout]);

  const initialAuthMode = (route?.params as { initialMode?: string } | undefined)?.initialMode;

  useEffect(() => {
    const initialMode = initialAuthMode;
    if (initialMode === 'signup' || initialMode === 'login') switchAuthMode(initialMode);
    if (initialMode === 'forgot' || initialMode === 'forgot-password') openForgotPasswordMode();
  }, [initialAuthMode, switchAuthMode, openForgotPasswordMode]);

  const t = mode === 'signup' ? signUpTokens : signInTokens;

  const toggleMode = () => {
    switchAuthMode(currentModeRef.current === 'login' ? 'signup' : 'login');
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (currentModeRef.current === 'forgot') {
      setForgotFieldValues((prev) => ({ ...prev, email: value }));
    }
    if (successMessage) setSuccessMessage('');
  };

  const handleForgotFieldChange = useCallback((key: string, value: string) => {
    setForgotFieldValues((prev) => ({ ...prev, [key]: value }));
    if (key.includes('email')) setEmail(value);
    if (successMessage) setSuccessMessage('');
  }, [successMessage]);

  const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const resolveForgotPasswordErrorMessage = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err || '');
    if (/storefront|http\s*40[13]|unauthorized|forbidden|token/i.test(message)) {
      return resetPasswordTokens.errorMessageText;
    }
    return message || resetPasswordTokens.errorMessageText;
  };

  const validateForm = () => {
    const e = email.trim(), p = password.trim(), fn = firstName.trim(), ln = lastName.trim();
    if (!e || !p) return 'Email and password are required.';
    if (!isValidEmailAddress(e)) return 'Enter a valid email address.';
    if (p.length < 6) return 'Use a password with at least 6 characters.';
    if (mode === 'signup') {
      if (signUpTokens.firstNameVisible && !fn) return 'Please enter your first name.';
      if (signUpTokens.lastNameVisible && !ln) return 'Please enter your last name.';
      if (p.length < 8) return 'Use a password with at least 8 characters for new accounts.';
      if (!/[A-Z]/.test(p) || !/[0-9]/.test(p)) return 'Include a number and an uppercase letter.';
    }
    return '';
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');
    if (loading) return;
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    try {
      setLoading(true);
      if (mode === 'login') {
        loginToastPendingRef.current = true;
        await login(email.trim(), password.trim());
      } else {
        loginToastPendingRef.current = false;
        const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();
        await signup(email.trim(), password.trim(), fullName);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    setError('');
    setSuccessMessage('');
    if (loading) return;
    const trimmedEmail = (forgotFieldValues.email ?? email).trim();
    if (!trimmedEmail) {
      setError(resetPasswordTokens.requiredMessage);
      return;
    }
    if (!isValidEmailAddress(trimmedEmail)) {
      setError(resetPasswordTokens.invalidEmailMessage);
      return;
    }
    try {
      setLoading(true);
      await recoverPassword(trimmedEmail);
      setSuccessMessage(resetPasswordTokens.successMessageText);
    } catch (err: unknown) {
      setError(resolveForgotPasswordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isForgotMode = mode === 'forgot';

  const buttonLabel = useMemo(() => {
    if (mode === 'forgot') return resetPasswordTokens.buttonText;
    const label = t.buttonText;
    return t.buttonAutoUppercase ? label.toUpperCase() : label;
  }, [mode, resetPasswordTokens.buttonText, t]);

  const buttonWidthStyle = useMemo(() => {
    if (mode === 'forgot') return { alignSelf: 'stretch' as const };
    const w = t.buttonWidth;
    if (w > 0 && w < 100) return { width: `${w}%` as const, alignSelf: 'center' as const };
    return { alignSelf: 'stretch' as const };
  }, [mode, t.buttonWidth]);

  const submitButtonTextColor = isForgotMode ? resetPasswordTokens.buttonTextColor : t.buttonTextColor;
  const submitButtonFontSize = isForgotMode ? resetPasswordTokens.buttonFontSize : t.buttonFontSize;
  const submitButtonFontFamily = isForgotMode ? resetPasswordTokens.buttonFontFamily : t.buttonFontFamily;
  const submitButtonFontWeight = isForgotMode ? resetPasswordTokens.buttonFontWeight : t.buttonFontWeight;
  // SignIn's Icons toggle key is `iconsVisible`; SignUp's is the distinct
  // `buttonIconsVisible`; Reset Password's is `buttonIconVisible` — none of
  // these alias each other in the Inspector.
  const submitIconsVisible = isForgotMode
    ? resetPasswordTokens.buttonIconVisible
    : mode === 'signup'
      ? signUpTokens.buttonIconsVisible
      : signInTokens.iconsVisible;
  const submitButtonIconName = !submitIconsVisible
    ? null
    : resolveButtonIconName(isForgotMode ? resetPasswordTokens.buttonIcon : t.buttonIcon);
  const submitButtonIconSize = isForgotMode ? resetPasswordTokens.buttonIconSize : t.buttonIconSize;
  const submitButtonIconColor = isForgotMode ? resetPasswordTokens.buttonIconColor : t.buttonIconColor;
  const submitButtonIconAlign = isForgotMode ? resetPasswordTokens.buttonIconAlign : t.buttonIconAlignment;

  // Reset Password's "Text" sub-card (under Button) has its own eye toggle
  // (visibility.buttonText) — no equivalent exists for SignIn/SignUp, so
  // this only ever hides the label in forgot mode.
  const submitTextVisible = !isForgotMode || resetPasswordTokens.buttonTextVisible;
  const submitButtonText = submitTextVisible ? (
    <Text
      allowFontScaling={false}
      style={{
        color: submitButtonTextColor,
        fontSize: submitButtonFontSize,
        fontWeight: submitButtonFontWeight as any,
        fontFamily: submitButtonFontFamily !== 'System' ? submitButtonFontFamily : undefined,
        fontStyle: isForgotMode ? resetPasswordTokens.buttonFontStyle : t.buttonTextFontStyle,
        textDecorationLine: isForgotMode ? resetPasswordTokens.buttonTextDecoration : t.buttonTextTextDecoration,
        textTransform: isForgotMode && resetPasswordTokens.buttonUppercase ? 'uppercase' : 'none',
      }}
    >
      {buttonLabel}
    </Text>
  ) : null;

  const submitIconOnRight = String(submitButtonIconAlign || '').toLowerCase() === 'right';
  const submitButtonContent = loading ? (
    <ActivityIndicator color={submitButtonTextColor} />
  ) : submitButtonIconName ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {submitIconOnRight ? null : (
        <Icon name={submitButtonIconName} size={submitButtonIconSize} color={submitButtonIconColor} />
      )}
      {submitButtonText}
      {submitIconOnRight ? (
        <Icon name={submitButtonIconName} size={submitButtonIconSize} color={submitButtonIconColor} />
      ) : null}
    </View>
  ) : (
    submitButtonText
  );

  const signInDecorSections = useMemo(
    () =>
      signInDslSections.filter((section) => {
        return isAllowedAuthDecorSection(section);
      }),
    [signInDslSections]
  );

  const hasDynamicSignInLayout = mode === 'login' && signInDecorSections.length > 0;
  const signUpDecorSections = useMemo(
    () =>
      signUpDslSections.filter((section) => {
        return isAllowedAuthDecorSection(section);
      }),
    [signUpDslSections]
  );

  const hasDynamicSignUpLayout = mode === 'signup' && signUpDecorSections.length > 0;
  // Reset Password's page DSL may hold other Builder blocks placed alongside
  // the reset_password form (logo, image, extra text, etc.) — these were
  // fetched into resetPasswordDslSections but never rendered, so the APK
  // only ever showed the fixed heading/input/button, never anything else
  // the merchant dragged onto that page in Builder. Builder's own array
  // order IS the merchant's drag-and-drop sequence (fetchDSL returns
  // dsl.sections in the same order they were saved), so split on the
  // reset_password section's own index instead of dumping everything above
  // the form — a block placed below the form in Builder must render below
  // it here too, not get hoisted above.
  const resetPasswordFormIndex = useMemo(
    () => resetPasswordDslSections.findIndex(isResetPasswordSection),
    [resetPasswordDslSections]
  );
  const resetPasswordDecorBefore = useMemo(
    () =>
      (resetPasswordFormIndex < 0
        ? resetPasswordDslSections
        : resetPasswordDslSections.slice(0, resetPasswordFormIndex)
      ).filter((section) => isAllowedAuthDecorSection(section)),
    [resetPasswordDslSections, resetPasswordFormIndex]
  );
  const resetPasswordDecorAfter = useMemo(
    () =>
      (resetPasswordFormIndex < 0
        ? []
        : resetPasswordDslSections.slice(resetPasswordFormIndex + 1)
      ).filter((section) => isAllowedAuthDecorSection(section)),
    [resetPasswordDslSections, resetPasswordFormIndex]
  );
  const hasDynamicResetPasswordLayout = isForgotMode && resetPasswordDecorBefore.length > 0;
  const activeResetPasswordDecorAfter = useMemo(
    () => resetPasswordDecorAfter.map((section) => withAuthViewport(section, viewportHeight)),
    [resetPasswordDecorAfter, viewportHeight]
  );
  const activeDecorSections = useMemo(
    () =>
      (mode === 'signup'
        ? signUpDecorSections
        : mode === 'forgot'
          ? resetPasswordDecorBefore
          : signInDecorSections
      ).map((section) => withAuthViewport(section, viewportHeight)),
    [mode, signInDecorSections, signUpDecorSections, resetPasswordDecorBefore, viewportHeight]
  );

  if (!dslLoaded || authLayoutBlocking) return <AuthLayoutSkeleton />;

  const pagePadLeft = t.pagePaddingLeft;
  const pagePadRight = t.pagePaddingRight;
  // Page background follows Brand Kit's "Page Background" (colors.pageBg) like
  // every other screen — unless the auth block's own bgColor was explicitly
  // set to a real (non-default) value, which then wins.
  const AUTH_NEUTRAL_BGS = new Set(['#f3f7f7', '#f8fafa', '#f8fafc', '#ffffff', '#fff', '']);
  const rawAuthPageBg = isForgotMode ? resetPasswordTokens.cardBgColor : t.bgColor;
  const activePageBgColor = AUTH_NEUTRAL_BGS.has(String(rawAuthPageBg || '').trim().toLowerCase())
    ? (getPageBgColorSync() || rawAuthPageBg || '#FFFFFF')
    : rawAuthPageBg;
  const pagePadTop = resolveAuthVerticalSpace(t.pagePaddingTop, viewportHeight, 0.06);
  const pagePadBottom = resolveAuthVerticalSpace(t.pagePaddingBottom, viewportHeight, 0.06);
  const cardPadTop = resolveAuthVerticalSpace(t.cardPaddingTop, viewportHeight, 0.055);
  const cardPadBottom = resolveAuthVerticalSpace(t.cardPaddingBottom, viewportHeight, 0.055);
  // Card / input background = the block's own "Background & Padding" colour
  // straight from the DSL (Builder's SignUp B&P panel writes it as
  // cardBgColor). NOT the Brand Kit page background — that's the screen
  // wrapper (activePageBgColor) only. Input text/placeholder colours
  // auto-contrast against whatever this resolves to (see _autoContrastText).
  const activeCardBgColor = isForgotMode ? resetPasswordTokens.cardBgColor : t.cardBgColor;
  const activeCardBorderRadius = isForgotMode ? resetPasswordTokens.cardBorderRadius : t.cardBorderRadius;
  const activeCardBorderWidth = isForgotMode ? resetPasswordTokens.cardBorderWidth : t.cardBorderWidth;
  const activeCardBorderColor = isForgotMode ? resetPasswordTokens.cardBorderColor : t.cardBorderColor;
  const activeCardPaddingTop = isForgotMode
    ? resolveAuthVerticalSpace(resetPasswordTokens.cardPaddingTop, viewportHeight, 0.055)
    : cardPadTop;
  const activeCardPaddingBottom = isForgotMode
    ? resolveAuthVerticalSpace(resetPasswordTokens.cardPaddingBottom, viewportHeight, 0.055)
    : cardPadBottom;
  const activeCardPaddingLeft = isForgotMode ? resetPasswordTokens.cardPaddingLeft : t.cardPaddingLeft;
  const activeCardPaddingRight = isForgotMode ? resetPasswordTokens.cardPaddingRight : t.cardPaddingRight;
  const titleFormGap = resolveAuthVerticalSpace(t.formGap, viewportHeight, 0.03);
  const fieldGap = resolveAuthVerticalSpace(t.fieldGap, viewportHeight, 0.03);
  const buttonMarginTop = resolveAuthVerticalSpace(
    isForgotMode ? resetPasswordTokens.buttonMarginTop : t.buttonMarginTop,
    viewportHeight,
    0.025
  );
  // Builder's SignIn/SignUp PreviewLive.tsx hardcode the button→footer gap at
  // 18px (never DSL-driven) — enforce that as a floor so a stale/small
  // footerMarginTop in the DSL can't collapse the gap on the Create Account
  // screen the way it was.
  const footerMarginTop = Math.max(
    resolveAuthVerticalSpace(t.footerMarginTop, viewportHeight, 0.04),
    18
  );
  const footerLinkMarginTop = resolveAuthVerticalSpace(t.footerLinkMarginTop, viewportHeight, 0.02);
  const formCardMarginBottom = resolveAuthVerticalSpace(t.formCardMarginBottom, viewportHeight, 0.04);
  const forgotLoginLinkMarginTop = resolveAuthVerticalSpace(forgotPasswordTokens.loginLinkMarginTop, viewportHeight, 0.08);
  const hasDynamicDecor = hasDynamicSignInLayout || hasDynamicSignUpLayout || hasDynamicResetPasswordLayout;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activePageBgColor }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: pagePadBottom }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAuthLayout(true)} />}
        >
          {/* ── Page title ─────────────────────────────────────────────── */}
          {hasDynamicSignInLayout || hasDynamicSignUpLayout || hasDynamicResetPasswordLayout ? (
            activeDecorSections.map((section, index) => (
              <DynamicRenderer key={`${mode}-dsl-${index}`} section={section as any} />
            ))
          ) : (
          <View style={{ paddingLeft: pagePadLeft, paddingRight: pagePadRight, paddingTop: pagePadTop, paddingBottom: titleFormGap }}>
            {mode === 'login' && t.authVisible ? (
              <Text
                style={{
                  color: signInTokens.titleColor,
                  fontSize: signInTokens.headlineSize,
                  fontWeight: signInTokens.headlineWeight as any,
                  fontFamily: signInTokens.headlineFontFamily !== 'System' ? signInTokens.headlineFontFamily : undefined,
                  fontStyle: signInTokens.headlineFontStyle,
                  textDecorationLine: signInTokens.headlineTextDecoration,
                }}
              >
                {signInTokens.authTitle}
              </Text>
            ) : null}

            {mode === 'signup' && signUpTokens.authVisible ? (
              <Text
                style={{
                  color: signUpTokens.headerTitleColor,
                  fontSize: signUpTokens.headerTitleFontSize,
                  fontWeight: signUpTokens.headerTitleFontWeight as any,
                  fontFamily: signUpTokens.headerTitleFontFamily !== 'System' ? signUpTokens.headerTitleFontFamily : undefined,
                  // headerTitleFontStyle/headerTitleTextDecoration are never
                  // resolved from rawProps (permanently stuck at 'normal'/
                  // 'none') — headlineFontStyle/headlineTextDecoration ARE
                  // correctly computed from authTitleItalic/Underline/
                  // Strikethrough, just never read here until now.
                  fontStyle: signUpTokens.headlineFontStyle,
                  textDecorationLine: signUpTokens.headlineTextDecoration,
                }}
              >
                {signUpTokens.headerTitle}
              </Text>
            ) : null}
          </View>
          )}

          {/* ── Form card ──────────────────────────────────────────────── */}
          <View
            style={{
              marginLeft: pagePadLeft,
              marginRight: pagePadRight,
              backgroundColor: activeCardBgColor,
              borderRadius: activeCardBorderRadius,
              borderWidth: activeCardBorderWidth,
              borderColor: activeCardBorderColor,
              paddingLeft: activeCardPaddingLeft,
              paddingRight: activeCardPaddingRight,
              paddingTop: activeCardPaddingTop,
              paddingBottom: activeCardPaddingBottom,
              marginTop: hasDynamicDecor ? titleFormGap : 0,
              marginBottom: formCardMarginBottom,
            }}
          >
            {/* Logo */}
            {mode === 'login' ? (
              <AuthLogo
                visible={signInTokens.logoVisible}
                imageUrl={signInTokens.logoImageUrl}
                ratio={signInTokens.logoRatio}
                scale={signInTokens.logoScale}
                bgColor={signInTokens.logoBgColor}
                borderColor={signInTokens.logoBorderColor}
                corners={signInTokens.logoCorners}
              />
            ) : null}
            {mode === 'signup' ? (
              <AuthLogo
                visible={signUpTokens.logoVisible}
                imageUrl={signUpTokens.logoImageUrl}
                ratio={signUpTokens.logoRatio}
                scale={signUpTokens.logoScale}
                bgColor={signUpTokens.logoBgColor}
                borderColor={signUpTokens.logoBorderColor}
                corners={signUpTokens.logoCorners}
              />
            ) : null}

            {mode === 'forgot' && resetPasswordTokens.headingVisible && resetPasswordTokens.headingText ? (
              <Text
                style={{
                  color: resetPasswordTokens.descriptionColor,
                  marginBottom: fieldGap,
                  fontSize: resetPasswordTokens.descriptionFontSize,
                  fontWeight: resetPasswordTokens.descriptionFontWeight as any,
                  fontFamily: resetPasswordTokens.descriptionFontFamily !== 'System' ? resetPasswordTokens.descriptionFontFamily : undefined,
                  fontStyle: resetPasswordTokens.descriptionFontStyle,
                  textDecorationLine: resetPasswordTokens.descriptionTextDecoration,
                  lineHeight: resetPasswordTokens.descriptionFontSize * resetPasswordTokens.descriptionLineHeight,
                  letterSpacing: resetPasswordTokens.descriptionLetterSpacing,
                  textAlign: resetPasswordTokens.descriptionAlign,
                }}
              >
                {resetPasswordTokens.headingText}
              </Text>
            ) : null}

            {/* First Name */}
            {mode === 'signup' && signUpTokens.firstNameVisible ? (
              <FormField
                label={signUpTokens.firstNameLabelText}
                labelVisible={signUpTokens.firstNameLabelVisible}
                labelColor={signUpTokens.firstNameLabelColor}
                labelFontSize={signUpTokens.firstNameLabelFontSize}
                labelFontFamily={signUpTokens.firstNameLabelFontFamily}
                labelFontWeight={signUpTokens.firstNameLabelFontWeight}
                labelAlign="left"
                placeholder={signUpTokens.firstNamePlaceholder}
                placeholderVisible={signUpTokens.firstNamePlaceholderVisible}
                placeholderColor={signUpTokens.firstNamePlaceholderColor}
                placeholderFontSize={signUpTokens.firstNamePlaceholderFontSize}
                placeholderFontFamily={signUpTokens.firstNamePlaceholderFontFamily}
                placeholderFontWeight={signUpTokens.firstNamePlaceholderFontWeight}
                placeholderFontStyle={signUpTokens.firstNamePlaceholderFontStyle}
                placeholderTextDecoration={signUpTokens.firstNamePlaceholderTextDecoration}
                value={firstName}
                onChangeText={setFirstName}
                inputColor={signUpTokens.firstNameInputTextColor}
                inputFontSize={signUpTokens.firstNameInputTextFontSize}
                inputFontFamily={signUpTokens.firstNameInputTextFontFamily}
                inputFontWeight={signUpTokens.firstNameInputTextFontWeight}
                inputAlign={toTextAlign(signUpTokens.firstNameInputTextAlignment)}
                inputBorderColor={signUpTokens.inputBorderColor}
                inputBorderRadius={signUpTokens.inputBorderRadius}
                inputHeight={signUpTokens.inputHeight}
                fieldGap={fieldGap}
                inputPaddingHorizontal={signUpTokens.inputPaddingHorizontal}
                inputPaddingVertical={signUpTokens.inputPaddingVertical}
                cardBgColor={activeCardBgColor}
                autoCapitalize="words"
              />
            ) : null}

            {/* Last Name */}
            {mode === 'signup' && signUpTokens.lastNameVisible ? (
              <FormField
                label={signUpTokens.lastNameLabelText}
                labelVisible={signUpTokens.lastNameLabelVisible}
                labelColor={signUpTokens.lastNameLabelColor}
                labelFontSize={signUpTokens.lastNameLabelFontSize}
                labelFontFamily={signUpTokens.lastNameLabelFontFamily}
                labelFontWeight={signUpTokens.lastNameLabelFontWeight}
                labelAlign="left"
                placeholder={signUpTokens.lastNamePlaceholder}
                placeholderVisible={signUpTokens.lastNamePlaceholderVisible}
                placeholderColor={signUpTokens.lastNamePlaceholderColor}
                placeholderFontSize={signUpTokens.lastNamePlaceholderFontSize}
                placeholderFontFamily={signUpTokens.lastNamePlaceholderFontFamily}
                placeholderFontWeight={signUpTokens.lastNamePlaceholderFontWeight}
                placeholderFontStyle={signUpTokens.lastNamePlaceholderFontStyle}
                placeholderTextDecoration={signUpTokens.lastNamePlaceholderTextDecoration}
                value={lastName}
                onChangeText={setLastName}
                inputColor={signUpTokens.lastNameInputTextColor}
                inputFontSize={signUpTokens.lastNameInputTextFontSize}
                inputFontFamily={signUpTokens.lastNameInputTextFontFamily}
                inputFontWeight={signUpTokens.lastNameInputTextFontWeight}
                inputAlign={toTextAlign(signUpTokens.lastNameInputTextAlignment)}
                inputBorderColor={signUpTokens.inputBorderColor}
                inputBorderRadius={signUpTokens.inputBorderRadius}
                inputHeight={signUpTokens.inputHeight}
                fieldGap={fieldGap}
                inputPaddingHorizontal={signUpTokens.inputPaddingHorizontal}
                inputPaddingVertical={signUpTokens.inputPaddingVertical}
                cardBgColor={activeCardBgColor}
                autoCapitalize="words"
              />
            ) : null}

            {/* Reset Password email field — Builder's reset_password component has exactly
                one hardcoded email input (no dynamic field list, no label). */}
            {mode === 'forgot' && resetPasswordTokens.inputVisible ? (
              <FormField
                label=""
                labelVisible={false}
                labelColor={resetPasswordTokens.inputTextColor}
                labelAlign="left"
                placeholder={resetPasswordTokens.inputPlaceholderVisible ? resetPasswordTokens.emailPlaceholder : ''}
                placeholderVisible={resetPasswordTokens.inputPlaceholderVisible}
                placeholderColor={resetPasswordTokens.emailPlaceholderColor}
                placeholderFontSize={resetPasswordTokens.emailPlaceholderFontSize}
                placeholderFontFamily={resetPasswordTokens.emailPlaceholderFontFamily}
                placeholderFontWeight={resetPasswordTokens.emailPlaceholderFontWeight}
                placeholderFontStyle={resetPasswordTokens.emailPlaceholderFontStyle}
                placeholderTextDecoration={resetPasswordTokens.emailPlaceholderTextDecoration}
                value={forgotFieldValues.email ?? email}
                onChangeText={(value) => handleForgotFieldChange('email', value)}
                inputColor={resetPasswordTokens.inputTextColor}
                inputFontSize={resetPasswordTokens.inputFontSize}
                inputFontFamily={resetPasswordTokens.inputFontFamily}
                inputFontWeight={resetPasswordTokens.inputFontWeight}
                inputAlign="left"
                inputBorderColor={resetPasswordTokens.inputBorderColor}
                inputBorderRadius={resetPasswordTokens.inputBorderRadius}
                inputHeight={resetPasswordTokens.inputHeight}
                fieldGap={fieldGap}
                inputPaddingHorizontal={resetPasswordTokens.inputPaddingHorizontal}
                inputPaddingVertical={resetPasswordTokens.inputPaddingVertical}
                cardBgColor={resetPasswordTokens.inputBgColor}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}

            {/* Email */}
            {mode !== 'forgot' &&
            (mode === 'login' ? signInTokens.emailInputVisible : signUpTokens.emailInputVisible) ? (
              <FormField
                label={mode !== 'signup' ? signInTokens.emailLabelText : signUpTokens.emailLabelText}
                labelVisible={mode !== 'signup' ? signInTokens.emailLabelVisible : signUpTokens.emailLabelVisible}
                labelColor={mode !== 'signup' ? signInTokens.emailLabelColor : signUpTokens.emailLabelColor}
                labelFontSize={mode !== 'signup' ? signInTokens.emailLabelFontSize : signUpTokens.emailLabelFontSize}
                labelFontFamily={mode !== 'signup' ? signInTokens.emailLabelFontFamily : signUpTokens.emailLabelFontFamily}
                labelFontWeight={mode !== 'signup' ? signInTokens.emailLabelFontWeight : signUpTokens.emailLabelFontWeight}
                labelAlign="left"
                placeholder={mode !== 'signup' ? signInTokens.emailPlaceholder : signUpTokens.emailPlaceholder}
                placeholderVisible={mode !== 'signup' ? signInTokens.emailPlaceholderVisible : signUpTokens.emailPlaceholderVisible}
                placeholderColor={mode !== 'signup' ? signInTokens.emailPlaceholderColor : signUpTokens.emailPlaceholderColor}
                placeholderFontSize={mode !== 'signup' ? signInTokens.emailPlaceholderFontSize : signUpTokens.emailPlaceholderFontSize}
                placeholderFontFamily={mode !== 'signup' ? signInTokens.emailPlaceholderFontFamily : signUpTokens.emailPlaceholderFontFamily}
                placeholderFontWeight={mode !== 'signup' ? signInTokens.emailPlaceholderFontWeight : signUpTokens.emailPlaceholderFontWeight}
                placeholderFontStyle={mode !== 'signup' ? signInTokens.emailPlaceholderFontStyle : signUpTokens.emailPlaceholderFontStyle}
                placeholderTextDecoration={mode !== 'signup' ? signInTokens.emailPlaceholderTextDecoration : signUpTokens.emailPlaceholderTextDecoration}
                value={email}
                onChangeText={handleEmailChange}
                inputColor={mode !== 'signup' ? signInTokens.emailInputTextColor : signUpTokens.emailInputTextColor}
                inputFontSize={mode !== 'signup' ? signInTokens.emailInputTextFontSize : signUpTokens.emailInputTextFontSize}
                inputFontFamily={mode !== 'signup' ? signInTokens.emailInputTextFontFamily : signUpTokens.emailInputTextFontFamily}
                inputFontWeight={mode !== 'signup' ? signInTokens.emailInputTextFontWeight : signUpTokens.emailInputTextFontWeight}
                inputAlign={mode === 'signup' ? toTextAlign(signUpTokens.emailInputTextAlignment) : 'left'}
                inputBorderColor={t.inputBorderColor}
                inputBorderRadius={t.inputBorderRadius}
                inputHeight={t.inputHeight}
                fieldGap={fieldGap}
                inputPaddingHorizontal={t.inputPaddingHorizontal}
                inputPaddingVertical={t.inputPaddingVertical}
                cardBgColor={activeCardBgColor}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}

            {/* Password */}
            {mode !== 'forgot' &&
            (mode === 'login' ? signInTokens.passwordInputVisible : signUpTokens.passwordInputVisible) ? (
              <FormField
                label={mode === 'login' ? signInTokens.passwordLabelText : signUpTokens.passwordLabelText}
                labelVisible={mode === 'login' ? signInTokens.passwordLabelVisible : signUpTokens.passwordLabelVisible}
                labelColor={mode === 'login' ? signInTokens.passwordLabelColor : signUpTokens.passwordLabelColor}
                labelFontSize={mode === 'login' ? signInTokens.passwordLabelFontSize : signUpTokens.passwordLabelFontSize}
                labelFontFamily={mode === 'login' ? signInTokens.passwordLabelFontFamily : signUpTokens.passwordLabelFontFamily}
                labelFontWeight={mode === 'login' ? signInTokens.passwordLabelFontWeight : signUpTokens.passwordLabelFontWeight}
                labelAlign="left"
                placeholder={mode === 'login' ? signInTokens.passwordPlaceholder : signUpTokens.passwordPlaceholder}
                placeholderVisible={mode === 'login' ? signInTokens.passwordPlaceholderVisible : signUpTokens.passwordPlaceholderVisible}
                placeholderColor={mode === 'login' ? signInTokens.passwordPlaceholderColor : signUpTokens.passwordPlaceholderColor}
                placeholderFontSize={mode === 'login' ? signInTokens.passwordPlaceholderFontSize : signUpTokens.passwordPlaceholderFontSize}
                placeholderFontFamily={mode === 'login' ? signInTokens.passwordPlaceholderFontFamily : signUpTokens.passwordPlaceholderFontFamily}
                placeholderFontWeight={mode === 'login' ? signInTokens.passwordPlaceholderFontWeight : signUpTokens.passwordPlaceholderFontWeight}
                placeholderFontStyle={mode === 'login' ? signInTokens.passwordPlaceholderFontStyle : signUpTokens.passwordPlaceholderFontStyle}
                placeholderTextDecoration={mode === 'login' ? signInTokens.passwordPlaceholderTextDecoration : signUpTokens.passwordPlaceholderTextDecoration}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                inputColor={mode === 'login' ? signInTokens.passwordInputTextColor : signUpTokens.passwordInputTextColor}
                inputFontSize={mode === 'login' ? signInTokens.passwordInputTextFontSize : signUpTokens.passwordInputTextFontSize}
                inputFontFamily={mode === 'login' ? signInTokens.passwordInputTextFontFamily : signUpTokens.passwordInputTextFontFamily}
                inputFontWeight={mode === 'login' ? signInTokens.passwordInputTextFontWeight : signUpTokens.passwordInputTextFontWeight}
                inputAlign={mode === 'signup' ? toTextAlign(signUpTokens.passwordInputTextAlignment) : 'left'}
                inputBorderColor={t.inputBorderColor}
                inputBorderRadius={t.inputBorderRadius}
                inputHeight={t.inputHeight}
                fieldGap={fieldGap}
                inputPaddingHorizontal={t.inputPaddingHorizontal}
                inputPaddingVertical={t.inputPaddingVertical}
                cardBgColor={activeCardBgColor}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}

            {/* Error */}
            {error ? (
              <View
                style={{
                  backgroundColor: isForgotMode ? resetPasswordTokens.errorMessageBgColor : '#FEF2F2',
                  borderRadius: isForgotMode ? resetPasswordTokens.messageBorderRadius : 8,
                  padding: 10,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: isForgotMode ? resetPasswordTokens.errorMessageTextColor : '#DC2626',
                    fontSize: isForgotMode ? resetPasswordTokens.messageFontSize : 13,
                    fontWeight: (isForgotMode ? resetPasswordTokens.messageFontWeight : '500') as any,
                    fontFamily: isForgotMode && resetPasswordTokens.messageFontFamily !== 'System' ? resetPasswordTokens.messageFontFamily : undefined,
                  }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {successMessage ? (
              <View
                style={{
                  backgroundColor: isForgotMode ? resetPasswordTokens.successMessageBgColor : '#ECFDF5',
                  borderRadius: isForgotMode ? resetPasswordTokens.messageBorderRadius : 8,
                  padding: 10,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: isForgotMode ? resetPasswordTokens.successMessageTextColor : '#047857',
                    fontSize: isForgotMode ? resetPasswordTokens.messageFontSize : 13,
                    fontWeight: (isForgotMode ? resetPasswordTokens.messageFontWeight : '500') as any,
                    fontFamily: isForgotMode && resetPasswordTokens.messageFontFamily !== 'System' ? resetPasswordTokens.messageFontFamily : undefined,
                  }}
                >
                  {successMessage}
                </Text>
              </View>
            ) : null}

            {/* Submit button */}
            {(isForgotMode ? resetPasswordTokens.buttonVisible : (mode === 'login' ? signInTokens.buttonVisible : signUpTokens.buttonVisible)) ? (
              <TouchableOpacity
                onPress={isForgotMode ? handleForgotPasswordSubmit : handleSubmit}
                disabled={loading || initializing}
                style={[
                  {
                    backgroundColor: !isForgotMode && t.buttonGradient ? 'transparent' : isForgotMode ? (resetPasswordTokens.buttonBgVisible ? resetPasswordTokens.buttonFillColor : 'transparent') : t.buttonFillColor,
                    borderRadius: isForgotMode ? (resetPasswordTokens.buttonBgVisible ? resetPasswordTokens.buttonRadius : 0) : t.buttonRadius,
                    borderWidth: isForgotMode ? (resetPasswordTokens.buttonBgVisible ? resetPasswordTokens.buttonBorderWidth : 0) : t.buttonBorderWidth,
                    borderColor: isForgotMode ? resetPasswordTokens.buttonBorderColor : t.buttonBorderColor,
                    // Preview applies Padding Top/Bottom as real padding on
                    // top of a minHeight (not a fixed height) for
                    // login/signup too — using a hard `height` here made
                    // those sliders have zero visible effect on the APK.
                    minHeight: isForgotMode ? undefined : t.buttonHeight,
                    paddingTop: isForgotMode ? (resetPasswordTokens.buttonBgVisible ? resetPasswordTokens.buttonPaddingTop : 0) : t.buttonPaddingTop,
                    paddingBottom: isForgotMode ? (resetPasswordTokens.buttonBgVisible ? resetPasswordTokens.buttonPaddingBottom : 0) : t.buttonPaddingBottom,
                    paddingLeft: isForgotMode ? (resetPasswordTokens.buttonBgVisible ? resetPasswordTokens.buttonPaddingLeft : 0) : 16,
                    paddingRight: isForgotMode ? (resetPasswordTokens.buttonBgVisible ? resetPasswordTokens.buttonPaddingRight : 0) : 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: buttonMarginTop,
                    overflow: 'hidden',
                  },
                  buttonWidthStyle,
                ]}
              >
                {!isForgotMode && t.buttonGradient ? (
                  <LinearGradient
                    colors={t.buttonGradient.colors}
                    angle={t.buttonGradient.angle}
                    useAngle
                    style={{
                      width: '100%',
                      height: '100%',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: t.buttonRadius,
                    }}
                  >
                    {submitButtonContent}
                  </LinearGradient>
                ) : (
                  submitButtonContent
                )}
              </TouchableOpacity>
            ) : null}

            {/* Footer switcher — Builder's reset_password component has no back-to-login
                control at all, so forgot mode intentionally renders nothing here. */}
            {/* Builder (PreviewLive.tsx) renders this as a single <p> containing two
                <span>s — one plain, one clickable — so footerLinkAlignment's
                text-align applies to the whole flowed line as one unit. Mirrored
                here with a block Text containing nested inline Text runs (RN's
                equivalent of inline spans) instead of separate flex siblings,
                which used to get positioned independently and could end up
                stacked/misaligned relative to each other. */}
            {mode === 'forgot' ? null : t.footerVisible ? (
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: footerMarginTop,
                  width: '100%',
                  textAlign: toTextAlign(t.footerLinkAlignment, 'center'),
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    color: t.footerTextColor,
                    fontSize: t.footerTextFontSize,
                    fontFamily: t.footerTextFontFamily !== 'System' ? t.footerTextFontFamily : undefined,
                    fontWeight: t.footerTextFontWeight as any,
                    fontStyle: t.footerTextFontStyle,
                    textDecorationLine: t.footerTextTextDecoration,
                  }}
                >
                  {(mode === 'login' ? signInTokens.footerText : signUpTokens.footerText)}{' '}
                </Text>
                {(mode === 'login' || (signUpTokens.signInLinkVisible && signUpTokens.signInLinkTextVisible)) ? (
                  <Text
                    allowFontScaling={false}
                    onPress={toggleMode}
                    style={{
                      color: t.footerLinkColor,
                      fontSize: t.footerLinkFontSize,
                      fontWeight: t.footerLinkFontWeight as any,
                      fontFamily: t.footerLinkFontFamily !== 'System' ? t.footerLinkFontFamily : undefined,
                      fontStyle: t.footerLinkFontStyle,
                      textDecorationLine: t.footerLinkTextDecoration,
                    }}
                  >
                    {mode === 'login'
                      ? signInTokens.footerLinkText
                      : signUpTokens.footerLinkAutoUppercase
                        ? signUpTokens.footerLinkText.toUpperCase()
                        : signUpTokens.footerLinkText}
                  </Text>
                ) : null}
              </Text>
            ) : null}

            {/* Forgot password link (login only) — Preview wraps this headline in a
                styleable box (background/border/padding, PreviewLive.tsx:162-180);
                that box was never rendered here at all. */}
            {mode === 'login' && hasForgotPasswordSection && forgotPasswordTokens.headlineVisible ? (
              <TouchableOpacity
                onPress={openForgotPasswordMode}
                accessibilityRole="button"
                style={{
                  marginTop: forgotLoginLinkMarginTop,
                  alignSelf: toFlexAlign(forgotPasswordTokens.headlineTextAlign, 'center'),
                  ...(forgotPasswordTokens.bgPaddingVisible
                    ? {
                        backgroundColor: forgotPasswordTokens.bgColor,
                        borderRadius: forgotPasswordTokens.cardBorderRadius,
                        paddingTop: forgotPasswordTokens.cardPaddingTop,
                        paddingBottom: forgotPasswordTokens.cardPaddingBottom,
                        paddingLeft: forgotPasswordTokens.cardPaddingLeft,
                        paddingRight: forgotPasswordTokens.cardPaddingRight,
                        ...borderSideStyleWeb(forgotPasswordTokens.borderLine, forgotPasswordTokens.cardBorderWidth, forgotPasswordTokens.cardBorderColor),
                      }
                    : null),
                }}
              >
                <Text
                  style={{
                    color: forgotPasswordTokens.titleColor,
                    fontSize: forgotPasswordTokens.headlineFontSize,
                    fontWeight: forgotPasswordTokens.headlineFontWeight as any,
                    fontFamily: forgotPasswordTokens.headlineFontFamily !== 'System' ? forgotPasswordTokens.headlineFontFamily : undefined,
                    fontStyle: forgotPasswordTokens.headlineFontStyle,
                    textDecorationLine: forgotPasswordTokens.headlineTextDecoration,
                    textTransform: forgotPasswordTokens.headlineTextTransform,
                    textAlign: toTextAlign(forgotPasswordTokens.headlineTextAlign, 'center'),
                  }}
                >
                  {forgotPasswordTokens.headlineText}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Reset Password page blocks placed AFTER the form in Builder
              (by array order) render here, below the form card. */}
          {isForgotMode &&
            activeResetPasswordDecorAfter.map((section, index) => (
              <DynamicRenderer key={`forgot-dsl-after-${index}`} section={section as any} />
            ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AuthScreen;
