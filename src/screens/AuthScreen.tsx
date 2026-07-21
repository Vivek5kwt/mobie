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
import HeaderDefaultComponent from '../components/HeaderDefault';
import DynamicRenderer from '../engine/DynamicRenderer';
import { resolveFont } from '../services/typographyService';
import { resolveDslNavigationTarget } from '../utils/navigationTarget';

const LIVE_DSL_REFRESH_INTERVAL_MS = 30000;

type ButtonGradient = {
  colors: string[];
  angle: number;
};

type SignInTokens = {
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
  buttonVisible: boolean;
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
type ResetPasswordTokens = {
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
  inputTextColor: string;
  inputFontSize: number;
  inputFontFamily: string;
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
  firstDefined(
    rawProps?.buttontextColor,
    rawProps?.buttonTextColor,
    rawProps?.buttonColor,
    rawProps?.textColor
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

const getButtonFontWeightValue = (rawProps: Record<string, unknown>): unknown =>
  firstDefined(
    rawProps?.buttonfontWeight,
    rawProps?.buttonFontWeight,
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
  >
) => {
  const bgValue = getButtonBgValue(rawProps);
  return {
    buttonTextColor: (getButtonTextColorValue(rawProps) as string | undefined) ?? defaults.buttonTextColor,
    buttonFillColor: resolveButtonColor(bgValue, defaults.buttonFillColor),
    buttonGradient: resolveButtonGradient(bgValue),
    buttonFontSize: toNumber(getButtonFontSizeValue(rawProps), defaults.buttonFontSize),
    buttonFontFamily: toFontFamily(getButtonFontFamilyValue(rawProps), defaults.buttonFontFamily),
    buttonFontWeight: toFontWeight(getButtonFontWeightValue(rawProps), defaults.buttonFontWeight),
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

const defaultSignInTokens: SignInTokens = {
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
  footerLinkAlignment: 'Left',
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
const defaultResetPasswordTokens: ResetPasswordTokens = {
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
  inputTextColor: '#111827',
  inputFontSize: 14,
  inputFontFamily: 'Inter',
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
  buttonVisible: true,
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

const buildSignInTokens = (rawProps: Record<string, unknown>): SignInTokens => ({
  ...defaultSignInTokens,
  bgColor: (rawProps?.bgColor as string) ?? defaultSignInTokens.bgColor,
  titleColor: (rawProps?.titleColor as string) ?? defaultSignInTokens.titleColor,
  cardBgColor: (rawProps?.cardBgColor as string) ?? defaultSignInTokens.cardBgColor,
  cardBorderColor: (rawProps?.cardBorderColor as string) ?? defaultSignInTokens.cardBorderColor,
  cardBorderWidth: resolveBorderWidth(rawProps?.borderLine, rawProps?.cardBorderColor ?? rawProps?.borderColor, defaultSignInTokens.cardBorderWidth),
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
  buttonBorderColor: (rawProps?.buttonBorderColor as string) ?? defaultSignInTokens.buttonBorderColor,
  buttonBorderWidth: resolveBorderWidth(rawProps?.buttonBorderLine, rawProps?.buttonBorderColor, defaultSignInTokens.buttonBorderWidth),
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
  emailPlaceholderFontWeight: toFontWeight(rawProps?.emailPlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignInTokens.emailPlaceholderFontWeight, rawProps?.emailPlaceholderBold as boolean | undefined),
  passwordPlaceholderFontWeight: toFontWeight(rawProps?.passwordPlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignInTokens.passwordPlaceholderFontWeight, rawProps?.passwordPlaceholderBold as boolean | undefined),
  buttonHeight: toNumber(rawProps?.buttonHeight, defaultSignInTokens.buttonHeight),
  buttonWidth: toNumber(rawProps?.buttonWidth, defaultSignInTokens.buttonWidth),
  footerTextFontSize: toNumber(rawProps?.footerTextFontSize ?? rawProps?.subtextSize ?? rawProps?.fontSize, defaultSignInTokens.footerTextFontSize),
  footerTextFontFamily: toFontFamily(rawProps?.footerTextFontFamily ?? rawProps?.subtextFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.footerTextFontFamily),
  footerTextFontWeight: toFontWeight(rawProps?.footerTextFontWeight ?? rawProps?.subtextWeight ?? rawProps?.fontWeight, defaultSignInTokens.footerTextFontWeight),
  footerLinkFontSize: toNumber(rawProps?.footerLinkFontSize, defaultSignInTokens.footerLinkFontSize),
  footerLinkFontFamily: toFontFamily(rawProps?.footerLinkFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.footerLinkFontFamily),
  footerLinkFontWeight: toFontWeight(rawProps?.footerLinkFontWeight, defaultSignInTokens.footerLinkFontWeight),
  footerLinkAlignment: (rawProps?.footerLinkAlignment as string) ?? defaultSignInTokens.footerLinkAlignment,
  footerVisible: toBoolean(rawProps?.footerVisible, defaultSignInTokens.footerVisible),
  forgotPasswordVisible: toBoolean(rawProps?.forgotPasswordVisible, defaultSignInTokens.forgotPasswordVisible),
  authVisible: toBoolean(rawProps?.authVisible, defaultSignInTokens.authVisible),
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

const buildForgotPasswordTokens = (rawProps: Record<string, unknown>): ForgotPasswordTokens => ({
  ...defaultForgotPasswordTokens,
  bgColor: toLocalizedString(rawProps?.bgColor ?? rawProps?.backgroundColor, defaultForgotPasswordTokens.bgColor),
  titleColor: toLocalizedString(
    firstDefined(rawProps?.headlineColor, rawProps?.titleColor),
    defaultForgotPasswordTokens.titleColor
  ),
  cardBgColor: toLocalizedString(rawProps?.cardBgColor, defaultForgotPasswordTokens.cardBgColor),
  cardBorderColor: toLocalizedString(rawProps?.cardBorderColor, defaultForgotPasswordTokens.cardBorderColor),
  cardBorderWidth: resolveBorderWidth(rawProps?.borderLine, rawProps?.cardBorderColor ?? rawProps?.borderColor, defaultForgotPasswordTokens.cardBorderWidth),
  cardBorderRadius: toNumber(rawProps?.borderRadius, defaultForgotPasswordTokens.cardBorderRadius),
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

// Reads Builder's real "Reset Password" page component (`reset_password`). Its
// background/border/padding controls are nested under `buyNow`/`addToCart` (a
// schema borrowed from the AddToCart block) rather than the flat pt/pb/pl/pr keys
// used elsewhere in this file — confirmed by reading ResetPassword/Preview.tsx and
// Inspector.tsx directly. Input/button styling is intentionally NOT read here (see
// defaultResetPasswordTokens comment) since Builder's own canvas ignores those
// Inspector fields entirely.
const buildResetPasswordTokens = (rawProps: Record<string, unknown>): ResetPasswordTokens => {
  const buyNow = toRecord(rawProps?.buyNow);
  const addToCart = toRecord(rawProps?.addToCart);
  const visibility = toRecord(rawProps?.visibility);
  const showBgSection = toBoolean(firstDefined(visibility?.buyNowBgPadding), true);
  const heading = stripHtmlTags(
    toLocalizedString(
      firstDefined(rawProps?.headingText, rawProps?.title, rawProps?.heading),
      defaultResetPasswordTokens.headingText
    )
  );
  return {
    ...defaultResetPasswordTokens,
    headingText: heading || defaultResetPasswordTokens.headingText,
    descriptionColor: toLocalizedString(rawProps?.descriptionColor, defaultResetPasswordTokens.descriptionColor),
    descriptionFontSize: toNumber(rawProps?.descriptionFontSize, defaultResetPasswordTokens.descriptionFontSize),
    descriptionFontFamily: toFontFamily(rawProps?.descriptionFontFamily, defaultResetPasswordTokens.descriptionFontFamily),
    descriptionFontWeight: toFontWeight(rawProps?.descriptionFontWeight, defaultResetPasswordTokens.descriptionFontWeight),
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
    cardBorderWidth: showBgSection
      ? resolveBorderWidth(buyNow?.borderLine, buyNow?.borderColor, defaultResetPasswordTokens.cardBorderWidth)
      : 0,
    cardBorderRadius: showBgSection ? toNumber(addToCart?.contBorderRadius, defaultResetPasswordTokens.cardBorderRadius) : 0,
    cardPaddingTop: showBgSection ? toNumber(buyNow?.pt, defaultResetPasswordTokens.cardPaddingTop) : 0,
    cardPaddingBottom: showBgSection ? toNumber(buyNow?.pb, defaultResetPasswordTokens.cardPaddingBottom) : 0,
    cardPaddingLeft: showBgSection ? toNumber(buyNow?.pl, defaultResetPasswordTokens.cardPaddingLeft) : 0,
    cardPaddingRight: showBgSection ? toNumber(buyNow?.pr, defaultResetPasswordTokens.cardPaddingRight) : 0,
  };
};

const buildSignUpTokens = (rawProps: Record<string, unknown>): SignUpTokens => ({
  ...defaultSignUpTokens,
  bgColor: (rawProps?.bgColor as string) ?? defaultSignUpTokens.bgColor,
  titleColor: (rawProps?.titleColor as string) ?? defaultSignUpTokens.titleColor,
  cardBgColor: (rawProps?.cardBgColor as string) ?? defaultSignUpTokens.cardBgColor,
  cardBorderColor: (rawProps?.cardBorderColor as string) ?? defaultSignUpTokens.cardBorderColor,
  cardBorderWidth: resolveBorderWidth(rawProps?.borderLine, rawProps?.cardBorderColor ?? rawProps?.borderColor, defaultSignUpTokens.cardBorderWidth),
  // SignUp's "Background & Padding" section writes borderRadiusBox, not borderRadius.
  cardBorderRadius: toNumber(pick(rawProps, ['borderRadiusBox', 'borderRadius']), defaultSignUpTokens.cardBorderRadius),
  cardPaddingTop: toNumber(rawProps?.pt ?? rawProps?.paddingTop, defaultSignUpTokens.cardPaddingTop),
  cardPaddingBottom: toNumber(rawProps?.pb ?? rawProps?.paddingBottom, defaultSignUpTokens.cardPaddingBottom),
  cardPaddingLeft: toNumber(rawProps?.pl ?? rawProps?.paddingLeft, defaultSignUpTokens.cardPaddingLeft),
  cardPaddingRight: toNumber(rawProps?.pr ?? rawProps?.paddingRight, defaultSignUpTokens.cardPaddingRight),
  formGap: toNumber(rawProps?.formGap ?? rawProps?.titleFormGap ?? rawProps?.headerBottomGap, defaultSignUpTokens.formGap),
  fieldGap: toNumber(rawProps?.fieldGap ?? rawProps?.inputGap ?? rawProps?.fieldMarginBottom, defaultSignUpTokens.fieldGap),
  inputPaddingHorizontal: toNumber(rawProps?.inputPaddingHorizontal ?? rawProps?.inputPx ?? rawProps?.fieldPaddingHorizontal, defaultSignUpTokens.inputPaddingHorizontal),
  inputPaddingVertical: toNumber(rawProps?.inputPaddingVertical ?? rawProps?.inputPy ?? rawProps?.fieldPaddingVertical, defaultSignUpTokens.inputPaddingVertical),
  formCardMarginBottom: toNumber(rawProps?.formCardMarginBottom ?? rawProps?.cardMarginBottom, defaultSignUpTokens.formCardMarginBottom),
  buttonMarginTop: toNumber(rawProps?.buttonMarginTop ?? rawProps?.buttonMt, defaultSignUpTokens.buttonMarginTop),
  footerMarginTop: toNumber(rawProps?.footerMarginTop ?? rawProps?.footerMt ?? rawProps?.footerPt, defaultSignUpTokens.footerMarginTop),
  footerLinkMarginTop: toNumber(rawProps?.footerLinkMarginTop ?? rawProps?.footerLinkMt ?? rawProps?.signInLinkPt, defaultSignUpTokens.footerLinkMarginTop),
  footerInline: toBoolean(rawProps?.footerInline ?? rawProps?.footerSameLine, defaultSignUpTokens.footerInline),
  pagePaddingTop: toNumber(rawProps?.subgpt ?? rawProps?.bgpt ?? rawProps?.pagePaddingTop, defaultSignUpTokens.pagePaddingTop),
  pagePaddingBottom: toNumber(rawProps?.subgpb ?? rawProps?.bgpb ?? rawProps?.pagePaddingBottom, defaultSignUpTokens.pagePaddingBottom),
  pagePaddingLeft: toNumber(rawProps?.subgpl ?? rawProps?.bgpl ?? rawProps?.pagePaddingLeft, defaultSignUpTokens.pagePaddingLeft),
  pagePaddingRight: toNumber(rawProps?.subgpr ?? rawProps?.bgpr ?? rawProps?.pagePaddingRight, defaultSignUpTokens.pagePaddingRight),
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
  headerTitle: (rawProps?.headerTitle as string) ?? defaultSignUpTokens.headerTitle,
  headerTitleColor: (rawProps?.headerTitleColor as string) ?? defaultSignUpTokens.headerTitleColor,
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
  emailInputTextAlignment: (pick(rawProps, ['emailInputTextAlignment', 'emailAlignmenT', 'emailAlignment']) as string) ?? defaultSignUpTokens.emailInputTextAlignment,
  firstNameInputTextAlignment: (pick(rawProps, ['firstNameInputTextAlignment', 'firstNameAlignmenT', 'firstNameAlignment']) as string) ?? defaultSignUpTokens.firstNameInputTextAlignment,
  lastNameInputTextAlignment: (pick(rawProps, ['lastNameInputTextAlignment', 'lastNameAlignmenT', 'lastNameAlignment']) as string) ?? defaultSignUpTokens.lastNameInputTextAlignment,
  passwordInputTextAlignment: (pick(rawProps, ['passwordInputTextAlignment', 'passwordAlignmenT', 'passwordAlignment']) as string) ?? defaultSignUpTokens.passwordInputTextAlignment,
  emailLabelVisible: (rawProps?.emailLabelVisible as boolean) ?? defaultSignUpTokens.emailLabelVisible,
  firstNameLabelVisible: (rawProps?.firstNameLabelVisible as boolean) ?? defaultSignUpTokens.firstNameLabelVisible,
  lastNameLabelVisible: (rawProps?.lastNameLabelVisible as boolean) ?? defaultSignUpTokens.lastNameLabelVisible,
  passwordLabelVisible: (rawProps?.passwordLabelVisible as boolean) ?? defaultSignUpTokens.passwordLabelVisible,
  emailInputVisible: (rawProps?.emailInputVisible as boolean) ?? defaultSignUpTokens.emailInputVisible,
  firstNameVisible: (rawProps?.firstNameVisible as boolean) ?? defaultSignUpTokens.firstNameVisible,
  lastNameVisible: (rawProps?.lastNameVisible as boolean) ?? defaultSignUpTokens.lastNameVisible,
  passwordInputVisible: (rawProps?.passwordInputVisible as boolean) ?? defaultSignUpTokens.passwordInputVisible,
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
  // and {field}InputTextfontWeight (lowercase "font") — capitalized spelling
  // kept as a forward-compatible alias.
  emailInputTextFontSize: toNumber(pick(rawProps, ['emailInputTextFontSize', 'emailInputTextfontSize']), defaultSignUpTokens.emailInputTextFontSize),
  firstNameInputTextFontSize: toNumber(pick(rawProps, ['firstNameInputTextFontSize', 'firstNameInputTextfontSize']), defaultSignUpTokens.firstNameInputTextFontSize),
  lastNameInputTextFontSize: toNumber(pick(rawProps, ['lastNameInputTextFontSize', 'lastNameInputTextfontSize']), defaultSignUpTokens.lastNameInputTextFontSize),
  passwordInputTextFontSize: toNumber(pick(rawProps, ['passwordInputTextFontSize', 'passwordInputTextfontSize']), defaultSignUpTokens.passwordInputTextFontSize),
  emailInputTextFontFamily: toFontFamily(rawProps?.emailInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.emailInputTextFontFamily),
  firstNameInputTextFontFamily: toFontFamily(rawProps?.firstNameInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.firstNameInputTextFontFamily),
  lastNameInputTextFontFamily: toFontFamily(rawProps?.lastNameInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.lastNameInputTextFontFamily),
  passwordInputTextFontFamily: toFontFamily(rawProps?.passwordInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.passwordInputTextFontFamily),
  emailInputTextFontWeight: toFontWeight(pick(rawProps, ['emailInputTextFontWeight', 'emailInputTextfontWeight', 'fontWeight']), defaultSignUpTokens.emailInputTextFontWeight),
  firstNameInputTextFontWeight: toFontWeight(pick(rawProps, ['firstNameInputTextFontWeight', 'firstNameInputTextfontWeight']), defaultSignUpTokens.firstNameInputTextFontWeight),
  lastNameInputTextFontWeight: toFontWeight(pick(rawProps, ['lastNameInputTextFontWeight', 'lastNameInputTextfontWeight']), defaultSignUpTokens.lastNameInputTextFontWeight),
  passwordInputTextFontWeight: toFontWeight(pick(rawProps, ['passwordInputTextFontWeight', 'passwordInputTextfontWeight', 'fontWeight']), defaultSignUpTokens.passwordInputTextFontWeight),
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
  // (lowercase "font") — capitalized spelling kept as a forward-compatible alias.
  emailPlaceholderFontWeight: toFontWeight(pick(rawProps, ['emailPlaceholderFontWeight', 'emailPlaceholderfontWeight', 'placeholderFontWeight', 'fontWeight']), defaultSignUpTokens.emailPlaceholderFontWeight, rawProps?.emailPlaceholderbold as boolean | undefined),
  firstNamePlaceholderFontWeight: toFontWeight(pick(rawProps, ['firstNamePlaceholderFontWeight', 'firstNamePlaceholderfontWeight', 'placeholderFontWeight', 'fontWeight']), defaultSignUpTokens.firstNamePlaceholderFontWeight, rawProps?.firstNamePlaceholderbold as boolean | undefined),
  lastNamePlaceholderFontWeight: toFontWeight(pick(rawProps, ['lastNamePlaceholderFontWeight', 'lastNamePlaceholderfontWeight', 'placeholderFontWeight', 'fontWeight']), defaultSignUpTokens.lastNamePlaceholderFontWeight, rawProps?.lastNamePlaceholderbold as boolean | undefined),
  passwordPlaceholderFontWeight: toFontWeight(pick(rawProps, ['passwordPlaceholderFontWeight', 'passwordPlaceholderfontWeight', 'placeholderFontWeight', 'fontWeight']), defaultSignUpTokens.passwordPlaceholderFontWeight, rawProps?.passwordPlaceholderbold as boolean | undefined),
  ...buildButtonStyleTokens(rawProps, defaultSignUpTokens),
  buttonBorderColor: (rawProps?.buttonBorderColor as string) ?? defaultSignUpTokens.buttonBorderColor,
  buttonBorderWidth: resolveBorderWidth(rawProps?.buttonBorderLine, rawProps?.buttonBorderColor, defaultSignUpTokens.buttonBorderWidth),
  buttonPaddingTop: toNumber(rawProps?.buttonPaddingTop, defaultSignUpTokens.buttonPaddingTop),
  buttonPaddingBottom: toNumber(rawProps?.buttonPaddingBottom, defaultSignUpTokens.buttonPaddingBottom),
  buttonAutoUppercase: (rawProps?.buttonAutoUppercase as boolean) ?? defaultSignUpTokens.buttonAutoUppercase,
  // Builder's Button section writes buttonheightt (typo, double "t") and
  // buttonwidth (lowercase "w") — correctly-spelled keys kept as aliases.
  buttonHeight: toNumber(pick(rawProps, ['buttonheightt', 'buttonHeight']), defaultSignUpTokens.buttonHeight),
  buttonWidth: toNumber(pick(rawProps, ['buttonwidth', 'buttonWidth']), defaultSignUpTokens.buttonWidth),
  footerTextColor: (rawProps?.footerTextColor as string) ?? defaultSignUpTokens.footerTextColor,
  footerLinkColor: (rawProps?.footerLinkColor as string) ?? defaultSignUpTokens.footerLinkColor,
  footerTextFontSize: toNumber(rawProps?.footerTextFontSize ?? rawProps?.subtextSize ?? rawProps?.fontSize, defaultSignUpTokens.footerTextFontSize),
  footerTextFontFamily: toFontFamily(rawProps?.footerTextFontFamily ?? rawProps?.subtextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.footerTextFontFamily),
  footerTextFontWeight: toFontWeight(rawProps?.footerTextFontWeight ?? rawProps?.subtextWeight ?? rawProps?.fontWeight, defaultSignUpTokens.footerTextFontWeight),
  footerLinkFontSize: toNumber(rawProps?.footerLinkFontSize, defaultSignUpTokens.footerLinkFontSize),
  footerLinkFontFamily: toFontFamily(rawProps?.footerLinkFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.footerLinkFontFamily),
  footerLinkFontWeight: toFontWeight(rawProps?.footerLinkFontWeight, defaultSignUpTokens.footerLinkFontWeight),
  footerLinkAlignment: (rawProps?.footerLinkAlignment as string) ?? defaultSignUpTokens.footerLinkAlignment,
  footerLinkAutoUppercase: (rawProps?.footerLinkAutoUppercase as boolean) ?? defaultSignUpTokens.footerLinkAutoUppercase,
  footerVisible: (rawProps?.footerVisible as boolean) ?? defaultSignUpTokens.footerVisible,
  signInLinkVisible: (rawProps?.signInLinkVisible as boolean) ?? defaultSignUpTokens.signInLinkVisible,
  buttonVisible: (rawProps?.buttonVisible as boolean) ?? defaultSignUpTokens.buttonVisible,
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
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={[
          fieldStyles.input,
          {
            color: inputColor,
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
  const ratioValue = parseAuthLogoRatio(ratio);
  const width = AUTH_LOGO_BASE_WIDTH;
  const height = Math.round(width / ratioValue);
  return (
    <View
      style={{
        width,
        height,
        borderRadius: corners,
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
  <SafeAreaView style={authSkeletonStyles.safeArea}>
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
  const [signInTokens, setSignInTokens] = useState<SignInTokens>(defaultSignInTokens);
  const [signUpTokens, setSignUpTokens] = useState<SignUpTokens>(defaultSignUpTokens);
  const [forgotPasswordTokens, setForgotPasswordTokens] = useState<ForgotPasswordTokens>(defaultForgotPasswordTokens);
  const [resetPasswordTokens, setResetPasswordTokens] = useState<ResetPasswordTokens>(defaultResetPasswordTokens);
  const [signInHeaderConfig, setSignInHeaderConfig] = useState<Record<string, unknown> | null>(null);
  const [signUpHeaderConfig, setSignUpHeaderConfig] = useState<Record<string, unknown> | null>(null);
  const [resetPasswordHeaderConfig, setResetPasswordHeaderConfig] = useState<Record<string, unknown> | null>(null);
  const [signInDslSections, setSignInDslSections] = useState<Record<string, unknown>[]>([]);
  const [signUpDslSections, setSignUpDslSections] = useState<Record<string, unknown>[]>([]);
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
        const nextSignInTokens = signInSection ? buildSignInTokens(signInRawProps) : defaultSignInTokens;
        const hasEnabledForgotPasswordSection =
          Boolean(forgotSection) && hasLiveSignInPage && isForgotPasswordEnabled(forgotRawProps);
        setSignInDslSections(signInSections as Record<string, unknown>[]);
        setHasForgotPasswordSection(hasEnabledForgotPasswordSection || nextSignInTokens.forgotPasswordVisible);
        setSignInTokens(nextSignInTokens);
        setForgotPasswordTokens(forgotSection ? buildForgotPasswordTokens(forgotRawProps) : defaultForgotPasswordTokens);
        setSignInHeaderConfig(hasLiveSignInPage ? ((signInDsl?.dsl?.headerdefault as Record<string, unknown> | undefined) ?? null) : null);
        if (hasLiveSignInPage) hasLiveSignInLayoutRef.current = true;
      }

      if (signUpSections) {
        const signUpSection = signUpSections.find(isSignUpSection);
        setSignUpDslSections(signUpSections as Record<string, unknown>[]);
        setSignUpTokens(signUpSection ? buildSignUpTokens(getSectionRawProps(signUpSection)) : defaultSignUpTokens);
        setSignUpHeaderConfig(hasResolvedLiveSignUpPage ? (((hasLiveSignUpPage ? signUpDsl : signInDsl)?.dsl?.headerdefault as Record<string, unknown> | undefined) ?? null) : null);
        if (hasResolvedLiveSignUpPage) hasLiveSignUpLayoutRef.current = true;
      }

      if (resetPasswordSections) {
        const resetPasswordSection = resetPasswordSections.find(isResetPasswordSection);
        setResetPasswordTokens(resetPasswordSection ? buildResetPasswordTokens(getSectionRawProps(resetPasswordSection)) : defaultResetPasswordTokens);
        setResetPasswordHeaderConfig(hasLiveResetPasswordPage ? ((resetPasswordDsl?.dsl?.headerdefault as Record<string, unknown> | undefined) ?? null) : null);
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
  const activeHeaderConfig = useMemo(() => {
    const dslConfig =
      mode === 'signup' ? signUpHeaderConfig : mode === 'forgot' ? resetPasswordHeaderConfig : signInHeaderConfig;
    return dslConfig ?? null;
  }, [mode, signInHeaderConfig, signUpHeaderConfig, resetPasswordHeaderConfig]);

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
  // Forgot-password has no icon control in Builder — icon only applies to login/signup.
  const submitButtonIconName = isForgotMode ? null : resolveButtonIconName(t.buttonIcon);

  const submitButtonText = (
    <Text
      allowFontScaling={false}
      style={{
        color: submitButtonTextColor,
        fontSize: submitButtonFontSize,
        fontWeight: submitButtonFontWeight as any,
        fontFamily: submitButtonFontFamily !== 'System' ? submitButtonFontFamily : undefined,
        fontStyle: isForgotMode ? 'normal' : t.buttonTextFontStyle,
        textDecorationLine: isForgotMode ? 'none' : t.buttonTextTextDecoration,
      }}
    >
      {buttonLabel}
    </Text>
  );

  const submitButtonContent = loading ? (
    <ActivityIndicator color={submitButtonTextColor} />
  ) : submitButtonIconName ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {t.buttonIconAlignment === 'Right' ? null : (
        <Icon name={submitButtonIconName} size={t.buttonIconSize} color={t.buttonIconColor} />
      )}
      {submitButtonText}
      {t.buttonIconAlignment === 'Right' ? (
        <Icon name={submitButtonIconName} size={t.buttonIconSize} color={t.buttonIconColor} />
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
  const activeDecorSections = useMemo(
    () =>
      (mode === 'signup' ? signUpDecorSections : signInDecorSections).map((section) =>
        withAuthViewport(section, viewportHeight)
      ),
    [mode, signInDecorSections, signUpDecorSections, viewportHeight]
  );

  if (!dslLoaded || authLayoutBlocking) return <AuthLayoutSkeleton />;

  const pagePadLeft = t.pagePaddingLeft;
  const pagePadRight = t.pagePaddingRight;
  const activePageBgColor = isForgotMode ? resetPasswordTokens.cardBgColor : t.bgColor;
  const pagePadTop = resolveAuthVerticalSpace(t.pagePaddingTop, viewportHeight, 0.06);
  const pagePadBottom = resolveAuthVerticalSpace(t.pagePaddingBottom, viewportHeight, 0.06);
  const cardPadTop = resolveAuthVerticalSpace(t.cardPaddingTop, viewportHeight, 0.055);
  const cardPadBottom = resolveAuthVerticalSpace(t.cardPaddingBottom, viewportHeight, 0.055);
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
  const footerMarginTop = resolveAuthVerticalSpace(t.footerMarginTop, viewportHeight, 0.04);
  const footerLinkMarginTop = resolveAuthVerticalSpace(t.footerLinkMarginTop, viewportHeight, 0.02);
  const formCardMarginBottom = resolveAuthVerticalSpace(t.formCardMarginBottom, viewportHeight, 0.04);
  const forgotLoginLinkMarginTop = resolveAuthVerticalSpace(forgotPasswordTokens.loginLinkMarginTop, viewportHeight, 0.08);
  const hasDynamicDecor = hasDynamicSignInLayout || hasDynamicSignUpLayout;
  const baseFirstNameInputAlign = toTextAlign(signUpTokens.firstNameInputTextAlignment);
  const firstNameLooksLikeFullName = `${signUpTokens.firstNamePlaceholder} ${signUpTokens.firstNameLabelText}`
    .toLowerCase()
    .includes('full name');
  const signUpFirstNameInputAlign =
    !signUpTokens.lastNameVisible && firstNameLooksLikeFullName && baseFirstNameInputAlign === 'center'
      ? 'left'
      : baseFirstNameInputAlign;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activePageBgColor }}>
      {activeHeaderConfig ? (
        <HeaderDefaultComponent config={activeHeaderConfig} bottomNavSection={null} hideTabs showBack />
      ) : null}

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
          {hasDynamicSignInLayout || hasDynamicSignUpLayout ? (
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

            {mode === 'signup' ? (
              <Text
                style={{
                  color: signUpTokens.headerTitleColor,
                  fontSize: signUpTokens.headerTitleFontSize,
                  fontWeight: signUpTokens.headerTitleFontWeight as any,
                  fontFamily: signUpTokens.headerTitleFontFamily !== 'System' ? signUpTokens.headerTitleFontFamily : undefined,
                  fontStyle: signUpTokens.headerTitleFontStyle,
                  textDecorationLine: signUpTokens.headerTitleTextDecoration,
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

            {mode === 'forgot' && resetPasswordTokens.headingText ? (
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
                inputAlign={signUpFirstNameInputAlign}
                inputBorderColor={signUpTokens.inputBorderColor}
                inputBorderRadius={signUpTokens.inputBorderRadius}
                inputHeight={signUpTokens.inputHeight}
                fieldGap={fieldGap}
                inputPaddingHorizontal={signUpTokens.inputPaddingHorizontal}
                inputPaddingVertical={signUpTokens.inputPaddingVertical}
                cardBgColor={signUpTokens.cardBgColor}
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
                cardBgColor={signUpTokens.cardBgColor}
                autoCapitalize="words"
              />
            ) : null}

            {/* Reset Password email field — Builder's reset_password component has exactly
                one hardcoded email input (no dynamic field list, no label). */}
            {mode === 'forgot' ? (
              <FormField
                label=""
                labelVisible={false}
                labelColor={resetPasswordTokens.inputTextColor}
                labelAlign="left"
                placeholder={resetPasswordTokens.emailPlaceholder}
                placeholderVisible
                placeholderColor={resetPasswordTokens.emailPlaceholderColor}
                value={forgotFieldValues.email ?? email}
                onChangeText={(value) => handleForgotFieldChange('email', value)}
                inputColor={resetPasswordTokens.inputTextColor}
                inputFontSize={resetPasswordTokens.inputFontSize}
                inputFontFamily={resetPasswordTokens.inputFontFamily}
                inputFontWeight="400"
                inputAlign="left"
                inputBorderColor={resetPasswordTokens.inputBorderColor}
                inputBorderRadius={resetPasswordTokens.inputBorderRadius}
                inputHeight={resetPasswordTokens.inputHeight}
                fieldGap={fieldGap}
                inputPaddingHorizontal={resetPasswordTokens.inputPaddingHorizontal}
                inputPaddingVertical={resetPasswordTokens.inputPaddingVertical}
                cardBgColor={activeCardBgColor}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}

            {/* Email */}
            {mode !== 'forgot' && (mode !== 'signup' || signUpTokens.emailInputVisible) ? (
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
                cardBgColor={t.cardBgColor}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}

            {/* Password */}
            {(mode === 'login' || (mode === 'signup' && signUpTokens.passwordInputVisible)) ? (
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
                cardBgColor={t.cardBgColor}
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
            {(mode !== 'signup' || signUpTokens.buttonVisible) ? (
              <TouchableOpacity
                onPress={isForgotMode ? handleForgotPasswordSubmit : handleSubmit}
                disabled={loading || initializing}
                style={[
                  {
                    backgroundColor: !isForgotMode && t.buttonGradient ? 'transparent' : isForgotMode ? resetPasswordTokens.buttonFillColor : t.buttonFillColor,
                    borderRadius: isForgotMode ? resetPasswordTokens.buttonRadius : t.buttonRadius,
                    borderWidth: isForgotMode ? resetPasswordTokens.buttonBorderWidth : t.buttonBorderWidth,
                    borderColor: isForgotMode ? resetPasswordTokens.buttonBorderColor : t.buttonBorderColor,
                    height: isForgotMode ? undefined : t.buttonHeight,
                    paddingTop: isForgotMode ? resetPasswordTokens.buttonPaddingTop : undefined,
                    paddingBottom: isForgotMode ? resetPasswordTokens.buttonPaddingBottom : undefined,
                    paddingLeft: isForgotMode ? resetPasswordTokens.buttonPaddingLeft : undefined,
                    paddingRight: isForgotMode ? resetPasswordTokens.buttonPaddingRight : undefined,
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
            {mode === 'forgot' ? null : t.footerVisible ? (
              <View
                style={{
                  marginTop: footerMarginTop,
                  alignItems: toFlexAlign(t.footerLinkAlignment, 'center'),
                  flexDirection: t.footerInline ? 'row' : 'column',
                  justifyContent: toFlexAlign(t.footerLinkAlignment, 'center') === 'flex-start'
                    ? 'flex-start'
                    : toFlexAlign(t.footerLinkAlignment, 'center') === 'flex-end'
                      ? 'flex-end'
                      : 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Text
                  style={{
                    color: t.footerTextColor,
                    fontSize: t.footerTextFontSize,
                    fontFamily: t.footerTextFontFamily !== 'System' ? t.footerTextFontFamily : undefined,
                    fontWeight: t.footerTextFontWeight as any,
                    fontStyle: t.footerTextFontStyle,
                    textDecorationLine: t.footerTextTextDecoration,
                  }}
                >
                  {mode === 'login' ? signInTokens.footerText : signUpTokens.footerText}
                </Text>
                {(mode === 'login' || signUpTokens.signInLinkVisible) ? (
                  <TouchableOpacity
                    onPress={toggleMode}
                    accessibilityRole="button"
                    style={{
                      marginTop: t.footerInline ? 0 : footerLinkMarginTop,
                      marginLeft: t.footerInline ? 4 : 0,
                    }}
                  >
                    <Text
                      style={{
                        color: t.footerLinkColor,
                        fontSize: t.footerLinkFontSize,
                        fontWeight: t.footerLinkFontWeight as any,
                        fontFamily: t.footerLinkFontFamily !== 'System' ? t.footerLinkFontFamily : undefined,
                        fontStyle: t.footerLinkFontStyle,
                        textDecorationLine: t.footerLinkTextDecoration,
                        textAlign: toTextAlign(t.footerLinkAlignment, 'center'),
                      }}
                    >
                      {mode === 'login'
                        ? signInTokens.footerLinkText
                        : signUpTokens.footerLinkAutoUppercase
                          ? signUpTokens.footerLinkText.toUpperCase()
                          : signUpTokens.footerLinkText}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Forgot password link (login only) */}
            {mode === 'login' && hasForgotPasswordSection ? (
              <TouchableOpacity
                onPress={openForgotPasswordMode}
                accessibilityRole="button"
                style={{
                  marginTop: forgotLoginLinkMarginTop,
                  alignSelf: toFlexAlign(forgotPasswordTokens.headlineTextAlign, 'center'),
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AuthScreen;
