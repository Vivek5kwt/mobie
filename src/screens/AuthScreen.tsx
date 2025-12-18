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

const AuthScreen = () => {
  const navigation = useNavigation();
  const { login, signup, session, initializing } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      navigation.reset({ index: 0, routes: [{ name: 'LayoutScreen' as never }] });
    }
  }, [session, navigation]);

  const subtitle = useMemo(
    () =>
      mode === 'login'
        ? 'Access your projects by signing in'
        : 'Create an account to start building',
    [mode]
  );

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    if (loading) return;

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('Choose a password with at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password, fullName.trim());
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
          <Text style={styles.title}>{mode === 'login' ? 'Welcome back' : 'Get started'}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
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
              placeholder="you@example.com"
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
            <TextInput
              placeholder="••••••••"
              placeholderTextColor="#A0AEC0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading || initializing}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{mode === 'login' ? 'Login' : 'Create account'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.switcher} onPress={toggleMode}>
            <Text style={styles.switcherText}>
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1023',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#CBD5E1',
    marginTop: 6,
    fontSize: 15,
  },
  card: {
    backgroundColor: '#11152B',
    margin: 20,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 24,
    elevation: 6,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#E2E8F0',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0B0F24',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  error: {
    color: '#F87171',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  switcher: {
    marginTop: 14,
    alignItems: 'center',
  },
  switcherText: {
    color: '#A5B4FC',
    fontWeight: '600',
  },
});

export default AuthScreen;
