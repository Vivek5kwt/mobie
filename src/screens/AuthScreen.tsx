import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { fetchDSL } from '../engine/dslHandler';

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

const AuthScreen = () => {
  const navigation = useNavigation();
  const { login, signup, session, initializing } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [signInTokens, setSignInTokens] = useState<SignInTokens>(defaultSignInTokens);
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
      const liveDsl = await fetchDSL(undefined, 'Signin/Create Account');
      if (!isMounted) return;
      const sections = Array.isArray(liveDsl?.dsl?.sections) ? liveDsl?.dsl?.sections : [];
      const signInSection = sections.find((section) => getSectionComponent(section) === 'signin');
      const forgotSection = sections.find(
        (section) => getSectionComponent(section) === 'forgot_password'
      );

      if (signInSection) {
        setSignInTokens(buildSignInTokens(getSectionRawProps(signInSection)));
      }

      if (forgotSection) {
        setForgotPasswordTokens(buildForgotPasswordTokens(getSectionRawProps(forgotSection)));
      }
    };

    loadAuthLayout();

    return () => {
      isMounted = false;
    };
  }, []);

  const subtitle = useMemo(
    () => (mode === 'login' ? signInTokens.authTitle : 'Create Account'),
    [mode, signInTokens.authTitle]
  );
  const headline = useMemo(
    () => (mode === 'login' ? 'Welcome back' : 'Create your account'),
    [mode]
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
    const trimmedFullName = fullName.trim();

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
      if (!trimmedFullName) {
        return 'Please enter your full name.';
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
    const label = mode === 'login' ? signInTokens.buttonText : 'Create account';
    return signInTokens.buttonAutoUppercase ? label.toUpperCase() : label;
  }, [mode, signInTokens.buttonAutoUppercase, signInTokens.buttonText]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: signInTokens.bgColor,
        },
        header: {
          paddingHorizontal: 24,
          paddingTop: 34,
          paddingBottom: 20,
        },
        title: {
          color: signInTokens.titleColor,
          fontSize: 16,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
        },
        headline: {
          color: '#0F172A',
          fontSize: 26,
          fontWeight: '700',
          marginTop: 8,
        },
        description: {
          color: '#475569',
          fontSize: 14,
          lineHeight: 20,
          marginTop: 8,
        },
        card: {
          backgroundColor: signInTokens.cardBgColor,
          marginHorizontal: 20,
          marginBottom: 16,
          paddingTop: signInTokens.cardPaddingTop,
          paddingBottom: signInTokens.cardPaddingBottom,
          paddingLeft: signInTokens.cardPaddingLeft,
          paddingRight: signInTokens.cardPaddingRight,
          borderRadius: signInTokens.cardBorderRadius,
          borderWidth: 1,
          borderColor: signInTokens.cardBorderColor,
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
          color: signInTokens.titleColor,
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
          borderColor: signInTokens.inputBorderColor,
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
          borderColor: signInTokens.inputBorderColor,
          backgroundColor: '#F8FAFC',
        },
        visibilityText: {
          color: signInTokens.titleColor,
          fontWeight: '700',
        },
        error: {
          color: '#F87171',
          marginBottom: 12,
        },
        submitButton: {
          backgroundColor: signInTokens.buttonFillColor,
          paddingTop: signInTokens.buttonPaddingTop,
          paddingBottom: signInTokens.buttonPaddingBottom,
          borderRadius: 14,
          alignItems: 'center',
          marginTop: 6,
          borderWidth: 1,
          borderColor: signInTokens.buttonBorderColor,
        },
        submitText: {
          color: signInTokens.buttonTextColor,
          fontWeight: '700',
          fontSize: 16,
        },
        switcher: {
          marginTop: 16,
          alignItems: 'center',
        },
        switcherText: {
          color: signInTokens.footerTextColor,
          fontWeight: '600',
        },
        switcherLinkText: {
          color: signInTokens.footerLinkColor,
          fontWeight: '700',
          marginTop: 6,
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
      }),
    [forgotPasswordTokens, signInTokens]
  );

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
        await signup(email.trim(), password.trim(), fullName.trim());
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{subtitle}</Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        <View style={styles.card}>
          {mode === 'signup' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                placeholder="Jane Doe"
                placeholderTextColor="#A0AEC0"
                value={fullName}
                onChangeText={setFullName}
                style={styles.input}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder={signInTokens.emailPlaceholder}
              placeholderTextColor="#A0AEC0"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                placeholder={signInTokens.passwordPlaceholder}
                placeholderTextColor="#A0AEC0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                style={[styles.input, styles.passwordInput]}
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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading || initializing}
          >
            {loading ? (
              <ActivityIndicator color={signInTokens.buttonTextColor} />
            ) : (
              <Text style={styles.submitText}>{buttonLabel}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.switcher}>
            <Text style={styles.switcherText}>
              {mode === 'login' ? signInTokens.footerText : 'Already have an account?'}
            </Text>
            <TouchableOpacity onPress={toggleMode} accessibilityRole="button">
              <Text style={styles.switcherLinkText}>
                {mode === 'login' ? signInTokens.footerLinkText : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {mode === 'login' ? (
          <View style={styles.forgotCard}>
            <Text style={styles.forgotHeadline}>{forgotPasswordTokens.headlineText}</Text>
            <Text style={styles.forgotSubtitle}>{forgotPasswordTokens.resetPasswordTitle}</Text>
            <TouchableOpacity style={styles.forgotButton} accessibilityRole="button">
              <Text style={styles.forgotButtonText}>{forgotPasswordTokens.resetPasswordButtonText}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AuthScreen;
