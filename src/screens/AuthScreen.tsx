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

const signInTokens = {
  bgColor: '#FFFFFF',
  titleColor: '#027579',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#0c9297',
  inputBorderColor: '#027579',
  footerTextColor: '#0a0a0a',
  footerLinkColor: '#027579',
  buttonTextColor: 'rgba(5, 106, 109, 1)',
  buttonBorderColor: '#0c9297',
  buttonFillColor: 'rgba(9, 170, 185, 0.36)',
  authTitle: 'Authentication',
  buttonText: 'Continue',
  footerText: "Don't have an account?",
  footerLinkText: 'Create an Account',
  emailPlaceholder: 'Enter email',
  passwordPlaceholder: 'Enter password',
};

const forgotPasswordTokens = {
  titleColor: '#027579',
  cardBgColor: '#FFFFFF',
  cardBorderColor: '#0c9297',
  buttonTextColor: 'rgba(5, 106, 109, 1)',
  buttonBorderColor: '#0c9297',
  buttonFillColor: 'rgba(9, 170, 185, 0.36)',
  headlineText: 'Forgot Password?',
  resetPasswordTitle: 'Reset Password Link',
  resetPasswordButtonText: 'Forgot Password?',
};

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

  useEffect(() => {
    if (session) {
      navigation.reset({ index: 0, routes: [{ name: 'LayoutScreen' as never }] });
    }
  }, [session, navigation]);

  const subtitle = useMemo(
    () => (mode === 'login' ? signInTokens.authTitle : 'Create Account'),
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
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading || initializing}>
            {loading ? (
              <ActivityIndicator color={signInTokens.buttonTextColor} />
            ) : (
              <Text style={styles.submitText}>{mode === 'login' ? signInTokens.buttonText : 'Create account'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.switcher} onPress={toggleMode}>
            <Text style={styles.switcherText}>
              {mode === 'login' ? signInTokens.footerText : 'Already have an account?'}
            </Text>
            <Text style={styles.switcherLinkText}>
              {mode === 'login' ? signInTokens.footerLinkText : 'Login'}
            </Text>
          </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: signInTokens.bgColor,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 12,
  },
  title: {
    color: signInTokens.titleColor,
    fontSize: 24,
    fontWeight: '700',
  },
  card: {
    backgroundColor: signInTokens.cardBgColor,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: signInTokens.cardBorderColor,
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
    backgroundColor: '#FFFFFF',
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
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: signInTokens.buttonBorderColor,
  },
  submitText: {
    color: signInTokens.buttonTextColor,
    fontWeight: '700',
    fontSize: 16,
  },
  switcher: {
    marginTop: 14,
    alignItems: 'center',
  },
  switcherText: {
    color: signInTokens.footerTextColor,
    fontWeight: '600',
  },
  switcherLinkText: {
    color: signInTokens.footerLinkColor,
    fontWeight: '700',
    marginTop: 4,
  },
  forgotCard: {
    backgroundColor: forgotPasswordTokens.cardBgColor,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: forgotPasswordTokens.cardBorderColor,
  },
  forgotHeadline: {
    color: forgotPasswordTokens.titleColor,
    fontSize: 20,
    fontWeight: '700',
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

export default AuthScreen;
