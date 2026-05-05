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
import { useAuth } from '../services/AuthContext';
import { fetchDSL } from '../engine/dslHandler';
import authLayoutFallback from '../data/authLayoutFallback';
import { getShopifyDomain } from '../services/shopify';
import HeaderDefaultComponent from '../components/HeaderDefault';

type SignInTokens = {
  bgColor: string;
  titleColor: string;
  cardBgColor: string;
  cardBorderColor: string;
  cardBorderRadius: number;
  cardPaddingTop: number;
  cardPaddingBottom: number;
  cardPaddingLeft: number;
  cardPaddingRight: number;
  inputBorderColor: string;
  footerTextColor: string;
  footerLinkColor: string;
  buttonTextColor: string;
  buttonBorderColor: string;
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

const resolveButtonColor = (value: unknown, fallback: string): string => {
  const resolved = unwrapValue(value as string | null | undefined, fallback);
  if (typeof resolved === 'string' && resolved.trim().startsWith('linear-gradient')) {
    return fallback;
  }
  return resolved ?? fallback;
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
  cardBorderRadius: 16,
  cardPaddingTop: 20,
  cardPaddingBottom: 20,
  cardPaddingLeft: 20,
  cardPaddingRight: 20,
  inputBorderColor: '#C7DADA',
  footerTextColor: '#0a0a0a',
  footerLinkColor: '#027579',
  buttonTextColor: '#FFFFFF',
  buttonBorderColor: '#0c9297',
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
  emailLabelFontFamily: 'Inter, sans-serif',
  passwordLabelFontFamily: 'Inter, sans-serif',
  emailLabelFontWeight: '600',
  passwordLabelFontWeight: '600',
  emailInputTextColor: '#0a0a0a',
  passwordInputTextColor: '#0a0a0a',
  emailInputTextFontSize: 15,
  passwordInputTextFontSize: 15,
  emailInputTextFontFamily: 'Inter, sans-serif',
  passwordInputTextFontFamily: 'Inter, sans-serif',
  emailInputTextFontWeight: '400',
  passwordInputTextFontWeight: '400',
  emailPlaceholderColor: '#A0AEC0',
  passwordPlaceholderColor: '#A0AEC0',
  buttonFontSize: 16,
  buttonFontFamily: 'Inter, sans-serif',
  buttonFontWeight: '700',
  buttonHeight: 50,
  buttonWidth: 100,
  footerTextFontSize: 14,
  footerLinkFontSize: 14,
  footerLinkFontFamily: 'Inter, sans-serif',
  footerLinkFontWeight: '700',
  footerVisible: true,
  forgotPasswordVisible: true,
  authVisible: true,
  buttonRadius: 12,
  inputBorderRadius: 10,
  headlineSize: 18,
  headlineWeight: '700',
  headlineFontFamily: 'Inter',
  subtextSize: 16,
  subtextWeight: '600',
  subtextFontFamily: 'Inter',
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
  headlineFontSize: 20,
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
  authTitle: 'Create an Account',
  buttonText: 'Create Account',
  footerText: 'Already have an account?',
  footerLinkText: 'Sign in',
  headerTitle: 'Create an Account',
  headerTitleColor: '#065F63',
  headerTitleFontSize: 22,
  headerTitleFontFamily: 'Inter, sans-serif',
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
  emailLabelFontFamily: 'Inter, sans-serif',
  firstNameLabelFontFamily: 'Inter, sans-serif',
  lastNameLabelFontFamily: 'Inter, sans-serif',
  passwordLabelFontFamily: 'Inter, sans-serif',
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
  emailInputTextFontFamily: 'Inter, sans-serif',
  firstNameInputTextFontFamily: 'Inter, sans-serif',
  lastNameInputTextFontFamily: 'Inter, sans-serif',
  passwordInputTextFontFamily: 'Inter, sans-serif',
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
  buttonFontFamily: 'Inter, sans-serif',
  buttonFontWeight: '700',
  footerTextFontSize: 13,
  footerLinkFontSize: 14,
  footerLinkFontFamily: 'Inter, sans-serif',
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

const toTextDecoration = (
  underline?: boolean,
  strikethrough?: boolean
): ForgotPasswordTokens['headlineTextDecoration'] => {
  if (underline && strikethrough) return 'underline line-through';
  if (underline) return 'underline';
  if (strikethrough) return 'line-through';
  return 'none';
};

// Clamp DSL font sizes to sane mobile maximums so the signup form
// always looks visually consistent with the signin form regardless
// of what the builder sends (e.g. it may send 24px for everything).
const capFontSize = (value: number, max: number): number => Math.min(value, max);

const buildSignInTokens = (rawProps: Record<string, unknown>): SignInTokens => ({
  ...defaultSignInTokens,
  bgColor: (rawProps?.bgColor as string) ?? defaultSignInTokens.bgColor,
  titleColor: (rawProps?.titleColor as string) ?? defaultSignInTokens.titleColor,
  cardBgColor: (rawProps?.cardBgColor as string) ?? defaultSignInTokens.cardBgColor,
  cardBorderColor: (rawProps?.cardBorderColor as string) ?? defaultSignInTokens.cardBorderColor,
  cardBorderRadius: toNumber(rawProps?.borderRadius, defaultSignInTokens.cardBorderRadius),
  cardPaddingTop: toNumber(rawProps?.pt ?? rawProps?.paddingTop, defaultSignInTokens.cardPaddingTop),
  cardPaddingBottom: toNumber(
    rawProps?.pb ?? rawProps?.paddingBottom,
    defaultSignInTokens.cardPaddingBottom
  ),
  cardPaddingLeft: toNumber(rawProps?.pl ?? rawProps?.paddingLeft, defaultSignInTokens.cardPaddingLeft),
  cardPaddingRight: toNumber(
    rawProps?.pr ?? rawProps?.paddingRight,
    defaultSignInTokens.cardPaddingRight
  ),
  inputBorderColor: (rawProps?.inputBorderColor as string) ?? defaultSignInTokens.inputBorderColor,
  footerTextColor: (rawProps?.footerTextColor as string) ?? defaultSignInTokens.footerTextColor,
  footerLinkColor: (rawProps?.footerLinkColor as string) ?? defaultSignInTokens.footerLinkColor,
  buttonTextColor: (rawProps?.buttonTextColor as string) ?? defaultSignInTokens.buttonTextColor,
  buttonBorderColor: (rawProps?.buttonBorderColor as string) ?? defaultSignInTokens.buttonBorderColor,
  buttonFillColor: resolveButtonColor(rawProps?.buttonBgColor, defaultSignInTokens.buttonFillColor),
  buttonPaddingTop: toNumber(rawProps?.buttonPaddingTop, defaultSignInTokens.buttonPaddingTop),
  buttonPaddingBottom: toNumber(rawProps?.buttonPaddingBottom, defaultSignInTokens.buttonPaddingBottom),
  buttonAutoUppercase:
    (rawProps?.buttonAutoUppercase as boolean) ?? defaultSignInTokens.buttonAutoUppercase,
  authTitle: (rawProps?.authTitle as string) ?? defaultSignInTokens.authTitle,
  buttonText: (rawProps?.buttonText as string) ?? defaultSignInTokens.buttonText,
  footerText: (rawProps?.footerText as string) ?? defaultSignInTokens.footerText,
  footerLinkText: (rawProps?.footerLinkText as string) ?? defaultSignInTokens.footerLinkText,
  emailPlaceholder: (rawProps?.emailPlaceholder as string) ?? defaultSignInTokens.emailPlaceholder,
  passwordPlaceholder:
    (rawProps?.passwordPlaceholder as string) ?? defaultSignInTokens.passwordPlaceholder,
  emailLabelText: (rawProps?.emailLabelText as string) ?? defaultSignInTokens.emailLabelText,
  passwordLabelText:
    (rawProps?.passwordLabelText as string) ?? defaultSignInTokens.passwordLabelText,
  emailLabelVisible:
    (rawProps?.emailLabelVisible as boolean) ?? defaultSignInTokens.emailLabelVisible,
  passwordLabelVisible:
    (rawProps?.passwordLabelVisible as boolean) ?? defaultSignInTokens.passwordLabelVisible,
  emailLabelColor: (rawProps?.emailLabelColor as string) ?? defaultSignInTokens.emailLabelColor,
  passwordLabelColor:
    (rawProps?.passwordLabelColor as string) ?? defaultSignInTokens.passwordLabelColor,
  emailLabelFontSize: toNumber(rawProps?.emailLabelFontSize, defaultSignInTokens.emailLabelFontSize),
  passwordLabelFontSize: toNumber(
    rawProps?.passwordLabelFontSize,
    defaultSignInTokens.passwordLabelFontSize
  ),
  emailLabelFontFamily:
    (rawProps?.emailLabelFontFamily as string) ?? defaultSignInTokens.emailLabelFontFamily,
  passwordLabelFontFamily:
    (rawProps?.passwordLabelFontFamily as string) ?? defaultSignInTokens.passwordLabelFontFamily,
  emailLabelFontWeight: toFontWeight(
    rawProps?.emailLabelFontWeight,
    defaultSignInTokens.emailLabelFontWeight
  ),
  passwordLabelFontWeight: toFontWeight(
    rawProps?.passwordLabelFontWeight,
    defaultSignInTokens.passwordLabelFontWeight
  ),
  emailInputTextColor:
    (rawProps?.emailInputTextColor as string) ?? defaultSignInTokens.emailInputTextColor,
  passwordInputTextColor:
    (rawProps?.passwordInputTextColor as string) ?? defaultSignInTokens.passwordInputTextColor,
  emailInputTextFontSize: toNumber(
    rawProps?.emailInputTextFontSize,
    defaultSignInTokens.emailInputTextFontSize
  ),
  passwordInputTextFontSize: toNumber(
    rawProps?.passwordInputTextFontSize,
    defaultSignInTokens.passwordInputTextFontSize
  ),
  emailInputTextFontFamily:
    (rawProps?.emailInputTextFontFamily as string) ?? defaultSignInTokens.emailInputTextFontFamily,
  passwordInputTextFontFamily:
    (rawProps?.passwordInputTextFontFamily as string) ??
    defaultSignInTokens.passwordInputTextFontFamily,
  emailInputTextFontWeight: toFontWeight(
    rawProps?.emailInputTextFontWeight,
    defaultSignInTokens.emailInputTextFontWeight
  ),
  passwordInputTextFontWeight: toFontWeight(
    rawProps?.passwordInputTextFontWeight,
    defaultSignInTokens.passwordInputTextFontWeight
  ),
  emailPlaceholderColor:
    (rawProps?.emailPlaceholderColor as string) ?? defaultSignInTokens.emailPlaceholderColor,
  passwordPlaceholderColor:
    (rawProps?.passwordPlaceholderColor as string) ??
    defaultSignInTokens.passwordPlaceholderColor,
  buttonFontSize: toNumber(rawProps?.buttonFontSize, defaultSignInTokens.buttonFontSize),
  buttonFontFamily:
    (rawProps?.buttonFontFamily as string) ?? defaultSignInTokens.buttonFontFamily,
  buttonFontWeight: toFontWeight(rawProps?.buttonFontWeight, defaultSignInTokens.buttonFontWeight),
  buttonHeight: toNumber(rawProps?.buttonHeight, defaultSignInTokens.buttonHeight),
  buttonWidth: toNumber(rawProps?.buttonWidth, defaultSignInTokens.buttonWidth),
  footerTextFontSize: toNumber(rawProps?.footerTextFontSize, defaultSignInTokens.footerTextFontSize),
  footerLinkFontSize: toNumber(rawProps?.footerLinkFontSize, defaultSignInTokens.footerLinkFontSize),
  footerLinkFontFamily:
    (rawProps?.footerLinkFontFamily as string) ?? defaultSignInTokens.footerLinkFontFamily,
  footerLinkFontWeight: toFontWeight(
    rawProps?.footerLinkFontWeight,
    defaultSignInTokens.footerLinkFontWeight
  ),
  footerVisible: (rawProps?.footerVisible as boolean) ?? defaultSignInTokens.footerVisible,
  forgotPasswordVisible:
    (rawProps?.forgotPasswordVisible as boolean) ?? defaultSignInTokens.forgotPasswordVisible,
  authVisible: (rawProps?.authVisible as boolean) ?? defaultSignInTokens.authVisible,
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
  cardBorderColor:
    (rawProps?.cardBorderColor as string) ?? defaultForgotPasswordTokens.cardBorderColor,
  cardBorderRadius: toNumber(rawProps?.borderRadius, defaultForgotPasswordTokens.cardBorderRadius),
  cardPaddingTop: toNumber(
    rawProps?.pt ?? rawProps?.paddingTop,
    defaultForgotPasswordTokens.cardPaddingTop
  ),
  cardPaddingBottom: toNumber(
    rawProps?.pb ?? rawProps?.paddingBottom,
    defaultForgotPasswordTokens.cardPaddingBottom
  ),
  cardPaddingLeft: toNumber(
    rawProps?.pl ?? rawProps?.paddingLeft,
    defaultForgotPasswordTokens.cardPaddingLeft
  ),
  cardPaddingRight: toNumber(
    rawProps?.pr ?? rawProps?.paddingRight,
    defaultForgotPasswordTokens.cardPaddingRight
  ),
  buttonTextColor:
    (rawProps?.buttonTextColor as string) ?? defaultForgotPasswordTokens.buttonTextColor,
  buttonBorderColor:
    (rawProps?.buttonBorderColor as string) ?? defaultForgotPasswordTokens.buttonBorderColor,
  buttonFillColor: resolveButtonColor(
    rawProps?.buttonBgColor,
    defaultForgotPasswordTokens.buttonFillColor
  ),
  headlineText: (rawProps?.headlineText as string) ?? defaultForgotPasswordTokens.headlineText,
  headlineFontSize: toNumber(
    rawProps?.headlineFontSize,
    defaultForgotPasswordTokens.headlineFontSize
  ),
  headlineFontFamily:
    (rawProps?.headlineFontFamily as string) ??
    defaultForgotPasswordTokens.headlineFontFamily,
  headlineFontWeight: toFontWeight(
    rawProps?.headlineFontWeight,
    defaultForgotPasswordTokens.headlineFontWeight,
    rawProps?.headlineBold as boolean | undefined
  ),
  headlineFontStyle:
    (rawProps?.headlineItalic as boolean | undefined) ? 'italic' : 'normal',
  headlineTextDecoration: toTextDecoration(
    rawProps?.headlineUnderline as boolean | undefined,
    rawProps?.headlineStrikethrough as boolean | undefined
  ),
  headlineTextTransform:
    (rawProps?.headlineAutoUppercase as boolean | undefined) ? 'uppercase' : 'none',
  resetPasswordTitle:
    (rawProps?.resetPasswordTitle as string) ?? defaultForgotPasswordTokens.resetPasswordTitle,
  resetPasswordButtonText:
    (rawProps?.resetPasswordButtonText as string) ??
    defaultForgotPasswordTokens.resetPasswordButtonText,
});

const buildSignUpTokens = (rawProps: Record<string, unknown>): SignUpTokens => ({
  ...defaultSignUpTokens,
  bgColor: (rawProps?.bgColor as string) ?? defaultSignUpTokens.bgColor,
  titleColor: (rawProps?.titleColor as string) ?? defaultSignUpTokens.titleColor,
  cardBgColor: (rawProps?.cardBgColor as string) ?? defaultSignUpTokens.cardBgColor,
  cardBorderColor:
    (rawProps?.cardBorderColor as string) ?? defaultSignUpTokens.cardBorderColor,
  cardBorderRadius: toNumber(rawProps?.borderRadius, defaultSignUpTokens.cardBorderRadius),
  cardPaddingTop: toNumber(rawProps?.pt ?? rawProps?.paddingTop, defaultSignUpTokens.cardPaddingTop),
  cardPaddingBottom: toNumber(
    rawProps?.pb ?? rawProps?.paddingBottom,
    defaultSignUpTokens.cardPaddingBottom
  ),
  cardPaddingLeft: toNumber(rawProps?.pl ?? rawProps?.paddingLeft, defaultSignUpTokens.cardPaddingLeft),
  cardPaddingRight: toNumber(
    rawProps?.pr ?? rawProps?.paddingRight,
    defaultSignUpTokens.cardPaddingRight
  ),
  inputBorderColor: (rawProps?.inputBorderColor as string) ?? defaultSignUpTokens.inputBorderColor,
  authTitle: (rawProps?.authTitle as string) ?? defaultSignUpTokens.authTitle,
  buttonText: (rawProps?.buttonText as string) ?? defaultSignUpTokens.buttonText,
  footerText: (rawProps?.footerText as string) ?? defaultSignUpTokens.footerText,
  footerLinkText: (rawProps?.footerLinkText as string) ?? defaultSignUpTokens.footerLinkText,
  emailPlaceholder: (rawProps?.emailPlaceholder as string) ?? defaultSignUpTokens.emailPlaceholder,
  passwordPlaceholder:
    (rawProps?.passwordPlaceholder as string) ?? defaultSignUpTokens.passwordPlaceholder,
  firstNamePlaceholder:
    (rawProps?.firstNamePlaceholder as string) ?? defaultSignUpTokens.firstNamePlaceholder,
  lastNamePlaceholder:
    (rawProps?.lastNamePlaceholder as string) ?? defaultSignUpTokens.lastNamePlaceholder,
  headerTitle: (rawProps?.headerTitle as string) ?? defaultSignUpTokens.headerTitle,
  headerTitleColor:
    (rawProps?.headerTitleColor as string) ?? defaultSignUpTokens.headerTitleColor,
  headerTitleFontSize: toNumber(
    rawProps?.headerTitleFontSize,
    defaultSignUpTokens.headerTitleFontSize
  ),
  headerTitleFontFamily:
    (rawProps?.headerTitleFontFamily as string) ?? defaultSignUpTokens.headerTitleFontFamily,
  headerTitleFontWeight: toFontWeight(
    rawProps?.headerTitleFontWeight,
    defaultSignUpTokens.headerTitleFontWeight
  ),
  emailAlignment: (rawProps?.emailAlignment as string) ?? defaultSignUpTokens.emailAlignment,
  firstNameAlignment:
    (rawProps?.firstNameAlignment as string) ?? defaultSignUpTokens.firstNameAlignment,
  lastNameAlignment:
    (rawProps?.lastNameAlignment as string) ?? defaultSignUpTokens.lastNameAlignment,
  passwordAlignment:
    (rawProps?.passwordAlignment as string) ?? defaultSignUpTokens.passwordAlignment,
  emailInputTextAlignment:
    (rawProps?.emailInputTextAlignment as string) ??
    defaultSignUpTokens.emailInputTextAlignment,
  firstNameInputTextAlignment:
    (rawProps?.firstNameInputTextAlignment as string) ??
    defaultSignUpTokens.firstNameInputTextAlignment,
  lastNameInputTextAlignment:
    (rawProps?.lastNameInputTextAlignment as string) ??
    defaultSignUpTokens.lastNameInputTextAlignment,
  passwordInputTextAlignment:
    (rawProps?.passwordInputTextAlignment as string) ??
    defaultSignUpTokens.passwordInputTextAlignment,
  emailLabelVisible:
    (rawProps?.emailLabelVisible as boolean) ?? defaultSignUpTokens.emailLabelVisible,
  firstNameLabelVisible:
    (rawProps?.firstNameLabelVisible as boolean) ?? defaultSignUpTokens.firstNameLabelVisible,
  lastNameLabelVisible:
    (rawProps?.lastNameLabelVisible as boolean) ?? defaultSignUpTokens.lastNameLabelVisible,
  passwordLabelVisible:
    (rawProps?.passwordLabelVisible as boolean) ?? defaultSignUpTokens.passwordLabelVisible,
  emailInputVisible:
    (rawProps?.emailInputVisible as boolean) ?? defaultSignUpTokens.emailInputVisible,
  firstNameVisible:
    (rawProps?.firstNameVisible as boolean) ?? defaultSignUpTokens.firstNameVisible,
  lastNameVisible:
    (rawProps?.lastNameVisible as boolean) ?? defaultSignUpTokens.lastNameVisible,
  passwordInputVisible:
    (rawProps?.passwordInputVisible as boolean) ?? defaultSignUpTokens.passwordInputVisible,
  emailLabelText: (rawProps?.emailLabelText as string) ?? defaultSignUpTokens.emailLabelText,
  firstNameLabelText:
    (rawProps?.firstNameLabelText as string) ?? defaultSignUpTokens.firstNameLabelText,
  lastNameLabelText:
    (rawProps?.lastNameLabelText as string) ?? defaultSignUpTokens.lastNameLabelText,
  passwordLabelText:
    (rawProps?.passwordLabelText as string) ?? defaultSignUpTokens.passwordLabelText,
  emailLabelColor: (rawProps?.emailLabelColor as string) ?? defaultSignUpTokens.emailLabelColor,
  firstNameLabelColor:
    (rawProps?.firstNameLabelColor as string) ?? defaultSignUpTokens.firstNameLabelColor,
  lastNameLabelColor:
    (rawProps?.lastNameLabelColor as string) ?? defaultSignUpTokens.lastNameLabelColor,
  passwordLabelColor:
    (rawProps?.passwordLabelColor as string) ?? defaultSignUpTokens.passwordLabelColor,
  emailLabelFontSize: capFontSize(toNumber(rawProps?.emailLabelFontSize, defaultSignUpTokens.emailLabelFontSize), 15),
  firstNameLabelFontSize: capFontSize(toNumber(rawProps?.firstNameLabelFontSize, defaultSignUpTokens.firstNameLabelFontSize), 15),
  lastNameLabelFontSize: capFontSize(toNumber(rawProps?.lastNameLabelFontSize, defaultSignUpTokens.lastNameLabelFontSize), 15),
  passwordLabelFontSize: capFontSize(toNumber(rawProps?.passwordLabelFontSize, defaultSignUpTokens.passwordLabelFontSize), 15),
  emailLabelFontFamily:
    (rawProps?.emailLabelFontFamily as string) ?? defaultSignUpTokens.emailLabelFontFamily,
  firstNameLabelFontFamily:
    (rawProps?.firstNameLabelFontFamily as string) ??
    defaultSignUpTokens.firstNameLabelFontFamily,
  lastNameLabelFontFamily:
    (rawProps?.lastNameLabelFontFamily as string) ??
    defaultSignUpTokens.lastNameLabelFontFamily,
  passwordLabelFontFamily:
    (rawProps?.passwordLabelFontFamily as string) ??
    defaultSignUpTokens.passwordLabelFontFamily,
  emailLabelFontWeight: toFontWeight(
    rawProps?.emailLabelFontWeight,
    defaultSignUpTokens.emailLabelFontWeight
  ),
  firstNameLabelFontWeight: toFontWeight(
    rawProps?.firstNameLabelFontWeight,
    defaultSignUpTokens.firstNameLabelFontWeight
  ),
  lastNameLabelFontWeight: toFontWeight(
    rawProps?.lastNameLabelFontWeight,
    defaultSignUpTokens.lastNameLabelFontWeight
  ),
  passwordLabelFontWeight: toFontWeight(
    rawProps?.passwordLabelFontWeight,
    defaultSignUpTokens.passwordLabelFontWeight
  ),
  emailInputTextColor:
    (rawProps?.emailInputTextColor as string) ?? defaultSignUpTokens.emailInputTextColor,
  firstNameInputTextColor:
    (rawProps?.firstNameInputTextColor as string) ?? defaultSignUpTokens.firstNameInputTextColor,
  lastNameInputTextColor:
    (rawProps?.lastNameInputTextColor as string) ?? defaultSignUpTokens.lastNameInputTextColor,
  passwordInputTextColor:
    (rawProps?.passwordInputTextColor as string) ?? defaultSignUpTokens.passwordInputTextColor,
  emailInputTextFontSize: capFontSize(toNumber(rawProps?.emailInputTextFontSize, defaultSignUpTokens.emailInputTextFontSize), 15),
  firstNameInputTextFontSize: capFontSize(toNumber(rawProps?.firstNameInputTextFontSize, defaultSignUpTokens.firstNameInputTextFontSize), 15),
  lastNameInputTextFontSize: capFontSize(toNumber(rawProps?.lastNameInputTextFontSize, defaultSignUpTokens.lastNameInputTextFontSize), 15),
  passwordInputTextFontSize: capFontSize(toNumber(rawProps?.passwordInputTextFontSize, defaultSignUpTokens.passwordInputTextFontSize), 15),
  emailInputTextFontFamily:
    (rawProps?.emailInputTextFontFamily as string) ??
    defaultSignUpTokens.emailInputTextFontFamily,
  firstNameInputTextFontFamily:
    (rawProps?.firstNameInputTextFontFamily as string) ??
    defaultSignUpTokens.firstNameInputTextFontFamily,
  lastNameInputTextFontFamily:
    (rawProps?.lastNameInputTextFontFamily as string) ??
    defaultSignUpTokens.lastNameInputTextFontFamily,
  passwordInputTextFontFamily:
    (rawProps?.passwordInputTextFontFamily as string) ??
    defaultSignUpTokens.passwordInputTextFontFamily,
  emailInputTextFontWeight: toFontWeight(
    rawProps?.emailInputTextFontWeight,
    defaultSignUpTokens.emailInputTextFontWeight
  ),
  firstNameInputTextFontWeight: toFontWeight(
    rawProps?.firstNameInputTextFontWeight,
    defaultSignUpTokens.firstNameInputTextFontWeight
  ),
  lastNameInputTextFontWeight: toFontWeight(
    rawProps?.lastNameInputTextFontWeight,
    defaultSignUpTokens.lastNameInputTextFontWeight
  ),
  passwordInputTextFontWeight: toFontWeight(
    rawProps?.passwordInputTextFontWeight,
    defaultSignUpTokens.passwordInputTextFontWeight
  ),
  emailPlaceholderColor:
    (rawProps?.emailPlaceholderColor as string) ?? defaultSignUpTokens.emailPlaceholderColor,
  firstNamePlaceholderColor:
    (rawProps?.firstNamePlaceholderColor as string) ??
    defaultSignUpTokens.firstNamePlaceholderColor,
  lastNamePlaceholderColor:
    (rawProps?.lastNamePlaceholderColor as string) ?? defaultSignUpTokens.lastNamePlaceholderColor,
  passwordPlaceholderColor:
    (rawProps?.passwordPlaceholderColor as string) ??
    defaultSignUpTokens.passwordPlaceholderColor,
  buttonTextColor: (rawProps?.buttonTextColor as string) ?? defaultSignUpTokens.buttonTextColor,
  buttonBorderColor:
    (rawProps?.buttonBorderColor as string) ?? defaultSignUpTokens.buttonBorderColor,
  buttonFillColor: resolveButtonColor(rawProps?.buttonBgColor, defaultSignUpTokens.buttonFillColor),
  buttonPaddingTop: toNumber(rawProps?.buttonPaddingTop, defaultSignUpTokens.buttonPaddingTop),
  buttonPaddingBottom: toNumber(
    rawProps?.buttonPaddingBottom,
    defaultSignUpTokens.buttonPaddingBottom
  ),
  buttonAutoUppercase:
    (rawProps?.buttonAutoUppercase as boolean) ?? defaultSignUpTokens.buttonAutoUppercase,
  buttonHeight: toNumber(rawProps?.buttonHeight, defaultSignUpTokens.buttonHeight),
  buttonWidth: toNumber(rawProps?.buttonWidth, defaultSignUpTokens.buttonWidth),
  buttonFontSize: capFontSize(toNumber(rawProps?.buttonFontSize, defaultSignUpTokens.buttonFontSize), 16),
  buttonFontFamily:
    (rawProps?.buttonFontFamily as string) ?? defaultSignUpTokens.buttonFontFamily,
  buttonFontWeight: toFontWeight(
    rawProps?.buttonFontWeight,
    defaultSignUpTokens.buttonFontWeight
  ),
  footerTextColor: (rawProps?.footerTextColor as string) ?? defaultSignUpTokens.footerTextColor,
  footerLinkColor: (rawProps?.footerLinkColor as string) ?? defaultSignUpTokens.footerLinkColor,
  footerTextFontSize: capFontSize(toNumber(rawProps?.footerTextFontSize, defaultSignUpTokens.footerTextFontSize), 14),
  footerLinkFontSize: capFontSize(toNumber(rawProps?.footerLinkFontSize, defaultSignUpTokens.footerLinkFontSize), 14),
  footerLinkFontFamily:
    (rawProps?.footerLinkFontFamily as string) ?? defaultSignUpTokens.footerLinkFontFamily,
  footerLinkFontWeight: toFontWeight(
    rawProps?.footerLinkFontWeight,
    defaultSignUpTokens.footerLinkFontWeight
  ),
  footerLinkAlignment:
    (rawProps?.footerLinkAlignment as string) ?? defaultSignUpTokens.footerLinkAlignment,
  footerLinkAutoUppercase:
    (rawProps?.footerLinkAutoUppercase as boolean) ?? defaultSignUpTokens.footerLinkAutoUppercase,
  footerVisible: (rawProps?.footerVisible as boolean) ?? defaultSignUpTokens.footerVisible,
  signInLinkVisible:
    (rawProps?.signInLinkVisible as boolean) ?? defaultSignUpTokens.signInLinkVisible,
  buttonVisible: (rawProps?.buttonVisible as boolean) ?? defaultSignUpTokens.buttonVisible,
  showProfilePicture:
    (rawProps?.showProfilePicture as boolean) ?? defaultSignUpTokens.showProfilePicture,
  profilePictureUrl:
    (rawProps?.profilePictureUrl as string) ?? defaultSignUpTokens.profilePictureUrl,
  profilePictureSize: toNumber(
    rawProps?.profilePictureSize,
    defaultSignUpTokens.profilePictureSize
  ),
  profilePictureBgColor:
    (rawProps?.profilePictureBgColor as string) ??
    defaultSignUpTokens.profilePictureBgColor,
  profilePictureBorderColor:
    (rawProps?.profilePictureBorderColor as string) ??
    defaultSignUpTokens.profilePictureBorderColor,
  buttonRadius: toNumber(rawProps?.buttonRadius ?? rawProps?.buttonBorderRadius, defaultSignUpTokens.buttonRadius),
  inputBorderRadius: toNumber(rawProps?.borderRadius ?? rawProps?.inputRadius ?? rawProps?.inputBorderRadius, defaultSignUpTokens.inputBorderRadius),
  headlineSize: toNumber(rawProps?.headlineSize, defaultSignUpTokens.headlineSize),
  headlineWeight: toFontWeight(rawProps?.headlineWeight, defaultSignUpTokens.headlineWeight),
  headlineFontFamily: (rawProps?.headlineFontFamily as string) ?? defaultSignUpTokens.headlineFontFamily,
  subtextSize: toNumber(rawProps?.subtextSize, defaultSignUpTokens.subtextSize),
  subtextWeight: toFontWeight(rawProps?.subtextWeight, defaultSignUpTokens.subtextWeight),
  subtextFontFamily: (rawProps?.subtextFontFamily as string) ?? defaultSignUpTokens.subtextFontFamily,
});

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
  const [forgotPasswordTokens, setForgotPasswordTokens] = useState<ForgotPasswordTokens>(
    defaultForgotPasswordTokens
  );
  const [signInHeaderConfig, setSignInHeaderConfig] = useState<Record<string, unknown> | null>(null);
  const [signUpHeaderConfig, setSignUpHeaderConfig] = useState<Record<string, unknown> | null>(null);
  const [dslLoaded, setDslLoaded] = useState(false);
  const isMountedRef = useRef(true);
  const loginToastPendingRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadAuthLayout = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    }

    try {
      // Fetch live DSL using the actual page names from the builder
      const [signInDsl, signUpDsl] = await Promise.all([
        fetchDSL(undefined, 'signin'),
        fetchDSL(undefined, 'create-account'),
      ]);

      if (!isMountedRef.current) return;

      // For signin: live DSL may have empty sections (builder left it blank).
      // Fall back to authLayoutFallback which has the signin + forgot_password structure.
      const livSignInSections = Array.isArray(signInDsl?.dsl?.sections)
        ? signInDsl.dsl.sections
        : [];
      const signInSections =
        livSignInSections.length > 0
          ? livSignInSections
          : (authLayoutFallback.sections || []);

      // For create-account: use live DSL sections (builder has signup component with full props)
      const signUpSections = Array.isArray(signUpDsl?.dsl?.sections)
        ? signUpDsl.dsl.sections
        : [];

      const signInSection = signInSections.find((section) => {
        const c = getSectionComponent(section);
        return c === 'signin' || c === 'sign_in';
      });
      const forgotSection = signInSections.find((section) => {
        const c = getSectionComponent(section);
        return c === 'forgot_password' || c === 'forgotpassword';
      });
      const signUpSection = signUpSections.find((section) => {
        const c = getSectionComponent(section);
        return c === 'signup' || c === 'sign_up';
      });

      if (signInSection) {
        setSignInTokens(buildSignInTokens(getSectionRawProps(signInSection)));
      }

      if (forgotSection) {
        setForgotPasswordTokens(buildForgotPasswordTokens(getSectionRawProps(forgotSection)));
      }

      if (signUpSection) {
        setSignUpTokens(buildSignUpTokens(getSectionRawProps(signUpSection)));
      }

      // Load headerdefault config from each page's DSL
      if (signInDsl?.dsl?.headerdefault) {
        setSignInHeaderConfig(signInDsl.dsl.headerdefault as Record<string, unknown>);
      }
      if (signUpDsl?.dsl?.headerdefault) {
        setSignUpHeaderConfig(signUpDsl.dsl.headerdefault as Record<string, unknown>);
      }
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
        setDslLoaded(true);
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
        ? {
            message: `Successfully logged in, ${displayName}`,
            key: `${Date.now()}-${displayName}`,
          }
        : undefined;
      loginToastPendingRef.current = false;

      const postLoginTarget = (route?.params as { postLoginTarget?: { name?: string; params?: Record<string, unknown> } } | undefined)?.postLoginTarget;
      const hasPostLoginTarget = Boolean(postLoginTarget?.name);
      const targetName = hasPostLoginTarget ? (postLoginTarget?.name as string) : "LayoutScreen";
      const targetParams =
        hasPostLoginTarget
          ? (postLoginTarget?.params as Record<string, unknown> | undefined)
          : undefined;
      const mergedParams =
        loginSuccessToast
          ? { ...(targetParams || {}), loginSuccessToast }
          : targetParams;

      navigation.reset({
        index: 0,
        routes: [
          {
            name: targetName as never,
            params: mergedParams as never,
          },
        ],
      });
    }
  }, [session, navigation, route?.params]);

  useEffect(() => {
    loadAuthLayout();
  }, [loadAuthLayout]);

  // Auto-refresh every 5 seconds so DSL changes in the builder appear without interaction
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadAuthLayout();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [loadAuthLayout]);

  useFocusEffect(
    useCallback(() => {
      loadAuthLayout();
    }, [loadAuthLayout])
  );

  const subtitle = useMemo(
    () => (mode === 'login' ? signInTokens.authTitle : signUpTokens.authTitle),
    [mode, signInTokens.authTitle, signUpTokens.authTitle]
  );
  const headline = useMemo(
    () => (mode === 'login' ? signInTokens.authTitle : signUpTokens.headerTitle),
    [mode, signInTokens.authTitle, signUpTokens.headerTitle]
  );
  const activeHeaderConfig = mode === 'login' ? signInHeaderConfig : signUpHeaderConfig;

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setError('');
  };

  useEffect(() => {
    const initialMode = (route?.params as { initialMode?: string } | undefined)?.initialMode;
    if (initialMode === 'signup' || initialMode === 'login') {
      setMode(initialMode);
    }
  }, [route?.params]);

  const validateForm = () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return 'Email and password are required.';
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      return 'Enter a valid email address.';
    }

    if (trimmedPassword.length < 6) {
      return 'Use a password with at least 6 characters.';
    }

    if (mode === 'signup') {
      if (signUpTokens.firstNameVisible && !trimmedFirstName) {
        return 'Please enter your first name.';
      }

      if (signUpTokens.lastNameVisible && !trimmedLastName) {
        return 'Please enter your last name.';
      }

      if (trimmedPassword.length < 8) {
        return 'Use a password with at least 8 characters for new accounts.';
      }

      if (!/[A-Z]/.test(trimmedPassword) || !/[0-9]/.test(trimmedPassword)) {
        return 'Include a number and an uppercase letter in your password.';
      }
    }

    return '';
  };

  const buttonLabel = useMemo(() => {
    const activeTokens = mode === 'signup' ? signUpTokens : signInTokens;
    const label = activeTokens.buttonText;
    return activeTokens.buttonAutoUppercase ? label.toUpperCase() : label;
  }, [mode, signInTokens, signUpTokens]);

  const handleForgotPassword = () => {
    const rawDomain = session?.user?.shopifyDomain || getShopifyDomain();
    const normalizedDomain = rawDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const forgotPasswordUrl = `https://${normalizedDomain}/account/login#recover`;

    if (navigation?.navigate) {
      navigation.navigate(
        'CheckoutWebView' as never,
        { url: forgotPasswordUrl, title: 'Forgot Password' } as never
      );
    }
  };

  const styles = useMemo(() => {
    const activeTokens = mode === 'signup' ? signUpTokens : signInTokens;
    // pt/pb from DSL = outer screen spacing (breathing room around the card)
    // pl/pr from DSL = horizontal margin so card doesn't touch screen edges
    const outerPadH = activeTokens.cardPaddingLeft || 16;
    const outerPadTop = activeTokens.cardPaddingTop || 24;
    const outerPadBottom = activeTokens.cardPaddingBottom || 24;

    return StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: activeTokens.bgColor,
        },
        scrollContent: {
          flexGrow: 1,
          paddingTop: outerPadTop,
          paddingBottom: outerPadBottom,
        },
        header: {
          paddingHorizontal: outerPadH,
          paddingBottom: 20,
        },
        title: {
          color: activeTokens.titleColor,
          fontSize: activeTokens.headlineSize,
          fontWeight: activeTokens.headlineWeight as any,
          fontFamily: activeTokens.headlineFontFamily || undefined,
        },
        headline: {
          color: mode === 'signup' ? signUpTokens.headerTitleColor : signInTokens.titleColor,
          fontSize: mode === 'signup' ? signUpTokens.headerTitleFontSize : signInTokens.subtextSize,
          fontWeight: (mode === 'signup' ? signUpTokens.headerTitleFontWeight : signInTokens.subtextWeight) as any,
          fontFamily: mode === 'signup' ? signUpTokens.headerTitleFontFamily : signInTokens.subtextFontFamily || undefined,
          marginTop: 8,
        },
        card: {
          backgroundColor: activeTokens.cardBgColor,
          marginHorizontal: outerPadH,
          marginBottom: 16,
          paddingTop: 16,
          paddingBottom: 16,
          paddingHorizontal: 16,
          borderRadius: activeTokens.cardBorderRadius,
          borderWidth: 1,
          borderColor: activeTokens.cardBorderColor,
          shadowColor: '#0F172A',
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        },
        fieldGroup: {
          marginBottom: 16,
        },
        label: {
          color: activeTokens.titleColor,
          marginBottom: 8,
          fontSize: 14,
          fontWeight: '600',
        },
        input: {
          backgroundColor: activeTokens.cardBgColor || '#FFFFFF',
          borderRadius: activeTokens.inputBorderRadius,
          paddingHorizontal: 14,
          paddingVertical: 11,
          minHeight: 48,
          color: '#0a0a0a',
          borderWidth: 1,
          borderColor: activeTokens.inputBorderColor,
        },
        helperText: {
          marginTop: 8,
          color: '#64748B',
          fontSize: 12,
        },
        passwordRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        passwordInput: {
          flex: 1,
          marginRight: 10,
        },
        visibilityToggle: {
          paddingHorizontal: 12,
          paddingVertical: Platform.OS === 'ios' ? 10 : 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: activeTokens.inputBorderColor,
          backgroundColor: '#F8FAFC',
        },
        visibilityText: {
          color: activeTokens.titleColor,
          fontWeight: '700',
        },
        error: {
          color: '#F87171',
          marginBottom: 12,
        },
        submitButton: {
          backgroundColor: activeTokens.buttonFillColor,
          paddingTop: activeTokens.buttonPaddingTop,
          paddingBottom: activeTokens.buttonPaddingBottom,
          borderRadius: activeTokens.buttonRadius,
          alignItems: 'center',
          marginTop: 6,
          borderWidth: 1,
          borderColor: activeTokens.buttonBorderColor,
          height: mode === 'signup' ? signUpTokens.buttonHeight : signInTokens.buttonHeight,
          width:
            mode === 'signup'
              ? (signUpTokens.buttonWidth <= 100 ? `${signUpTokens.buttonWidth}%` : undefined)
              : (signInTokens.buttonWidth <= 100 ? `${signInTokens.buttonWidth}%` : undefined),
          alignSelf:
            mode === 'signup'
              ? (signUpTokens.buttonWidth <= 100 ? 'center' : undefined)
              : (signInTokens.buttonWidth <= 100 ? 'center' : undefined),
        },
        submitText: {
          color: activeTokens.buttonTextColor,
          fontWeight: mode === 'signup' ? signUpTokens.buttonFontWeight : signInTokens.buttonFontWeight,
          fontSize: mode === 'signup' ? signUpTokens.buttonFontSize : signInTokens.buttonFontSize,
          fontFamily: mode === 'signup' ? signUpTokens.buttonFontFamily : signInTokens.buttonFontFamily,
        },
        switcher: {
          marginTop: 16,
          alignItems: 'center',
        },
        switcherText: {
          color: activeTokens.footerTextColor,
          fontWeight: '600',
          fontSize: mode === 'signup' ? signUpTokens.footerTextFontSize : signInTokens.footerTextFontSize,
        },
        switcherLinkText: {
          color: activeTokens.footerLinkColor,
          fontWeight: mode === 'signup' ? signUpTokens.footerLinkFontWeight : signInTokens.footerLinkFontWeight,
          marginTop: 6,
          fontSize: mode === 'signup' ? signUpTokens.footerLinkFontSize : signInTokens.footerLinkFontSize,
          fontFamily: mode === 'signup' ? signUpTokens.footerLinkFontFamily : signInTokens.footerLinkFontFamily,
          textAlign:
            mode === 'signup'
              ? toTextAlign(signUpTokens.footerLinkAlignment, 'center')
              : 'center',
        },
        profilePicture: {
          width: signUpTokens.profilePictureSize,
          height: signUpTokens.profilePictureSize,
          borderRadius: signUpTokens.profilePictureSize / 2,
          backgroundColor: signUpTokens.profilePictureBgColor,
          borderWidth: 1,
          borderColor: signUpTokens.profilePictureBorderColor,
          alignSelf: 'center',
          marginBottom: 24,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        },
        profileImage: {
          width: signUpTokens.profilePictureSize,
          height: signUpTokens.profilePictureSize,
        },
        forgotCard: {
          backgroundColor: forgotPasswordTokens.cardBgColor,
          marginHorizontal: outerPadH,
          paddingTop: 16,
          paddingBottom: 16,
          paddingHorizontal: 16,
          borderRadius: forgotPasswordTokens.cardBorderRadius,
          borderWidth: 1,
          borderColor: forgotPasswordTokens.cardBorderColor,
        },
        forgotHeadline: {
          color: forgotPasswordTokens.titleColor,
          fontSize: forgotPasswordTokens.headlineFontSize,
          fontWeight: forgotPasswordTokens.headlineFontWeight,
          fontFamily: forgotPasswordTokens.headlineFontFamily,
          fontStyle: forgotPasswordTokens.headlineFontStyle,
          textDecorationLine: forgotPasswordTokens.headlineTextDecoration,
          textTransform: forgotPasswordTokens.headlineTextTransform,
        },
        forgotSubtitle: {
          color: forgotPasswordTokens.titleColor,
          marginTop: 6,
          fontSize: 14,
          fontWeight: '600',
        },
        forgotButton: {
          marginTop: 16,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: forgotPasswordTokens.buttonFillColor,
          borderWidth: 1,
          borderColor: forgotPasswordTokens.buttonBorderColor,
        },
        forgotButtonText: {
          color: forgotPasswordTokens.buttonTextColor,
          fontWeight: '700',
        },
      });
  }, [forgotPasswordTokens, mode, signInTokens, signUpTokens]);

  const handleSubmit = async () => {
    setError('');
    if (loading) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

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
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!dslLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0C9297" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {activeHeaderConfig ? (
        <HeaderDefaultComponent config={activeHeaderConfig} />
      ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadAuthLayout(true)} />
          }
        >
          {(mode !== 'login' || signInTokens.authVisible) && (
            <View style={styles.header}>
              <Text style={styles.title}>{subtitle}</Text>
              {<Text style={styles.headline}>{headline}</Text>}
            </View>
          )}

          <View style={styles.card}>
            {mode === 'signup' && signUpTokens.showProfilePicture && signUpTokens.profilePictureUrl ? (
              <View style={styles.profilePicture}>
                <Image
                  source={{ uri: signUpTokens.profilePictureUrl }}
                  style={{ width: signUpTokens.profilePictureSize, height: signUpTokens.profilePictureSize }}
                />
              </View>
            ) : null}

            {mode === 'signup' && signUpTokens.firstNameVisible ? (
              <View style={styles.fieldGroup}>
                {signUpTokens.firstNameLabelVisible ? (
                  <Text
                    style={[
                      styles.label,
                      {
                        color: signUpTokens.firstNameLabelColor,
                        fontSize: signUpTokens.firstNameLabelFontSize,
                        fontFamily: signUpTokens.firstNameLabelFontFamily,
                        fontWeight: signUpTokens.firstNameLabelFontWeight,
                        textAlign: toTextAlign(signUpTokens.firstNameAlignment),
                      },
                    ]}
                  >
                    {signUpTokens.firstNameLabelText}
                  </Text>
                ) : null}
                <TextInput
                  placeholder={signUpTokens.firstNamePlaceholder}
                  placeholderTextColor={signUpTokens.firstNamePlaceholderColor}
                  value={firstName}
                  onChangeText={setFirstName}
                  style={[
                    styles.input,
                    {
                      color: signUpTokens.firstNameInputTextColor,
                      fontSize: signUpTokens.firstNameInputTextFontSize,
                      fontFamily: signUpTokens.firstNameInputTextFontFamily,
                      fontWeight: signUpTokens.firstNameInputTextFontWeight,
                      textAlign: toTextAlign(signUpTokens.firstNameInputTextAlignment),
                    },
                  ]}
                  autoCapitalize="words"
                />
              </View>
            ) : null}

            {mode === 'signup' && signUpTokens.lastNameVisible ? (
              <View style={styles.fieldGroup}>
                {signUpTokens.lastNameLabelVisible ? (
                  <Text
                    style={[
                      styles.label,
                      {
                        color: signUpTokens.lastNameLabelColor,
                        fontSize: signUpTokens.lastNameLabelFontSize,
                        fontFamily: signUpTokens.lastNameLabelFontFamily,
                        fontWeight: signUpTokens.lastNameLabelFontWeight,
                        textAlign: toTextAlign(signUpTokens.lastNameAlignment),
                      },
                    ]}
                  >
                    {signUpTokens.lastNameLabelText}
                  </Text>
                ) : null}
                <TextInput
                  placeholder={signUpTokens.lastNamePlaceholder}
                  placeholderTextColor={signUpTokens.lastNamePlaceholderColor}
                  value={lastName}
                  onChangeText={setLastName}
                  style={[
                    styles.input,
                    {
                      color: signUpTokens.lastNameInputTextColor,
                      fontSize: signUpTokens.lastNameInputTextFontSize,
                      fontFamily: signUpTokens.lastNameInputTextFontFamily,
                      fontWeight: signUpTokens.lastNameInputTextFontWeight,
                      textAlign: toTextAlign(signUpTokens.lastNameInputTextAlignment),
                    },
                  ]}
                  autoCapitalize="words"
                />
              </View>
            ) : null}

            {mode === 'login' || signUpTokens.emailInputVisible ? (
              <View style={styles.fieldGroup}>
                {mode === 'login' ? (
                  signInTokens.emailLabelVisible ? (
                    <Text
                      style={[
                        styles.label,
                        {
                          color: signInTokens.emailLabelColor,
                          fontSize: signInTokens.emailLabelFontSize,
                          fontFamily: signInTokens.emailLabelFontFamily,
                          fontWeight: signInTokens.emailLabelFontWeight,
                        },
                      ]}
                    >
                      {signInTokens.emailLabelText}
                    </Text>
                  ) : null
                ) : signUpTokens.emailLabelVisible ? (
                  <Text
                    style={[
                      styles.label,
                      {
                        color: signUpTokens.emailLabelColor,
                        fontSize: signUpTokens.emailLabelFontSize,
                        fontFamily: signUpTokens.emailLabelFontFamily,
                        fontWeight: signUpTokens.emailLabelFontWeight,
                        textAlign: toTextAlign(signUpTokens.emailAlignment),
                      },
                    ]}
                  >
                    {signUpTokens.emailLabelText}
                  </Text>
                ) : null}
                <TextInput
                  placeholder={
                    mode === 'login' ? signInTokens.emailPlaceholder : signUpTokens.emailPlaceholder
                  }
                  placeholderTextColor={
                    mode === 'login' ? signInTokens.emailPlaceholderColor : signUpTokens.emailPlaceholderColor
                  }
                  value={email}
                  onChangeText={setEmail}
                  style={[
                    styles.input,
                    mode === 'signup'
                      ? {
                          color: signUpTokens.emailInputTextColor,
                          fontSize: signUpTokens.emailInputTextFontSize,
                          fontFamily: signUpTokens.emailInputTextFontFamily,
                          fontWeight: signUpTokens.emailInputTextFontWeight,
                          textAlign: toTextAlign(signUpTokens.emailInputTextAlignment),
                        }
                      : {
                          color: signInTokens.emailInputTextColor,
                          fontSize: signInTokens.emailInputTextFontSize,
                          fontFamily: signInTokens.emailInputTextFontFamily,
                          fontWeight: signInTokens.emailInputTextFontWeight,
                        },
                  ]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ) : null}

            {mode === 'login' || signUpTokens.passwordInputVisible ? (
              <View style={styles.fieldGroup}>
                {mode === 'login' ? (
                  signInTokens.passwordLabelVisible ? (
                    <Text
                      style={[
                        styles.label,
                        {
                          color: signInTokens.passwordLabelColor,
                          fontSize: signInTokens.passwordLabelFontSize,
                          fontFamily: signInTokens.passwordLabelFontFamily,
                          fontWeight: signInTokens.passwordLabelFontWeight,
                        },
                      ]}
                    >
                      {signInTokens.passwordLabelText}
                    </Text>
                  ) : null
                ) : signUpTokens.passwordLabelVisible ? (
                  <Text
                    style={[
                      styles.label,
                      {
                        color: signUpTokens.passwordLabelColor,
                        fontSize: signUpTokens.passwordLabelFontSize,
                        fontFamily: signUpTokens.passwordLabelFontFamily,
                        fontWeight: signUpTokens.passwordLabelFontWeight,
                        textAlign: toTextAlign(signUpTokens.passwordAlignment),
                      },
                    ]}
                  >
                    {signUpTokens.passwordLabelText}
                  </Text>
                ) : null}
                <View style={styles.passwordRow}>
                  <TextInput
                    placeholder={
                      mode === 'login'
                        ? signInTokens.passwordPlaceholder
                        : signUpTokens.passwordPlaceholder
                    }
                    placeholderTextColor={
                      mode === 'login' ? signInTokens.passwordPlaceholderColor : signUpTokens.passwordPlaceholderColor
                    }
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!passwordVisible}
                    style={[
                      styles.input,
                      styles.passwordInput,
                      mode === 'signup'
                        ? {
                            color: signUpTokens.passwordInputTextColor,
                            fontSize: signUpTokens.passwordInputTextFontSize,
                            fontFamily: signUpTokens.passwordInputTextFontFamily,
                            fontWeight: signUpTokens.passwordInputTextFontWeight,
                            textAlign: toTextAlign(signUpTokens.passwordInputTextAlignment),
                          }
                        : {
                            color: signInTokens.passwordInputTextColor,
                            fontSize: signInTokens.passwordInputTextFontSize,
                            fontFamily: signInTokens.passwordInputTextFontFamily,
                            fontWeight: signInTokens.passwordInputTextFontWeight,
                          },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={() => setPasswordVisible((prev) => !prev)}
                    style={styles.visibilityToggle}
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  >
                  <Text style={styles.visibilityText}>{passwordVisible ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
                {mode === 'signup' ? (
                  <Text style={styles.helperText}>
                    Use at least 8 characters with a number and uppercase letter.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {mode === 'login' || signUpTokens.buttonVisible ? (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  mode === 'login'
                    ? {
                        height: signInTokens.buttonHeight,
                        width: signInTokens.buttonWidth <= 100 ? `${signInTokens.buttonWidth}%` : undefined,
                        alignSelf: signInTokens.buttonWidth <= 100 ? 'center' : undefined,
                      }
                    : null,
                ]}
                onPress={handleSubmit}
                disabled={loading || initializing}
              >
                {loading ? (
                  <ActivityIndicator
                    color={
                      mode === 'login' ? signInTokens.buttonTextColor : signUpTokens.buttonTextColor
                    }
                  />
                ) : (
                  <Text
                    style={[
                      styles.submitText,
                      mode === 'login'
                        ? {
                            fontSize: signInTokens.buttonFontSize,
                            fontFamily: signInTokens.buttonFontFamily,
                            fontWeight: signInTokens.buttonFontWeight,
                          }
                        : null,
                    ]}
                  >
                    {buttonLabel}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}

            {(mode === 'login' ? signInTokens.footerVisible : signUpTokens.footerVisible) ? (
              <View style={styles.switcher}>
                <Text style={styles.switcherText}>
                  {mode === 'login' ? signInTokens.footerText : signUpTokens.footerText}
                </Text>
                {(mode === 'login' || signUpTokens.signInLinkVisible) && (
                  <TouchableOpacity onPress={toggleMode} accessibilityRole="button">
                    <Text style={styles.switcherLinkText}>
                      {mode === 'login'
                        ? signInTokens.footerLinkText
                        : signUpTokens.footerLinkAutoUppercase
                          ? signUpTokens.footerLinkText.toUpperCase()
                          : signUpTokens.footerLinkText}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>

          {mode === 'login' && signInTokens.forgotPasswordVisible ? (
            <View style={styles.forgotCard}>
              <Text style={styles.forgotHeadline}>{forgotPasswordTokens.headlineText}</Text>
              <Text style={styles.forgotSubtitle}>{forgotPasswordTokens.resetPasswordTitle}</Text>
              <TouchableOpacity
                style={styles.forgotButton}
                accessibilityRole="button"
                onPress={handleForgotPassword}
              >
                <Text style={styles.forgotButtonText}>
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
