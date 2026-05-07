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
import Icon from 'react-native-vector-icons/FontAwesome6';
import { useAuth } from '../services/AuthContext';
import { fetchDSL } from '../engine/dslHandler';
import authLayoutFallback from '../data/authLayoutFallback';
import { getShopifyDomain } from '../services/shopify';
import HeaderDefaultComponent from '../components/HeaderDefault';
import DynamicRenderer from '../engine/DynamicRenderer';
import { getHeaderDefault } from '../services/headerDefaultService';
import { getAppNameSync } from '../utils/appInfo';

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
  buttonPaddingTop: number;
  buttonPaddingBottom: number;
  buttonAutoUppercase: boolean;
  authTitle: string;
  buttonText: string;
  footerText: string;
  footerLinkText: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
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
  buttonFontSize: number;
  buttonFontFamily: string;
  buttonFontWeight: string;
  buttonHeight: number;
  buttonWidth: number;
  footerTextFontSize: number;
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

const resolveButtonColor = (value: unknown, fallback: string): string => {
  const resolved = unwrapValue(value as string | null | undefined, fallback);
  if (typeof resolved === 'string' && resolved.trim().startsWith('linear-gradient')) {
    return fallback;
  }
  return resolved ?? fallback;
};

const resolveBorderWidth = (line: unknown, color: unknown, fallback: number): number => {
  const rawLine = String(unwrapValue(line as string | null | undefined, '') || '').trim().toLowerCase();
  if (rawLine === 'none' || rawLine === '0' || rawLine === '0px') return 0;
  const numeric = parseFloat(rawLine);
  if (Number.isFinite(numeric)) return numeric;
  const rawColor = String(unwrapValue(color as string | null | undefined, '') || '').trim().toLowerCase();
  if (!rawLine && (!rawColor || rawColor === 'transparent')) return 0;
  return rawLine || rawColor ? fallback : 0;
};

const normalizeSectionName = (value: unknown): string =>
  String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const getSectionComponent = (section: Record<string, unknown> | null | undefined): string => {
  const raw = unwrapValue((section?.component ?? (section?.properties as Record<string, unknown>)?.component) as string, '');
  return normalizeSectionName(raw);
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
  buttonPaddingTop: 14,
  buttonPaddingBottom: 14,
  buttonAutoUppercase: false,
  authTitle: 'Authentication',
  buttonText: 'Continue',
  footerText: "Don't have an account?",
  footerLinkText: 'Create an Account',
  emailPlaceholder: 'Enter email',
  passwordPlaceholder: 'Enter password',
  emailLabelText: 'Email',
  passwordLabelText: 'Password',
  emailLabelVisible: true,
  passwordLabelVisible: true,
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
  buttonFontSize: 16,
  buttonFontFamily: 'System',
  buttonFontWeight: '700',
  buttonHeight: 50,
  buttonWidth: 100,
  footerTextFontSize: 14,
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
  cardPaddingTop: 24,
  cardPaddingBottom: 24,
  cardPaddingLeft: 20,
  cardPaddingRight: 20,
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
  emailLabelVisible: true,
  firstNameLabelVisible: true,
  lastNameLabelVisible: true,
  passwordLabelVisible: true,
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
  pagePaddingTop: toNumber(rawProps?.subgpt ?? rawProps?.bgpt ?? rawProps?.pagePaddingTop, defaultSignInTokens.pagePaddingTop),
  pagePaddingBottom: toNumber(rawProps?.subgpb ?? rawProps?.bgpb ?? rawProps?.pagePaddingBottom, defaultSignInTokens.pagePaddingBottom),
  pagePaddingLeft: toNumber(rawProps?.subgpl ?? rawProps?.bgpl ?? rawProps?.pagePaddingLeft, defaultSignInTokens.pagePaddingLeft),
  pagePaddingRight: toNumber(rawProps?.subgpr ?? rawProps?.bgpr ?? rawProps?.pagePaddingRight, defaultSignInTokens.pagePaddingRight),
  inputBorderColor: (rawProps?.inputBorderColor as string) ?? defaultSignInTokens.inputBorderColor,
  inputHeight: toNumber(rawProps?.inputHeight ?? rawProps?.fieldHeight, defaultSignInTokens.inputHeight),
  footerTextColor: (rawProps?.footerTextColor as string) ?? defaultSignInTokens.footerTextColor,
  footerLinkColor: (rawProps?.footerLinkColor as string) ?? defaultSignInTokens.footerLinkColor,
  buttonTextColor: (rawProps?.buttontextColor as string) ?? (rawProps?.buttonTextColor as string) ?? defaultSignInTokens.buttonTextColor,
  buttonBorderColor: (rawProps?.buttonBorderColor as string) ?? defaultSignInTokens.buttonBorderColor,
  buttonBorderWidth: resolveBorderWidth(rawProps?.buttonBorderLine, rawProps?.buttonBorderColor, defaultSignInTokens.buttonBorderWidth),
  buttonFillColor: resolveButtonColor(rawProps?.buttonbgColor ?? rawProps?.buttonBgColor, defaultSignInTokens.buttonFillColor),
  buttonPaddingTop: toNumber(rawProps?.buttonPaddingTop, defaultSignInTokens.buttonPaddingTop),
  buttonPaddingBottom: toNumber(rawProps?.buttonPaddingBottom, defaultSignInTokens.buttonPaddingBottom),
  buttonAutoUppercase: (rawProps?.buttonAutoUppercase as boolean) ?? defaultSignInTokens.buttonAutoUppercase,
  authTitle: (rawProps?.authTitle as string) ?? defaultSignInTokens.authTitle,
  buttonText: (rawProps?.buttonText as string) ?? defaultSignInTokens.buttonText,
  footerText: (rawProps?.footerText as string) ?? defaultSignInTokens.footerText,
  footerLinkText: (rawProps?.footerLinkText as string) ?? defaultSignInTokens.footerLinkText,
  emailPlaceholder: (rawProps?.emailPlaceholder as string) ?? defaultSignInTokens.emailPlaceholder,
  passwordPlaceholder: (rawProps?.passwordPlaceholder as string) ?? defaultSignInTokens.passwordPlaceholder,
  emailLabelText: (rawProps?.emailLabelText as string) ?? defaultSignInTokens.emailLabelText,
  passwordLabelText: (rawProps?.passwordLabelText as string) ?? defaultSignInTokens.passwordLabelText,
  emailLabelVisible: (rawProps?.emailLabelVisible as boolean) ?? defaultSignInTokens.emailLabelVisible,
  passwordLabelVisible: (rawProps?.passwordLabelVisible as boolean) ?? defaultSignInTokens.passwordLabelVisible,
  emailLabelColor: (rawProps?.emailLabelColor as string) ?? defaultSignInTokens.emailLabelColor,
  passwordLabelColor: (rawProps?.passwordLabelColor as string) ?? defaultSignInTokens.passwordLabelColor,
  emailLabelFontSize: toNumber(rawProps?.emailLabelFontSize, defaultSignInTokens.emailLabelFontSize),
  passwordLabelFontSize: toNumber(rawProps?.passwordLabelFontSize, defaultSignInTokens.passwordLabelFontSize),
  emailLabelFontFamily: (rawProps?.emailLabelFontFamily as string) ?? defaultSignInTokens.emailLabelFontFamily,
  passwordLabelFontFamily: (rawProps?.passwordLabelFontFamily as string) ?? defaultSignInTokens.passwordLabelFontFamily,
  emailLabelFontWeight: toFontWeight(rawProps?.emailLabelFontWeight, defaultSignInTokens.emailLabelFontWeight),
  passwordLabelFontWeight: toFontWeight(rawProps?.passwordLabelFontWeight, defaultSignInTokens.passwordLabelFontWeight),
  emailInputTextColor: (rawProps?.emailInputTextColor as string) ?? defaultSignInTokens.emailInputTextColor,
  passwordInputTextColor: (rawProps?.passwordInputTextColor as string) ?? defaultSignInTokens.passwordInputTextColor,
  emailInputTextFontSize: toNumber(rawProps?.emailInputTextFontSize, defaultSignInTokens.emailInputTextFontSize),
  passwordInputTextFontSize: toNumber(rawProps?.passwordInputTextFontSize, defaultSignInTokens.passwordInputTextFontSize),
  emailInputTextFontFamily: (rawProps?.emailInputTextFontFamily as string) ?? defaultSignInTokens.emailInputTextFontFamily,
  passwordInputTextFontFamily: (rawProps?.passwordInputTextFontFamily as string) ?? defaultSignInTokens.passwordInputTextFontFamily,
  emailInputTextFontWeight: toFontWeight(rawProps?.emailInputTextFontWeight, defaultSignInTokens.emailInputTextFontWeight),
  passwordInputTextFontWeight: toFontWeight(rawProps?.passwordInputTextFontWeight, defaultSignInTokens.passwordInputTextFontWeight),
  emailPlaceholderColor: (rawProps?.emailPlaceholderColor as string) ?? defaultSignInTokens.emailPlaceholderColor,
  passwordPlaceholderColor: (rawProps?.passwordPlaceholderColor as string) ?? defaultSignInTokens.passwordPlaceholderColor,
  buttonFontSize: toNumber(rawProps?.buttonfontSize ?? rawProps?.buttonFontSize, defaultSignInTokens.buttonFontSize),
  buttonFontFamily: (rawProps?.buttonFontFamily as string) ?? defaultSignInTokens.buttonFontFamily,
  buttonFontWeight: toFontWeight(rawProps?.buttonfontWeight ?? rawProps?.buttonFontWeight, defaultSignInTokens.buttonFontWeight),
  buttonHeight: toNumber(rawProps?.buttonHeight, defaultSignInTokens.buttonHeight),
  buttonWidth: toNumber(rawProps?.buttonWidth, defaultSignInTokens.buttonWidth),
  footerTextFontSize: toNumber(rawProps?.footerTextFontSize, defaultSignInTokens.footerTextFontSize),
  footerLinkFontSize: toNumber(rawProps?.footerLinkFontSize, defaultSignInTokens.footerLinkFontSize),
  footerLinkFontFamily: (rawProps?.footerLinkFontFamily as string) ?? defaultSignInTokens.footerLinkFontFamily,
  footerLinkFontWeight: toFontWeight(rawProps?.footerLinkFontWeight, defaultSignInTokens.footerLinkFontWeight),
  footerLinkAlignment: (rawProps?.footerLinkAlignment as string) ?? defaultSignInTokens.footerLinkAlignment,
  footerVisible: toBoolean(rawProps?.footerVisible, defaultSignInTokens.footerVisible),
  forgotPasswordVisible: toBoolean(rawProps?.forgotPasswordVisible, defaultSignInTokens.forgotPasswordVisible),
  authVisible: toBoolean(rawProps?.authVisible, defaultSignInTokens.authVisible),
  buttonRadius: toNumber(rawProps?.buttonRadius ?? rawProps?.buttonBorderRadius, defaultSignInTokens.buttonRadius),
  inputBorderRadius: toNumber(rawProps?.borderRadius ?? rawProps?.inputRadius ?? rawProps?.inputBorderRadius, defaultSignInTokens.inputBorderRadius),
  headlineSize: toNumber(rawProps?.headlineSize, defaultSignInTokens.headlineSize),
  headlineWeight: toFontWeight(rawProps?.headlineWeight, defaultSignInTokens.headlineWeight),
  headlineFontFamily: (rawProps?.headlineFontFamily as string) ?? defaultSignInTokens.headlineFontFamily,
  subtextSize: toNumber(rawProps?.subtextSize, defaultSignInTokens.subtextSize),
  subtextWeight: toFontWeight(rawProps?.subtextWeight, defaultSignInTokens.subtextWeight),
  subtextFontFamily: (rawProps?.subtextFontFamily as string) ?? defaultSignInTokens.subtextFontFamily,
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
  headlineFontFamily: (rawProps?.headlineFontFamily as string) ?? defaultForgotPasswordTokens.headlineFontFamily,
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
  headerTitle: (rawProps?.headerTitle as string) ?? defaultSignUpTokens.headerTitle,
  headerTitleColor: (rawProps?.headerTitleColor as string) ?? defaultSignUpTokens.headerTitleColor,
  headerTitleFontSize: toNumber(rawProps?.headerTitleFontSize, defaultSignUpTokens.headerTitleFontSize),
  headerTitleFontFamily: (rawProps?.headerTitleFontFamily as string) ?? defaultSignUpTokens.headerTitleFontFamily,
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
  emailLabelFontFamily: (rawProps?.emailLabelFontFamily as string) ?? defaultSignUpTokens.emailLabelFontFamily,
  firstNameLabelFontFamily: (rawProps?.firstNameLabelFontFamily as string) ?? defaultSignUpTokens.firstNameLabelFontFamily,
  lastNameLabelFontFamily: (rawProps?.lastNameLabelFontFamily as string) ?? defaultSignUpTokens.lastNameLabelFontFamily,
  passwordLabelFontFamily: (rawProps?.passwordLabelFontFamily as string) ?? defaultSignUpTokens.passwordLabelFontFamily,
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
  emailInputTextFontFamily: (rawProps?.emailInputTextFontFamily as string) ?? defaultSignUpTokens.emailInputTextFontFamily,
  firstNameInputTextFontFamily: (rawProps?.firstNameInputTextFontFamily as string) ?? defaultSignUpTokens.firstNameInputTextFontFamily,
  lastNameInputTextFontFamily: (rawProps?.lastNameInputTextFontFamily as string) ?? defaultSignUpTokens.lastNameInputTextFontFamily,
  passwordInputTextFontFamily: (rawProps?.passwordInputTextFontFamily as string) ?? defaultSignUpTokens.passwordInputTextFontFamily,
  emailInputTextFontWeight: toFontWeight(rawProps?.emailInputTextFontWeight, defaultSignUpTokens.emailInputTextFontWeight),
  firstNameInputTextFontWeight: toFontWeight(rawProps?.firstNameInputTextFontWeight, defaultSignUpTokens.firstNameInputTextFontWeight),
  lastNameInputTextFontWeight: toFontWeight(rawProps?.lastNameInputTextFontWeight, defaultSignUpTokens.lastNameInputTextFontWeight),
  passwordInputTextFontWeight: toFontWeight(rawProps?.passwordInputTextFontWeight, defaultSignUpTokens.passwordInputTextFontWeight),
  emailPlaceholderColor: (rawProps?.emailPlaceholderColor as string) ?? defaultSignUpTokens.emailPlaceholderColor,
  firstNamePlaceholderColor: (rawProps?.firstNamePlaceholderColor as string) ?? defaultSignUpTokens.firstNamePlaceholderColor,
  lastNamePlaceholderColor: (rawProps?.lastNamePlaceholderColor as string) ?? defaultSignUpTokens.lastNamePlaceholderColor,
  passwordPlaceholderColor: (rawProps?.passwordPlaceholderColor as string) ?? defaultSignUpTokens.passwordPlaceholderColor,
  buttonTextColor: (rawProps?.buttontextColor as string) ?? (rawProps?.buttonTextColor as string) ?? defaultSignUpTokens.buttonTextColor,
  buttonBorderColor: (rawProps?.buttonBorderColor as string) ?? defaultSignUpTokens.buttonBorderColor,
  buttonBorderWidth: resolveBorderWidth(rawProps?.buttonBorderLine, rawProps?.buttonBorderColor, defaultSignUpTokens.buttonBorderWidth),
  buttonFillColor: resolveButtonColor(rawProps?.buttonbgColor ?? rawProps?.buttonBgColor, defaultSignUpTokens.buttonFillColor),
  buttonPaddingTop: toNumber(rawProps?.buttonPaddingTop, defaultSignUpTokens.buttonPaddingTop),
  buttonPaddingBottom: toNumber(rawProps?.buttonPaddingBottom, defaultSignUpTokens.buttonPaddingBottom),
  buttonAutoUppercase: (rawProps?.buttonAutoUppercase as boolean) ?? defaultSignUpTokens.buttonAutoUppercase,
  buttonHeight: toNumber(rawProps?.buttonHeight, defaultSignUpTokens.buttonHeight),
  buttonWidth: toNumber(rawProps?.buttonWidth, defaultSignUpTokens.buttonWidth),
  buttonFontSize: toNumber(rawProps?.buttonfontSize ?? rawProps?.buttonFontSize, defaultSignUpTokens.buttonFontSize),
  buttonFontFamily: (rawProps?.buttonFontFamily as string) ?? defaultSignUpTokens.buttonFontFamily,
  buttonFontWeight: toFontWeight(rawProps?.buttonfontWeight ?? rawProps?.buttonFontWeight, defaultSignUpTokens.buttonFontWeight),
  footerTextColor: (rawProps?.footerTextColor as string) ?? defaultSignUpTokens.footerTextColor,
  footerLinkColor: (rawProps?.footerLinkColor as string) ?? defaultSignUpTokens.footerLinkColor,
  footerTextFontSize: capFontSize(toNumber(rawProps?.footerTextFontSize, defaultSignUpTokens.footerTextFontSize), 14),
  footerLinkFontSize: capFontSize(toNumber(rawProps?.footerLinkFontSize, defaultSignUpTokens.footerLinkFontSize), 14),
  footerLinkFontFamily: (rawProps?.footerLinkFontFamily as string) ?? defaultSignUpTokens.footerLinkFontFamily,
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
  headlineFontFamily: (rawProps?.headlineFontFamily as string) ?? defaultSignUpTokens.headlineFontFamily,
  subtextSize: toNumber(rawProps?.subtextSize, defaultSignUpTokens.subtextSize),
  subtextWeight: toFontWeight(rawProps?.subtextWeight, defaultSignUpTokens.subtextWeight),
  subtextFontFamily: (rawProps?.subtextFontFamily as string) ?? defaultSignUpTokens.subtextFontFamily,
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
  placeholderColor: string;
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
  placeholderColor,
  value,
  onChangeText,
  inputColor,
  inputFontSize,
  inputFontFamily,
  inputFontWeight,
  inputBorderColor,
  inputBorderRadius,
  inputHeight,
  cardBgColor,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  secureTextEntry = false,
  rightSlot,
}) => (
  <View style={fieldStyles.group}>
    {labelVisible && label ? (
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
        placeholder={placeholder}
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
            fontSize: inputFontSize,
            fontFamily: inputFontFamily !== 'System' ? inputFontFamily : undefined,
            fontWeight: inputFontWeight as any,
            textAlign: 'left',
            textAlignVertical: 'center',
            flex: rightSlot ? 1 : undefined,
            minHeight: inputHeight,
          },
        ]}
      />
      {rightSlot ?? null}
    </View>
  </View>
);

const fieldStyles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 50,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 50,
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

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const loadAuthLayout = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const [signInDsl, signUpDsl] = await Promise.all([
        fetchDSL(undefined, 'signin'),
        fetchDSL(undefined, 'create-account'),
      ]);
      if (!isMountedRef.current) return;

      const livSignInSections = Array.isArray(signInDsl?.dsl?.sections) ? signInDsl.dsl.sections : [];
      const signInSections = livSignInSections.length > 0 ? livSignInSections : (authLayoutFallback.sections || []);
      const signUpSections = Array.isArray(signUpDsl?.dsl?.sections) ? signUpDsl.dsl.sections : [];

      const signInSection = signInSections.find((s) => { const c = getSectionComponent(s); return c === 'signin' || c === 'sign_in'; });
      const forgotSection = signInSections.find((s) => { const c = getSectionComponent(s); return c === 'forgot_password' || c === 'forgotpassword'; });
      const signUpSection = signUpSections.find((s) => { const c = getSectionComponent(s); return c === 'signup' || c === 'sign_up'; });

      setSignInDslSections(signInSections as Record<string, unknown>[]);
      setSignUpDslSections(signUpSections as Record<string, unknown>[]);
      setHasForgotPasswordSection(Boolean(forgotSection));
      if (signInSection) setSignInTokens(buildSignInTokens(getSectionRawProps(signInSection)));
      if (forgotSection) setForgotPasswordTokens(buildForgotPasswordTokens(getSectionRawProps(forgotSection)));
      if (signUpSection) setSignUpTokens(buildSignUpTokens(getSectionRawProps(signUpSection)));
      setSignInHeaderConfig((signInDsl?.dsl?.headerdefault as Record<string, unknown> | undefined) ?? null);
      setSignUpHeaderConfig((signUpDsl?.dsl?.headerdefault as Record<string, unknown> | undefined) ?? null);
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
    if (initialMode === 'signup' || initialMode === 'login') setMode(initialMode);
  }, [route?.params]);

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

  const toggleMode = () => { setMode((p) => (p === 'login' ? 'signup' : 'login')); setError(''); };

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

  const signInDecorSections = useMemo(
    () =>
      signInDslSections.filter((section) => {
        const component = getSectionComponent(section);
        return component !== 'signin' && component !== 'sign_in' && component !== 'forgot_password' && component !== 'forgotpassword';
      }),
    [signInDslSections]
  );

  const hasDynamicSignInLayout = mode === 'login' && signInDecorSections.length > 0;
  const signUpDecorSections = useMemo(
    () =>
      signUpDslSections.filter((section) => {
        const component = getSectionComponent(section);
        return component !== 'signup' && component !== 'sign_up';
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
  const pagePadTop = Math.min(t.pagePaddingTop, activeHeaderConfig ? 8 : 16);
  const pagePadBottom = t.pagePaddingBottom;
  const cardPadTop = Math.min(t.cardPaddingTop, mode === 'signup' ? 24 : 20);

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
          <View style={{ paddingLeft: pagePadLeft, paddingRight: pagePadRight, paddingTop: pagePadTop, paddingBottom: 6 }}>
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
              marginBottom: 16,
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
                placeholderColor={signUpTokens.firstNamePlaceholderColor}
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
                placeholderColor={signUpTokens.lastNamePlaceholderColor}
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
                placeholderColor={mode === 'login' ? signInTokens.emailPlaceholderColor : signUpTokens.emailPlaceholderColor}
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
                placeholderColor={mode === 'login' ? signInTokens.passwordPlaceholderColor : signUpTokens.passwordPlaceholderColor}
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
                    backgroundColor: t.buttonFillColor,
                    borderRadius: t.buttonRadius,
                    borderWidth: t.buttonBorderWidth,
                    borderColor: t.buttonBorderColor,
                    height: t.buttonHeight,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: 4,
                  },
                  buttonWidthStyle,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={t.buttonTextColor} />
                ) : (
                  <Text
                    style={{
                      color: t.buttonTextColor,
                      fontSize: t.buttonFontSize,
                      fontWeight: t.buttonFontWeight as any,
                      fontFamily: t.buttonFontFamily !== 'System' ? t.buttonFontFamily : undefined,
                    }}
                  >
                    {buttonLabel}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}

            {/* Footer switcher */}
            {t.footerVisible ? (
              <View style={{ marginTop: 20, alignItems: toFlexAlign(t.footerLinkAlignment, 'center') }}>
                <Text
                  style={{
                    color: t.footerTextColor,
                    fontSize: t.footerTextFontSize,
                  }}
                >
                  {mode === 'login' ? signInTokens.footerText : signUpTokens.footerText}
                </Text>
                {(mode === 'login' || signUpTokens.signInLinkVisible) ? (
                  <TouchableOpacity onPress={toggleMode} accessibilityRole="button" style={{ marginTop: 6 }}>
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
