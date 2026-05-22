import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome6';
import { useAuth } from '../services/AuthContext';
import { fetchDSL } from '../engine/dslHandler';
import authLayoutFallback from '../data/authLayoutFallback';
import { getShopifyDomain } from '../services/shopify';
import HeaderDefaultComponent from '../components/HeaderDefault';
import DynamicRenderer from '../engine/DynamicRenderer';
import { getHeaderDefault } from '../services/headerDefaultService';
import { getAppNameSync } from '../utils/appInfo';
import { resolveFont } from '../services/typographyService';

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
  subtextSize: number;
  subtextWeight: string;
  subtextFontFamily: string;
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
};

type ForgotPasswordTokens = {
  titleColor: string;
  cardBgColor: string;
  cardBorderColor: string;
  cardBorderRadius: number;
  cardPaddingTop: number;
  cardPaddingBottom: number;
  cardPaddingLeft: number;
  cardPaddingRight: number;
  buttonTextColor: string;
  buttonBorderColor: string;
  buttonFillColor: string;
  headlineText: string;
  headlineFontSize: number;
  headlineFontFamily: string;
  headlineFontWeight: string;
  headlineFontStyle: 'normal' | 'italic';
  headlineTextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
  headlineTextTransform: 'none' | 'uppercase';
  resetPasswordTitle: string;
  resetPasswordButtonText: string;
};

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

const firstDefined = (...values: unknown[]): unknown => {
  for (const value of values) {
    const resolved = unwrapValue(value as unknown, undefined as unknown);
    if (resolved !== undefined && resolved !== null && resolved !== '') return resolved;
  }
  return undefined;
};

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

const normalizeSectionName = (value: unknown): string =>
  String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const SIGN_IN_COMPONENTS = new Set(['signin', 'sign_in']);
const SIGN_UP_COMPONENTS = new Set(['signup', 'sign_up']);
const FORGOT_PASSWORD_COMPONENTS = new Set(['forgot_password', 'forgotpassword']);

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
  cardBorderWidth: 1,
  cardBorderRadius: 16,
  cardPaddingTop: 20,
  cardPaddingBottom: 20,
  cardPaddingLeft: 20,
  cardPaddingRight: 20,
  formGap: 6,
  fieldGap: 14,
  inputPaddingHorizontal: 14,
  inputPaddingVertical: 0,
  formCardMarginBottom: 16,
  buttonMarginTop: 4,
  footerMarginTop: 20,
  footerLinkMarginTop: 6,
  footerInline: false,
  pagePaddingTop: 24,
  pagePaddingBottom: 32,
  pagePaddingLeft: 16,
  pagePaddingRight: 16,
  inputBorderColor: '#C7DADA',
  inputHeight: 50,
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
  emailLabelFontFamily: 'System',
  passwordLabelFontFamily: 'System',
  emailLabelFontWeight: '600',
  passwordLabelFontWeight: '600',
  emailInputTextColor: '#0a0a0a',
  passwordInputTextColor: '#0a0a0a',
  emailInputTextFontSize: 15,
  passwordInputTextFontSize: 15,
  emailInputTextFontFamily: 'System',
  passwordInputTextFontFamily: 'System',
  emailInputTextFontWeight: '400',
  passwordInputTextFontWeight: '400',
  emailPlaceholderColor: '#A0AEC0',
  passwordPlaceholderColor: '#A0AEC0',
  emailPlaceholderFontSize: 15,
  passwordPlaceholderFontSize: 15,
  emailPlaceholderFontFamily: 'System',
  passwordPlaceholderFontFamily: 'System',
  emailPlaceholderFontWeight: '400',
  passwordPlaceholderFontWeight: '400',
  buttonFontSize: 16,
  buttonFontFamily: 'System',
  buttonFontWeight: '700',
  buttonHeight: 50,
  buttonWidth: 100,
  footerTextFontSize: 14,
  footerTextFontFamily: 'System',
  footerTextFontWeight: '400',
  footerLinkFontSize: 14,
  footerLinkFontFamily: 'System',
  footerLinkFontWeight: '700',
  footerLinkAlignment: 'Center',
  footerVisible: true,
  forgotPasswordVisible: false,
  authVisible: true,
  buttonRadius: 12,
  inputBorderRadius: 10,
  headlineSize: 22,
  headlineWeight: '700',
  headlineFontFamily: 'System',
  subtextSize: 14,
  subtextWeight: '400',
  subtextFontFamily: 'System',
};

const defaultForgotPasswordTokens: ForgotPasswordTokens = {
  titleColor: '#0C9297',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#D1E7E7',
  cardBorderRadius: 16,
  cardPaddingTop: 20,
  cardPaddingBottom: 20,
  cardPaddingLeft: 20,
  cardPaddingRight: 20,
  buttonTextColor: '#0C9297',
  buttonBorderColor: '#0c9297',
  buttonFillColor: '#E6F6F6',
  headlineText: 'Forgot Password?',
  headlineFontSize: 18,
  headlineFontFamily: 'System',
  headlineFontWeight: '700',
  headlineFontStyle: 'normal',
  headlineTextDecoration: 'none',
  headlineTextTransform: 'none',
  resetPasswordTitle: 'Reset Password Link',
  resetPasswordButtonText: 'Forgot Password?',
};

const defaultSignUpTokens: SignUpTokens = {
  ...defaultSignInTokens,
  bgColor: '#F8FAFA',
  titleColor: '#027579',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#D1E7E7',
  cardBorderRadius: 16,
  cardPaddingTop: 20,
  cardPaddingBottom: 20,
  cardPaddingLeft: 20,
  cardPaddingRight: 20,
  formGap: 6,
  fieldGap: 14,
  inputPaddingHorizontal: 14,
  inputPaddingVertical: 0,
  formCardMarginBottom: 16,
  buttonMarginTop: 4,
  footerMarginTop: 20,
  footerLinkMarginTop: 6,
  footerInline: true,
  inputBorderColor: '#C7DADA',
  inputHeight: 50,
  authTitle: 'Create an Account',
  buttonText: 'Create Account',
  footerText: 'Already have an account?',
  footerLinkText: 'Sign in',
  headerTitle: 'Create an Account',
  headerTitleColor: '#065F63',
  headerTitleFontSize: 22,
  headerTitleFontFamily: 'System',
  headerTitleFontWeight: '700',
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
  firstNamePlaceholderFontSize: 15,
  lastNamePlaceholderFontSize: 15,
  firstNamePlaceholderFontFamily: 'System',
  lastNamePlaceholderFontFamily: 'System',
  firstNamePlaceholderFontWeight: '400',
  lastNamePlaceholderFontWeight: '400',
  emailLabelColor: '#374151',
  firstNameLabelColor: '#374151',
  lastNameLabelColor: '#374151',
  passwordLabelColor: '#374151',
  emailLabelFontSize: 13,
  firstNameLabelFontSize: 13,
  lastNameLabelFontSize: 13,
  passwordLabelFontSize: 13,
  emailLabelFontFamily: 'System',
  firstNameLabelFontFamily: 'System',
  lastNameLabelFontFamily: 'System',
  passwordLabelFontFamily: 'System',
  emailLabelFontWeight: '600',
  firstNameLabelFontWeight: '600',
  lastNameLabelFontWeight: '600',
  passwordLabelFontWeight: '600',
  emailInputTextColor: '#111827',
  firstNameInputTextColor: '#111827',
  lastNameInputTextColor: '#111827',
  passwordInputTextColor: '#111827',
  emailInputTextFontSize: 15,
  firstNameInputTextFontSize: 15,
  lastNameInputTextFontSize: 15,
  passwordInputTextFontSize: 15,
  emailInputTextFontFamily: 'System',
  firstNameInputTextFontFamily: 'System',
  lastNameInputTextFontFamily: 'System',
  passwordInputTextFontFamily: 'System',
  emailInputTextFontWeight: '400',
  firstNameInputTextFontWeight: '400',
  lastNameInputTextFontWeight: '400',
  passwordInputTextFontWeight: '400',
  emailPlaceholderColor: '#9CA3AF',
  firstNamePlaceholderColor: '#9CA3AF',
  lastNamePlaceholderColor: '#9CA3AF',
  passwordPlaceholderColor: '#9CA3AF',
  buttonHeight: 50,
  buttonWidth: 100,
  buttonFontSize: 16,
  buttonFontFamily: 'System',
  buttonFontWeight: '700',
  footerTextFontSize: 13,
  footerLinkFontSize: 14,
  footerLinkFontFamily: 'System',
  footerLinkFontWeight: '600',
  footerLinkAlignment: 'Center',
  footerLinkAutoUppercase: false,
  footerVisible: true,
  signInLinkVisible: true,
  buttonVisible: true,
  showProfilePicture: false,
  profilePictureUrl: '',
  profilePictureSize: 72,
  profilePictureBgColor: '#E5F3F4',
  profilePictureBorderColor: '#33B8C4',
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

const capFontSize = (value: number, max: number): number => Math.min(value, max);

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
  emailInputTextColor: (rawProps?.emailInputTextColor as string) ?? defaultSignInTokens.emailInputTextColor,
  passwordInputTextColor: (rawProps?.passwordInputTextColor as string) ?? defaultSignInTokens.passwordInputTextColor,
  emailInputTextFontSize: toNumber(rawProps?.emailInputTextFontSize ?? rawProps?.inputFontSize ?? rawProps?.fontSize, defaultSignInTokens.emailInputTextFontSize),
  passwordInputTextFontSize: toNumber(rawProps?.passwordInputTextFontSize ?? rawProps?.inputFontSize ?? rawProps?.fontSize, defaultSignInTokens.passwordInputTextFontSize),
  emailInputTextFontFamily: toFontFamily(rawProps?.emailInputTextFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.emailInputTextFontFamily),
  passwordInputTextFontFamily: toFontFamily(rawProps?.passwordInputTextFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.passwordInputTextFontFamily),
  emailInputTextFontWeight: toFontWeight(rawProps?.emailInputTextFontWeight ?? rawProps?.fontWeight, defaultSignInTokens.emailInputTextFontWeight),
  passwordInputTextFontWeight: toFontWeight(rawProps?.passwordInputTextFontWeight ?? rawProps?.fontWeight, defaultSignInTokens.passwordInputTextFontWeight),
  emailPlaceholderColor: (rawProps?.emailPlaceholderColor as string) ?? defaultSignInTokens.emailPlaceholderColor,
  passwordPlaceholderColor: (rawProps?.passwordPlaceholderColor as string) ?? defaultSignInTokens.passwordPlaceholderColor,
  emailPlaceholderFontSize: toNumber(rawProps?.emailPlaceholderFontSize ?? rawProps?.placeholderFontSize ?? rawProps?.fontSize, defaultSignInTokens.emailPlaceholderFontSize),
  passwordPlaceholderFontSize: toNumber(rawProps?.passwordPlaceholderFontSize ?? rawProps?.placeholderFontSize ?? rawProps?.fontSize, defaultSignInTokens.passwordPlaceholderFontSize),
  emailPlaceholderFontFamily: toFontFamily(rawProps?.emailPlaceholderFontFamily ?? rawProps?.placeholderFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.emailPlaceholderFontFamily),
  passwordPlaceholderFontFamily: toFontFamily(rawProps?.passwordPlaceholderFontFamily ?? rawProps?.placeholderFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.passwordPlaceholderFontFamily),
  emailPlaceholderFontWeight: toFontWeight(rawProps?.emailPlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignInTokens.emailPlaceholderFontWeight),
  passwordPlaceholderFontWeight: toFontWeight(rawProps?.passwordPlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignInTokens.passwordPlaceholderFontWeight),
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
  inputBorderRadius: toNumber(rawProps?.borderRadius ?? rawProps?.inputRadius ?? rawProps?.inputBorderRadius, defaultSignInTokens.inputBorderRadius),
  headlineSize: toNumber(rawProps?.headlineSize, defaultSignInTokens.headlineSize),
  headlineWeight: toFontWeight(rawProps?.headlineWeight, defaultSignInTokens.headlineWeight),
  headlineFontFamily: toFontFamily(rawProps?.headlineFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.headlineFontFamily),
  subtextSize: toNumber(rawProps?.subtextSize, defaultSignInTokens.subtextSize),
  subtextWeight: toFontWeight(rawProps?.subtextWeight, defaultSignInTokens.subtextWeight),
  subtextFontFamily: toFontFamily(rawProps?.subtextFontFamily ?? rawProps?.fontFamily, defaultSignInTokens.subtextFontFamily),
});

const buildForgotPasswordTokens = (rawProps: Record<string, unknown>): ForgotPasswordTokens => ({
  ...defaultForgotPasswordTokens,
  titleColor:
    (rawProps?.headlineColor as string) ??
    (rawProps?.titleColor as string) ??
    defaultForgotPasswordTokens.titleColor,
  cardBgColor: (rawProps?.cardBgColor as string) ?? defaultForgotPasswordTokens.cardBgColor,
  cardBorderColor: (rawProps?.cardBorderColor as string) ?? defaultForgotPasswordTokens.cardBorderColor,
  cardBorderRadius: toNumber(rawProps?.borderRadius, defaultForgotPasswordTokens.cardBorderRadius),
  cardPaddingTop: toNumber(rawProps?.pt ?? rawProps?.paddingTop, defaultForgotPasswordTokens.cardPaddingTop),
  cardPaddingBottom: toNumber(rawProps?.pb ?? rawProps?.paddingBottom, defaultForgotPasswordTokens.cardPaddingBottom),
  cardPaddingLeft: toNumber(rawProps?.pl ?? rawProps?.paddingLeft, defaultForgotPasswordTokens.cardPaddingLeft),
  cardPaddingRight: toNumber(rawProps?.pr ?? rawProps?.paddingRight, defaultForgotPasswordTokens.cardPaddingRight),
  buttonTextColor: (rawProps?.buttonTextColor as string) ?? defaultForgotPasswordTokens.buttonTextColor,
  buttonBorderColor: (rawProps?.buttonBorderColor as string) ?? defaultForgotPasswordTokens.buttonBorderColor,
  buttonFillColor: resolveButtonColor(rawProps?.buttonBgColor, defaultForgotPasswordTokens.buttonFillColor),
  headlineText: (rawProps?.headlineText as string) ?? defaultForgotPasswordTokens.headlineText,
  headlineFontSize: toNumber(rawProps?.headlineFontSize, defaultForgotPasswordTokens.headlineFontSize),
  headlineFontFamily: toFontFamily(rawProps?.headlineFontFamily ?? rawProps?.fontFamily, defaultForgotPasswordTokens.headlineFontFamily),
  headlineFontWeight: toFontWeight(rawProps?.headlineFontWeight, defaultForgotPasswordTokens.headlineFontWeight, rawProps?.headlineBold as boolean | undefined),
  headlineFontStyle: (rawProps?.headlineItalic as boolean | undefined) ? 'italic' : 'normal',
  headlineTextDecoration: toTextDecoration(rawProps?.headlineUnderline as boolean | undefined, rawProps?.headlineStrikethrough as boolean | undefined),
  headlineTextTransform: (rawProps?.headlineAutoUppercase as boolean | undefined) ? 'uppercase' : 'none',
  resetPasswordTitle: (rawProps?.resetPasswordTitle as string) ?? defaultForgotPasswordTokens.resetPasswordTitle,
  resetPasswordButtonText: (rawProps?.resetPasswordButtonText as string) ?? defaultForgotPasswordTokens.resetPasswordButtonText,
});

const buildSignUpTokens = (rawProps: Record<string, unknown>): SignUpTokens => ({
  ...defaultSignUpTokens,
  bgColor: (rawProps?.bgColor as string) ?? defaultSignUpTokens.bgColor,
  titleColor: (rawProps?.titleColor as string) ?? defaultSignUpTokens.titleColor,
  cardBgColor: (rawProps?.cardBgColor as string) ?? defaultSignUpTokens.cardBgColor,
  cardBorderColor: (rawProps?.cardBorderColor as string) ?? defaultSignUpTokens.cardBorderColor,
  cardBorderWidth: resolveBorderWidth(rawProps?.borderLine, rawProps?.cardBorderColor ?? rawProps?.borderColor, defaultSignUpTokens.cardBorderWidth),
  cardBorderRadius: toNumber(rawProps?.borderRadius, defaultSignUpTokens.cardBorderRadius),
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
  headerTitleFontWeight: toFontWeight(rawProps?.headerTitleFontWeight, defaultSignUpTokens.headerTitleFontWeight),
  emailAlignment: (rawProps?.emailAlignment as string) ?? defaultSignUpTokens.emailAlignment,
  firstNameAlignment: (rawProps?.firstNameAlignment as string) ?? defaultSignUpTokens.firstNameAlignment,
  lastNameAlignment: (rawProps?.lastNameAlignment as string) ?? defaultSignUpTokens.lastNameAlignment,
  passwordAlignment: (rawProps?.passwordAlignment as string) ?? defaultSignUpTokens.passwordAlignment,
  emailInputTextAlignment: (rawProps?.emailInputTextAlignment as string) ?? defaultSignUpTokens.emailInputTextAlignment,
  firstNameInputTextAlignment: (rawProps?.firstNameInputTextAlignment as string) ?? defaultSignUpTokens.firstNameInputTextAlignment,
  lastNameInputTextAlignment: (rawProps?.lastNameInputTextAlignment as string) ?? defaultSignUpTokens.lastNameInputTextAlignment,
  passwordInputTextAlignment: (rawProps?.passwordInputTextAlignment as string) ?? defaultSignUpTokens.passwordInputTextAlignment,
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
  emailLabelFontSize: capFontSize(toNumber(rawProps?.emailLabelFontSize, defaultSignUpTokens.emailLabelFontSize), 15),
  firstNameLabelFontSize: capFontSize(toNumber(rawProps?.firstNameLabelFontSize, defaultSignUpTokens.firstNameLabelFontSize), 15),
  lastNameLabelFontSize: capFontSize(toNumber(rawProps?.lastNameLabelFontSize, defaultSignUpTokens.lastNameLabelFontSize), 15),
  passwordLabelFontSize: capFontSize(toNumber(rawProps?.passwordLabelFontSize, defaultSignUpTokens.passwordLabelFontSize), 15),
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
  emailInputTextFontSize: capFontSize(toNumber(rawProps?.emailInputTextFontSize, defaultSignUpTokens.emailInputTextFontSize), 15),
  firstNameInputTextFontSize: capFontSize(toNumber(rawProps?.firstNameInputTextFontSize, defaultSignUpTokens.firstNameInputTextFontSize), 15),
  lastNameInputTextFontSize: capFontSize(toNumber(rawProps?.lastNameInputTextFontSize, defaultSignUpTokens.lastNameInputTextFontSize), 15),
  passwordInputTextFontSize: capFontSize(toNumber(rawProps?.passwordInputTextFontSize, defaultSignUpTokens.passwordInputTextFontSize), 15),
  emailInputTextFontFamily: toFontFamily(rawProps?.emailInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.emailInputTextFontFamily),
  firstNameInputTextFontFamily: toFontFamily(rawProps?.firstNameInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.firstNameInputTextFontFamily),
  lastNameInputTextFontFamily: toFontFamily(rawProps?.lastNameInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.lastNameInputTextFontFamily),
  passwordInputTextFontFamily: toFontFamily(rawProps?.passwordInputTextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.passwordInputTextFontFamily),
  emailInputTextFontWeight: toFontWeight(rawProps?.emailInputTextFontWeight ?? rawProps?.fontWeight, defaultSignUpTokens.emailInputTextFontWeight),
  firstNameInputTextFontWeight: toFontWeight(rawProps?.firstNameInputTextFontWeight, defaultSignUpTokens.firstNameInputTextFontWeight),
  lastNameInputTextFontWeight: toFontWeight(rawProps?.lastNameInputTextFontWeight, defaultSignUpTokens.lastNameInputTextFontWeight),
  passwordInputTextFontWeight: toFontWeight(rawProps?.passwordInputTextFontWeight ?? rawProps?.fontWeight, defaultSignUpTokens.passwordInputTextFontWeight),
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
  emailPlaceholderFontWeight: toFontWeight(rawProps?.emailPlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignUpTokens.emailPlaceholderFontWeight),
  firstNamePlaceholderFontWeight: toFontWeight(rawProps?.firstNamePlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignUpTokens.firstNamePlaceholderFontWeight),
  lastNamePlaceholderFontWeight: toFontWeight(rawProps?.lastNamePlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignUpTokens.lastNamePlaceholderFontWeight),
  passwordPlaceholderFontWeight: toFontWeight(rawProps?.passwordPlaceholderFontWeight ?? rawProps?.placeholderFontWeight ?? rawProps?.fontWeight, defaultSignUpTokens.passwordPlaceholderFontWeight),
  ...buildButtonStyleTokens(rawProps, defaultSignUpTokens),
  buttonBorderColor: (rawProps?.buttonBorderColor as string) ?? defaultSignUpTokens.buttonBorderColor,
  buttonBorderWidth: resolveBorderWidth(rawProps?.buttonBorderLine, rawProps?.buttonBorderColor, defaultSignUpTokens.buttonBorderWidth),
  buttonPaddingTop: toNumber(rawProps?.buttonPaddingTop, defaultSignUpTokens.buttonPaddingTop),
  buttonPaddingBottom: toNumber(rawProps?.buttonPaddingBottom, defaultSignUpTokens.buttonPaddingBottom),
  buttonAutoUppercase: (rawProps?.buttonAutoUppercase as boolean) ?? defaultSignUpTokens.buttonAutoUppercase,
  buttonHeight: toNumber(rawProps?.buttonHeight, defaultSignUpTokens.buttonHeight),
  buttonWidth: toNumber(rawProps?.buttonWidth, defaultSignUpTokens.buttonWidth),
  footerTextColor: (rawProps?.footerTextColor as string) ?? defaultSignUpTokens.footerTextColor,
  footerLinkColor: (rawProps?.footerLinkColor as string) ?? defaultSignUpTokens.footerLinkColor,
  footerTextFontSize: capFontSize(toNumber(rawProps?.footerTextFontSize ?? rawProps?.subtextSize ?? rawProps?.fontSize, defaultSignUpTokens.footerTextFontSize), 14),
  footerTextFontFamily: toFontFamily(rawProps?.footerTextFontFamily ?? rawProps?.subtextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.footerTextFontFamily),
  footerTextFontWeight: toFontWeight(rawProps?.footerTextFontWeight ?? rawProps?.subtextWeight ?? rawProps?.fontWeight, defaultSignUpTokens.footerTextFontWeight),
  footerLinkFontSize: capFontSize(toNumber(rawProps?.footerLinkFontSize, defaultSignUpTokens.footerLinkFontSize), 14),
  footerLinkFontFamily: toFontFamily(rawProps?.footerLinkFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.footerLinkFontFamily),
  footerLinkFontWeight: toFontWeight(rawProps?.footerLinkFontWeight, defaultSignUpTokens.footerLinkFontWeight),
  footerLinkAlignment: (rawProps?.footerLinkAlignment as string) ?? defaultSignUpTokens.footerLinkAlignment,
  footerLinkAutoUppercase: (rawProps?.footerLinkAutoUppercase as boolean) ?? defaultSignUpTokens.footerLinkAutoUppercase,
  footerVisible: (rawProps?.footerVisible as boolean) ?? defaultSignUpTokens.footerVisible,
  signInLinkVisible: (rawProps?.signInLinkVisible as boolean) ?? defaultSignUpTokens.signInLinkVisible,
  buttonVisible: (rawProps?.buttonVisible as boolean) ?? defaultSignUpTokens.buttonVisible,
  showProfilePicture: (rawProps?.showProfilePicture as boolean) ?? defaultSignUpTokens.showProfilePicture,
  profilePictureUrl: (rawProps?.profilePictureUrl as string) ?? defaultSignUpTokens.profilePictureUrl,
  profilePictureSize: toNumber(rawProps?.profilePictureSize, defaultSignUpTokens.profilePictureSize),
  profilePictureBgColor: (rawProps?.profilePictureBgColor as string) ?? defaultSignUpTokens.profilePictureBgColor,
  profilePictureBorderColor: (rawProps?.profilePictureBorderColor as string) ?? defaultSignUpTokens.profilePictureBorderColor,
  buttonRadius: toNumber(rawProps?.buttonRadius ?? rawProps?.buttonBorderRadius, defaultSignUpTokens.buttonRadius),
  inputBorderRadius: toNumber(rawProps?.borderRadius ?? rawProps?.inputRadius ?? rawProps?.inputBorderRadius, defaultSignUpTokens.inputBorderRadius),
  headlineSize: toNumber(rawProps?.headlineSize, defaultSignUpTokens.headlineSize),
  headlineWeight: toFontWeight(rawProps?.headlineWeight, defaultSignUpTokens.headlineWeight),
  headlineFontFamily: toFontFamily(rawProps?.headlineFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.headlineFontFamily),
  subtextSize: toNumber(rawProps?.subtextSize, defaultSignUpTokens.subtextSize),
  subtextWeight: toFontWeight(rawProps?.subtextWeight, defaultSignUpTokens.subtextWeight),
  subtextFontFamily: toFontFamily(rawProps?.subtextFontFamily ?? rawProps?.fontFamily, defaultSignUpTokens.subtextFontFamily),
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
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
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
  rightSlot,
}) => {
  const shouldShowLabel = labelVisible && !placeholderVisible && Boolean(label);
  const usePlaceholderTypography = placeholderVisible && !value;
  const resolvedInputFontSize = usePlaceholderTypography ? placeholderFontSize ?? inputFontSize : inputFontSize;
  const resolvedInputFontFamily = usePlaceholderTypography ? placeholderFontFamily ?? inputFontFamily : inputFontFamily;
  const resolvedInputFontWeight = usePlaceholderTypography ? placeholderFontWeight ?? inputFontWeight : inputFontWeight;
  const resolvedInputAlign = 'left';
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
  </View>
  );
};

const fieldStyles = StyleSheet.create({
  group: { width: '100%' },
  label: { marginBottom: 6 },
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

// ─── Main screen ─────────────────────────────────────────────────────────────

const AuthScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { login, signup, session, initializing } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [signInTokens, setSignInTokens] = useState<SignInTokens>(defaultSignInTokens);
  const [signUpTokens, setSignUpTokens] = useState<SignUpTokens>(defaultSignUpTokens);
  const [forgotPasswordTokens, setForgotPasswordTokens] = useState<ForgotPasswordTokens>(defaultForgotPasswordTokens);
  const [signInHeaderConfig, setSignInHeaderConfig] = useState<Record<string, unknown> | null>(null);
  const [signUpHeaderConfig, setSignUpHeaderConfig] = useState<Record<string, unknown> | null>(null);
  const [signInDslSections, setSignInDslSections] = useState<Record<string, unknown>[]>([]);
  const [signUpDslSections, setSignUpDslSections] = useState<Record<string, unknown>[]>([]);
  const [hasForgotPasswordSection, setHasForgotPasswordSection] = useState(false);
  const [dslLoaded, setDslLoaded] = useState(false);
  const isMountedRef = useRef(true);
  const loginToastPendingRef = useRef(false);
  const currentModeRef = useRef<'login' | 'signup'>('login');

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    currentModeRef.current = mode;
  }, [mode]);

  const resetAuthFormFields = useCallback(() => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setError('');
    setPasswordVisible(false);
  }, []);

  const switchAuthMode = useCallback((nextMode: 'login' | 'signup') => {
    if (currentModeRef.current === nextMode) return;
    currentModeRef.current = nextMode;
    resetAuthFormFields();
    setMode(nextMode);
  }, [resetAuthFormFields]);

  const loadAuthLayout = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const [signInDsl, signUpDsl] = await Promise.all([
        fetchDSL(undefined, 'signin'),
        fetchDSL(undefined, 'create-account'),
      ]);
      if (!isMountedRef.current) return;

      const liveSignInSections = Array.isArray(signInDsl?.dsl?.sections) ? signInDsl.dsl.sections : [];
      const liveSignUpSections = Array.isArray(signUpDsl?.dsl?.sections) ? signUpDsl.dsl.sections : [];
      const hasLiveSignInPage = hasAuthSections(liveSignInSections, (section) =>
        isSignInSection(section) || isForgotPasswordSection(section)
      );
      const hasLiveSignUpPage = hasAuthSections(liveSignUpSections, isSignUpSection);
      const signInSections = hasLiveSignInPage ? liveSignInSections : (authLayoutFallback.sections || []);
      const signUpSections = hasLiveSignUpPage ? liveSignUpSections : [];

      const signInSection = signInSections.find(isSignInSection);
      const forgotSection = signInSections.find(isForgotPasswordSection);
      const signUpSection = signUpSections.find(isSignUpSection);

      setSignInDslSections(signInSections as Record<string, unknown>[]);
      setSignUpDslSections(signUpSections as Record<string, unknown>[]);
      setHasForgotPasswordSection(Boolean(forgotSection));
      setSignInTokens(signInSection ? buildSignInTokens(getSectionRawProps(signInSection)) : defaultSignInTokens);
      setForgotPasswordTokens(forgotSection ? buildForgotPasswordTokens(getSectionRawProps(forgotSection)) : defaultForgotPasswordTokens);
      setSignUpTokens(signUpSection ? buildSignUpTokens(getSectionRawProps(signUpSection)) : defaultSignUpTokens);
      setSignInHeaderConfig(hasLiveSignInPage ? ((signInDsl?.dsl?.headerdefault as Record<string, unknown> | undefined) ?? null) : null);
      setSignUpHeaderConfig(hasLiveSignUpPage ? ((signUpDsl?.dsl?.headerdefault as Record<string, unknown> | undefined) ?? null) : null);
    } finally {
      if (isMountedRef.current) { setRefreshing(false); setDslLoaded(true); }
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
      const targetName = hasPostLoginTarget ? (postLoginTarget?.name as string) : 'LayoutScreen';
      const targetParams = hasPostLoginTarget ? (postLoginTarget?.params as Record<string, unknown> | undefined) : undefined;
      const mergedParams = loginSuccessToast ? { ...(targetParams || {}), loginSuccessToast } : targetParams;

      navigation.reset({ index: 0, routes: [{ name: targetName as never, params: mergedParams as never }] });
    }
  }, [session, navigation, route?.params]);

  useEffect(() => { loadAuthLayout(); }, [loadAuthLayout]);

  useEffect(() => {
    const id = setInterval(() => { loadAuthLayout(); }, 5000);
    return () => clearInterval(id);
  }, [loadAuthLayout]);

  useFocusEffect(useCallback(() => { loadAuthLayout(); }, [loadAuthLayout]));

  useEffect(() => {
    const initialMode = (route?.params as { initialMode?: string } | undefined)?.initialMode;
    if (initialMode === 'signup' || initialMode === 'login') switchAuthMode(initialMode);
  }, [route?.params, switchAuthMode]);

  const t = mode === 'signup' ? signUpTokens : signInTokens;
  const activeHeaderConfig = useMemo(() => {
    const dslConfig = mode === 'login' ? signInHeaderConfig : signUpHeaderConfig;
    const base = dslConfig ?? getHeaderDefault();
    if (!base) return null;
    const rawTitle = (base as Record<string, unknown>).title as string | undefined;
    const isMobidragTitle = !rawTitle || rawTitle === 'Mobidrag' || rawTitle === 'MobiDrag';
    if (isMobidragTitle) {
      return { ...base, title: getAppNameSync() } as Record<string, unknown>;
    }
    return base;
  }, [mode, signInHeaderConfig, signUpHeaderConfig]);

  const toggleMode = () => {
    switchAuthMode(currentModeRef.current === 'login' ? 'signup' : 'login');
  };

  const validateForm = () => {
    const e = email.trim(), p = password.trim(), fn = firstName.trim(), ln = lastName.trim();
    if (!e || !p) return 'Email and password are required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Enter a valid email address.';
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

  const handleForgotPassword = () => {
    const rawDomain = session?.user?.shopifyDomain || getShopifyDomain();
    const normalizedDomain = rawDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (navigation?.navigate) {
      (navigation as any).navigate('CheckoutWebView', { url: `https://${normalizedDomain}/account/login#recover`, title: 'Forgot Password' });
    }
  };

  const buttonLabel = useMemo(() => {
    const label = t.buttonText;
    return t.buttonAutoUppercase ? label.toUpperCase() : label;
  }, [t]);

  const buttonWidthStyle = useMemo(() => {
    const w = t.buttonWidth;
    if (w > 0 && w < 100) return { width: `${w}%` as const, alignSelf: 'center' as const };
    return { alignSelf: 'stretch' as const };
  }, [t.buttonWidth]);

  const submitButtonContent = loading ? (
    <ActivityIndicator color={t.buttonTextColor} />
  ) : (
    <Text
      allowFontScaling={false}
      style={{
        color: t.buttonTextColor,
        fontSize: t.buttonFontSize,
        fontWeight: t.buttonFontWeight as any,
        fontFamily: t.buttonFontFamily !== 'System' ? t.buttonFontFamily : undefined,
      }}
    >
      {buttonLabel}
    </Text>
  );

  const signInDecorSections = useMemo(
    () =>
      signInDslSections.filter((section) => {
        const component = getSectionComponent(section);
        return !SIGN_IN_COMPONENTS.has(component) && !FORGOT_PASSWORD_COMPONENTS.has(component);
      }),
    [signInDslSections]
  );

  const hasDynamicSignInLayout = mode === 'login' && signInDecorSections.length > 0;
  const signUpDecorSections = useMemo(
    () =>
      signUpDslSections.filter((section) => {
        const component = getSectionComponent(section);
        return !SIGN_UP_COMPONENTS.has(component);
      }),
    [signUpDslSections]
  );

  const hasDynamicSignUpLayout = mode === 'signup' && signUpDecorSections.length > 0;

  if (!dslLoaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F7F7', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0C9297" />
      </SafeAreaView>
    );
  }

  const pagePadLeft = t.pagePaddingLeft;
  const pagePadRight = t.pagePaddingRight;
  const pagePadTop = t.pagePaddingTop;
  const pagePadBottom = t.pagePaddingBottom;
  const cardPadTop = t.cardPaddingTop;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgColor }}>
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
            (mode === 'login' ? signInDecorSections : signUpDecorSections).map((section, index) => (
              <DynamicRenderer key={`${mode}-dsl-${index}`} section={section as any} />
            ))
          ) : (
          <View style={{ paddingLeft: pagePadLeft, paddingRight: pagePadRight, paddingTop: pagePadTop, paddingBottom: t.formGap }}>
            {mode === 'login' && t.authVisible ? (
              <Text
                style={{
                  color: signInTokens.titleColor,
                  fontSize: signInTokens.headlineSize,
                  fontWeight: signInTokens.headlineWeight as any,
                  fontFamily: signInTokens.headlineFontFamily !== 'System' ? signInTokens.headlineFontFamily : undefined,
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
              backgroundColor: t.cardBgColor,
              borderRadius: t.cardBorderRadius,
              borderWidth: t.cardBorderWidth,
              borderColor: t.cardBorderColor,
              paddingLeft: t.cardPaddingLeft,
              paddingRight: t.cardPaddingRight,
              paddingTop: cardPadTop,
              paddingBottom: t.cardPaddingBottom,
              marginBottom: t.formCardMarginBottom,
            }}
          >
            {/* Profile picture (signup only) */}
            {mode === 'signup' && signUpTokens.showProfilePicture && signUpTokens.profilePictureUrl ? (
              <View
                style={{
                  width: signUpTokens.profilePictureSize,
                  height: signUpTokens.profilePictureSize,
                  borderRadius: signUpTokens.profilePictureSize / 2,
                  backgroundColor: signUpTokens.profilePictureBgColor,
                  borderWidth: 2,
                  borderColor: signUpTokens.profilePictureBorderColor,
                  alignSelf: 'center',
                  marginBottom: 20,
                  overflow: 'hidden',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Image
                  source={{ uri: signUpTokens.profilePictureUrl }}
                  style={{ width: signUpTokens.profilePictureSize, height: signUpTokens.profilePictureSize }}
                />
              </View>
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
                fieldGap={signUpTokens.fieldGap}
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
                fieldGap={signUpTokens.fieldGap}
                inputPaddingHorizontal={signUpTokens.inputPaddingHorizontal}
                inputPaddingVertical={signUpTokens.inputPaddingVertical}
                cardBgColor={signUpTokens.cardBgColor}
                autoCapitalize="words"
              />
            ) : null}

            {/* Email */}
            {(mode === 'login' || signUpTokens.emailInputVisible) ? (
              <FormField
                label={mode === 'login' ? signInTokens.emailLabelText : signUpTokens.emailLabelText}
                labelVisible={mode === 'login' ? signInTokens.emailLabelVisible : signUpTokens.emailLabelVisible}
                labelColor={mode === 'login' ? signInTokens.emailLabelColor : signUpTokens.emailLabelColor}
                labelFontSize={mode === 'login' ? signInTokens.emailLabelFontSize : signUpTokens.emailLabelFontSize}
                labelFontFamily={mode === 'login' ? signInTokens.emailLabelFontFamily : signUpTokens.emailLabelFontFamily}
                labelFontWeight={mode === 'login' ? signInTokens.emailLabelFontWeight : signUpTokens.emailLabelFontWeight}
                labelAlign="left"
                placeholder={mode === 'login' ? signInTokens.emailPlaceholder : signUpTokens.emailPlaceholder}
                placeholderVisible={mode === 'login' ? signInTokens.emailPlaceholderVisible : signUpTokens.emailPlaceholderVisible}
                placeholderColor={mode === 'login' ? signInTokens.emailPlaceholderColor : signUpTokens.emailPlaceholderColor}
                placeholderFontSize={mode === 'login' ? signInTokens.emailPlaceholderFontSize : signUpTokens.emailPlaceholderFontSize}
                placeholderFontFamily={mode === 'login' ? signInTokens.emailPlaceholderFontFamily : signUpTokens.emailPlaceholderFontFamily}
                placeholderFontWeight={mode === 'login' ? signInTokens.emailPlaceholderFontWeight : signUpTokens.emailPlaceholderFontWeight}
                value={email}
                onChangeText={setEmail}
                inputColor={mode === 'login' ? signInTokens.emailInputTextColor : signUpTokens.emailInputTextColor}
                inputFontSize={mode === 'login' ? signInTokens.emailInputTextFontSize : signUpTokens.emailInputTextFontSize}
                inputFontFamily={mode === 'login' ? signInTokens.emailInputTextFontFamily : signUpTokens.emailInputTextFontFamily}
                inputFontWeight={mode === 'login' ? signInTokens.emailInputTextFontWeight : signUpTokens.emailInputTextFontWeight}
                inputAlign={mode === 'signup' ? toTextAlign(signUpTokens.emailInputTextAlignment) : 'left'}
                inputBorderColor={t.inputBorderColor}
                inputBorderRadius={t.inputBorderRadius}
                inputHeight={t.inputHeight}
                fieldGap={t.fieldGap}
                inputPaddingHorizontal={t.inputPaddingHorizontal}
                inputPaddingVertical={t.inputPaddingVertical}
                cardBgColor={t.cardBgColor}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}

            {/* Password */}
            {(mode === 'login' || signUpTokens.passwordInputVisible) ? (
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
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                inputColor={mode === 'login' ? signInTokens.passwordInputTextColor : signUpTokens.passwordInputTextColor}
                inputFontSize={mode === 'login' ? signInTokens.passwordInputTextFontSize : signUpTokens.passwordInputTextFontSize}
                inputFontFamily={mode === 'login' ? signInTokens.passwordInputTextFontFamily : signUpTokens.passwordInputTextFontFamily}
                inputFontWeight={mode === 'login' ? signInTokens.passwordInputTextFontWeight : signUpTokens.passwordInputTextFontWeight}
                inputAlign={mode === 'signup' ? toTextAlign(signUpTokens.passwordInputTextAlignment) : 'left'}
                inputBorderColor={t.inputBorderColor}
                inputBorderRadius={t.inputBorderRadius}
                inputHeight={t.inputHeight}
                fieldGap={t.fieldGap}
                inputPaddingHorizontal={t.inputPaddingHorizontal}
                inputPaddingVertical={t.inputPaddingVertical}
                cardBgColor={t.cardBgColor}
                autoCapitalize="none"
                autoCorrect={false}
                rightSlot={
                  <TouchableOpacity
                    onPress={() => setPasswordVisible((p) => !p)}
                    style={{ paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' }}
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name={passwordVisible ? 'eye-slash' : 'eye'} size={16} color={t.inputBorderColor} />
                  </TouchableOpacity>
                }
              />
            ) : null}

            {/* Error */}
            {error ? (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '500' }}>{error}</Text>
              </View>
            ) : null}

            {/* Submit button */}
            {(mode === 'login' || signUpTokens.buttonVisible) ? (
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading || initializing}
                style={[
                  {
                    backgroundColor: t.buttonGradient ? 'transparent' : t.buttonFillColor,
                    borderRadius: t.buttonRadius,
                    borderWidth: t.buttonBorderWidth,
                    borderColor: t.buttonBorderColor,
                    height: t.buttonHeight,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: t.buttonMarginTop,
                    overflow: 'hidden',
                  },
                  buttonWidthStyle,
                ]}
              >
                {t.buttonGradient ? (
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

            {/* Footer switcher */}
            {t.footerVisible ? (
              <View
                style={{
                  marginTop: t.footerMarginTop,
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
                  }}
                >
                  {mode === 'login' ? signInTokens.footerText : signUpTokens.footerText}
                </Text>
                {(mode === 'login' || signUpTokens.signInLinkVisible) ? (
                  <TouchableOpacity
                    onPress={toggleMode}
                    accessibilityRole="button"
                    style={{
                      marginTop: t.footerInline ? 0 : t.footerLinkMarginTop,
                      marginLeft: t.footerInline ? 4 : 0,
                    }}
                  >
                    <Text
                      style={{
                        color: t.footerLinkColor,
                        fontSize: t.footerLinkFontSize,
                        fontWeight: t.footerLinkFontWeight as any,
                        fontFamily: t.footerLinkFontFamily !== 'System' ? t.footerLinkFontFamily : undefined,
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
          </View>

          {/* ── Forgot password card (login only) ─────────────────────── */}
          {mode === 'login' && hasForgotPasswordSection && signInTokens.forgotPasswordVisible ? (
            <View
              style={{
                marginLeft: pagePadLeft,
                marginRight: pagePadRight,
                backgroundColor: forgotPasswordTokens.cardBgColor,
                borderRadius: forgotPasswordTokens.cardBorderRadius,
                borderWidth: 1,
                borderColor: forgotPasswordTokens.cardBorderColor,
                paddingHorizontal: 16,
                paddingVertical: 16,
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
                }}
              >
                {forgotPasswordTokens.headlineText}
              </Text>
              <Text style={{ color: forgotPasswordTokens.titleColor, marginTop: 4, fontSize: 13, opacity: 0.8 }}>
                {forgotPasswordTokens.resetPasswordTitle}
              </Text>
              <TouchableOpacity
                onPress={handleForgotPassword}
                accessibilityRole="button"
                style={{
                  marginTop: 14,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: forgotPasswordTokens.buttonFillColor,
                  borderWidth: 1,
                  borderColor: forgotPasswordTokens.buttonBorderColor,
                }}
              >
                <Text style={{ color: forgotPasswordTokens.buttonTextColor, fontWeight: '700', fontSize: 14 }}>
                  {forgotPasswordTokens.resetPasswordButtonText}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AuthScreen;
