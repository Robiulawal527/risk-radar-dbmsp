// Login Screen
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

const LoginScreen = ({ navigation }: any) => {
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);

  const handleLogin = async () => {
    // Validation
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }

    setLoading(true);

    try {
      await login(email.toLowerCase().trim(), password);
      // Navigation handled automatically by AuthContext
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (type: 'admin' | 'user') => {
    if (type === 'admin') {
      setEmail('admin@riskradar.bd');
      setPassword('admin123');
    } else {
      setEmail('user@riskradar.bd');
      setPassword('user123');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Icon name="shield-alert" size={80} color={colors.primary} />
          <Text style={styles.title}>Risk Radar</Text>
          <Text style={styles.subtitle}>Crime Tracking & Safety</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            left={<TextInput.Icon icon="email" />}
            style={styles.input}
            disabled={loading}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={secureText}
            autoCapitalize="none"
            autoComplete="password"
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={secureText ? 'eye-off' : 'eye'}
                onPress={() => setSecureText(!secureText)}
              />
            }
            style={styles.input}
            disabled={loading}
          />

          {/* Login Button */}
          <Button
            mode="contained"
            onPress={handleLogin}
            style={styles.loginButton}
            contentStyle={styles.loginButtonContent}
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>

          {/* Forgot Password */}
          <Button
            mode="text"
            onPress={() => Alert.alert('Forgot Password', 'Feature coming soon')}
            style={styles.forgotButton}
            disabled={loading}
          >
            Forgot Password?
          </Button>

          <Divider style={styles.divider} />

          {/* Quick Login (Development) */}
          {__DEV__ && (
            <View style={styles.quickLoginContainer}>
              <Text style={styles.quickLoginTitle}>Quick Login (Dev)</Text>
              <View style={styles.quickLoginButtons}>
                <Button
                  mode="outlined"
                  onPress={() => handleQuickLogin('admin')}
                  style={styles.quickLoginButton}
                  compact
                >
                  Admin
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => handleQuickLogin('user')}
                  style={styles.quickLoginButton}
                  compact
                >
                  User
                </Button>
              </View>
            </View>
          )}

          {/* Sign Up */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Button
              mode="text"
              onPress={() => navigation.navigate('Register')}
              compact
              disabled={loading}
            >
              Sign Up
            </Button>
          </View>
        </View>

        {/* Version Info */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
  formContainer: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
  },
  loginButtonContent: {
    paddingVertical: 8,
  },
  forgotButton: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 24,
  },
  quickLoginContainer: {
    marginBottom: 16,
  },
  quickLoginTitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  quickLoginButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  quickLoginButton: {
    flex: 1,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signupText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default LoginScreen;