import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { fetchDSL } from '../engine/dslHandler';
import { getShopifyDomain } from '../services/shopify';
import Header from '../components/Topheader';

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

const getSectionComponent = (section: Record<string, unknown> | null | undefined): string =>
  unwrapValue((section?.component ?? section?.properties?.component) as string, '');

const getSectionRawProps = (section: Record<string, unknown> | null | undefined) => {
  const propsNode =
    (section?.properties as Record<string, unknown>)?.props?.properties ||
    (section?.properties as Record<string, unknown>)?.props ||
    section?.props ||
    {};
  return unwrapValue((propsNode as Record<string, unknown>)?.raw, {}) as Record<string, unknown>;
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
  bgColor: '#FFFFFF',
  titleColor: '#027579',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#0c9297',
  cardBorderRadius: 0,
  cardPaddingTop: 60,
  cardPaddingBottom: 60,
  cardPaddingLeft: 20,
  cardPaddingRight: 20,
  inputBorderColor: '#027579',
  authTitle: 'Create an Account',
  buttonText: 'Continue',
  footerText: 'Already have an account?',
  footerLinkText: 'Sign in',
  headerTitle: 'Create an Account',
  headerTitleColor: '#000000',
  headerTitleFontSize: 18,
  headerTitleFontFamily: 'Inter, sans-serif',
  headerTitleFontWeight: '700',
  emailAlignment: 'Center',
  firstNameAlignment: 'Center',
  lastNameAlignment: 'Center',
  passwordAlignment: 'Center',
  emailInputTextAlignment: 'Center',
  firstNameInputTextAlignment: 'Center',
  lastNameInputTextAlignment: 'Center',
  passwordInputTextAlignment: 'Center',
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
  emailLabelColor: '#000000',
  firstNameLabelColor: '#000000',
  lastNameLabelColor: '#000000',
  passwordLabelColor: '#000000',
  emailLabelFontSize: 24,
  firstNameLabelFontSize: 24,
  lastNameLabelFontSize: 24,
  passwordLabelFontSize: 24,
  emailLabelFontFamily: 'Inter, sans-serif',
  firstNameLabelFontFamily: 'Inter, sans-serif',
  lastNameLabelFontFamily: 'Inter, sans-serif',
  passwordLabelFontFamily: 'Inter, sans-serif',
  emailLabelFontWeight: '700',
  firstNameLabelFontWeight: '700',
  lastNameLabelFontWeight: '700',
  passwordLabelFontWeight: '700',
  emailInputTextColor: '#000000',
  firstNameInputTextColor: '#000000',
  lastNameInputTextColor: '#000000',
  passwordInputTextColor: '#000000',
  emailInputTextFontSize: 24,
  firstNameInputTextFontSize: 24,
  lastNameInputTextFontSize: 24,
  passwordInputTextFontSize: 24,
  emailInputTextFontFamily: 'Inter, sans-serif',
  firstNameInputTextFontFamily: 'Inter, sans-serif',
  lastNameInputTextFontFamily: 'Inter, sans-serif',
  passwordInputTextFontFamily: 'Inter, sans-serif',
  emailInputTextFontWeight: '700',
  firstNameInputTextFontWeight: '700',
  lastNameInputTextFontWeight: '700',
  passwordInputTextFontWeight: '700',
  emailPlaceholderColor: '#000000',
  firstNamePlaceholderColor: '#000000',
  lastNamePlaceholderColor: '#000000',
  passwordPlaceholderColor: '#000000',
  buttonHeight: 50,
  buttonWidth: 100,
  buttonFontSize: 24,
  buttonFontFamily: 'Inter, sans-serif',
  buttonFontWeight: '700',
  footerTextFontSize: 13,
  footerLinkFontSize: 24,
  footerLinkFontFamily: 'Inter, sans-serif',
  footerLinkFontWeight: '700',
  footerLinkAlignment: 'Center',
  footerLinkAutoUppercase: false,
  footerVisible: true,
  signInLinkVisible: true,
  buttonVisible: true,
  showProfilePicture: true,
  profilePictureUrl: '',
  profilePictureSize: 198,
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
  emailLabelFontSize: toNumber(
    rawProps?.emailLabelFontSize,
    defaultSignUpTokens.emailLabelFontSize
  ),
  firstNameLabelFontSize: toNumber(
    rawProps?.firstNameLabelFontSize,
    defaultSignUpTokens.firstNameLabelFontSize
  ),
  lastNameLabelFontSize: toNumber(
    rawProps?.lastNameLabelFontSize,
    defaultSignUpTokens.lastNameLabelFontSize
  ),
  passwordLabelFontSize: toNumber(
    rawProps?.passwordLabelFontSize,
    defaultSignUpTokens.passwordLabelFontSize
  ),
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
  emailInputTextFontSize: toNumber(
    rawProps?.emailInputTextFontSize,
    defaultSignUpTokens.emailInputTextFontSize
  ),
  firstNameInputTextFontSize: toNumber(
    rawProps?.firstNameInputTextFontSize,
    defaultSignUpTokens.firstNameInputTextFontSize
  ),
  lastNameInputTextFontSize: toNumber(
    rawProps?.lastNameInputTextFontSize,
    defaultSignUpTokens.lastNameInputTextFontSize
  ),
  passwordInputTextFontSize: toNumber(
    rawProps?.passwordInputTextFontSize,
    defaultSignUpTokens.passwordInputTextFontSize
  ),
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
  buttonFontSize: toNumber(rawProps?.buttonFontSize, defaultSignUpTokens.buttonFontSize),
  buttonFontFamily:
    (rawProps?.buttonFontFamily as string) ?? defaultSignUpTokens.buttonFontFamily,
  buttonFontWeight: toFontWeight(
    rawProps?.buttonFontWeight,
    defaultSignUpTokens.buttonFontWeight
  ),
  footerTextColor: (rawProps?.footerTextColor as string) ?? defaultSignUpTokens.footerTextColor,
  footerLinkColor: (rawProps?.footerLinkColor as string) ?? defaultSignUpTokens.footerLinkColor,
  footerTextFontSize: toNumber(
    rawProps?.footerTextFontSize,
    defaultSignUpTokens.footerTextFontSize
  ),
  footerLinkFontSize: toNumber(
    rawProps?.footerLinkFontSize,
    defaultSignUpTokens.footerLinkFontSize
  ),
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
});

const AuthScreen = () => {
  const navigation = useNavigation();
  const { login, signup, session, initializing } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [signInTokens, setSignInTokens] = useState<SignInTokens>(defaultSignInTokens);
  const [signUpTokens, setSignUpTokens] = useState<SignUpTokens>(defaultSignUpTokens);
  const [forgotPasswordTokens, setForgotPasswordTokens] = useState<ForgotPasswordTokens>(
    defaultForgotPasswordTokens
  );

  useEffect(() => {
    if (session) {
      navigation.reset({ index: 0, routes: [{ name: 'LayoutScreen' as never }] });
    }
  }, [session, navigation]);

  useEffect(() => {
    let isMounted = true;
    const loadAuthLayout = async () => {
      const [signInDsl, signUpDsl] = await Promise.all([
        fetchDSL(undefined, 'Signin/Create Account'),
        fetchDSL(undefined, 'Create User'),
      ]);
      if (!isMounted) return;
      const signInSections = Array.isArray(signInDsl?.dsl?.sections) ? signInDsl?.dsl?.sections : [];
      const signUpSections = Array.isArray(signUpDsl?.dsl?.sections) ? signUpDsl?.dsl?.sections : [];
      const signInSection = signInSections.find(
        (section) => getSectionComponent(section) === 'signin'
      );
      const forgotSection = signInSections.find(
        (section) => getSectionComponent(section) === 'forgot_password'
      );
      const signUpSection = signUpSections.find(
        (section) => getSectionComponent(section) === 'signup'
      );

      if (signInSection) {
        setSignInTokens(buildSignInTokens(getSectionRawProps(signInSection)));
      }

      if (forgotSection) {
        setForgotPasswordTokens(buildForgotPasswordTokens(getSectionRawProps(forgotSection)));
      }

      if (signUpSection) {
        setSignUpTokens(buildSignUpTokens(getSectionRawProps(signUpSection)));
      }
    };

    loadAuthLayout();

    return () => {
      isMounted = false;
    };
  }, []);

  const subtitle = useMemo(
    () => (mode === 'login' ? signInTokens.authTitle : signUpTokens.authTitle),
    [mode, signInTokens.authTitle, signUpTokens.authTitle]
  );
  const headline = useMemo(
    () => (mode === 'login' ? 'Welcome back' : signUpTokens.headerTitle),
    [mode, signUpTokens.headerTitle]
  );
  const description = useMemo(
    () =>
      mode === 'login'
        ? 'Sign in to continue shopping, track orders, and manage your saved items.'
        : 'Join Mobidrag to unlock faster checkout, order tracking, and personalized picks.',
    [mode]
  );

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setError('');
  };

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
    return StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: activeTokens.bgColor,
        },
        scrollContent: {
          flexGrow: 1,
          paddingBottom: 24,
        },
        header: {
          paddingHorizontal: 24,
          paddingTop: 34,
          paddingBottom: 20,
        },
        title: {
          color: activeTokens.titleColor,
          fontSize: 16,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
        },
        headline: {
          color: mode === 'signup' ? signUpTokens.headerTitleColor : '#0F172A',
          fontSize: mode === 'signup' ? signUpTokens.headerTitleFontSize : 26,
          fontWeight: mode === 'signup' ? signUpTokens.headerTitleFontWeight : '700',
          fontFamily: mode === 'signup' ? signUpTokens.headerTitleFontFamily : undefined,
          marginTop: 8,
        },
        description: {
          color: '#475569',
          fontSize: 14,
          lineHeight: 20,
          marginTop: 8,
        },
        card: {
          backgroundColor: activeTokens.cardBgColor,
          marginHorizontal: 20,
          marginBottom: 16,
          paddingTop: activeTokens.cardPaddingTop,
          paddingBottom: activeTokens.cardPaddingBottom,
          paddingLeft: activeTokens.cardPaddingLeft,
          paddingRight: activeTokens.cardPaddingRight,
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
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: Platform.OS === 'ios' ? 14 : 12,
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
          borderRadius: 14,
          alignItems: 'center',
          marginTop: 6,
          borderWidth: 1,
          borderColor: activeTokens.buttonBorderColor,
          height: mode === 'signup' ? signUpTokens.buttonHeight : undefined,
          width:
            mode === 'signup' && signUpTokens.buttonWidth <= 100
              ? `${signUpTokens.buttonWidth}%`
              : undefined,
          alignSelf: mode === 'signup' && signUpTokens.buttonWidth <= 100 ? 'center' : undefined,
        },
        submitText: {
          color: activeTokens.buttonTextColor,
          fontWeight: mode === 'signup' ? signUpTokens.buttonFontWeight : '700',
          fontSize: mode === 'signup' ? signUpTokens.buttonFontSize : 16,
          fontFamily: mode === 'signup' ? signUpTokens.buttonFontFamily : undefined,
        },
        switcher: {
          marginTop: 16,
          alignItems: 'center',
        },
        switcherText: {
          color: activeTokens.footerTextColor,
          fontWeight: '600',
          fontSize: mode === 'signup' ? signUpTokens.footerTextFontSize : 14,
        },
        switcherLinkText: {
          color: activeTokens.footerLinkColor,
          fontWeight: mode === 'signup' ? signUpTokens.footerLinkFontWeight : '700',
          marginTop: 6,
          fontSize: mode === 'signup' ? signUpTokens.footerLinkFontSize : 14,
          fontFamily: mode === 'signup' ? signUpTokens.footerLinkFontFamily : undefined,
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
          marginHorizontal: 20,
          paddingTop: forgotPasswordTokens.cardPaddingTop,
          paddingBottom: forgotPasswordTokens.cardPaddingBottom,
          paddingLeft: forgotPasswordTokens.cardPaddingLeft,
          paddingRight: forgotPasswordTokens.cardPaddingRight,
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
        await login(email.trim(), password.trim());
      } else {
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

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{subtitle}</Text>
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>

          <View style={styles.card}>
            {mode === 'signup' && signUpTokens.showProfilePicture ? (
              <View style={styles.profilePicture}>
                {signUpTokens.profilePictureUrl ? (
                  <Image
                    source={{ uri: signUpTokens.profilePictureUrl }}
                    style={styles.profileImage}
                  />
                ) : null}
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
                  <Text style={styles.label}>Email</Text>
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
                    mode === 'login' ? '#A0AEC0' : signUpTokens.emailPlaceholderColor
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
                      : null,
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
                  <Text style={styles.label}>Password</Text>
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
                      mode === 'login' ? '#A0AEC0' : signUpTokens.passwordPlaceholderColor
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
                        : null,
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
                style={styles.submitButton}
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
                  <Text style={styles.submitText}>{buttonLabel}</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {mode === 'login' || signUpTokens.footerVisible ? (
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

          {mode === 'login' ? (
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
