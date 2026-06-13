import { useState } from 'react';
import { Link, router } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@risk-radar/types';
import { MaterialIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      setError('');

      if (!env.supabaseUrl.trim() || !env.supabaseAnonKey.trim()) {
        setError(
          'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env, then restart Expo.'
        );
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError || !data.session || !data.user) {
        const msg = signInError?.message ?? 'Login failed';
        const lower = msg.toLowerCase();
        if (lower.includes('email not confirmed')) {
          setError(
            'Email not confirmed. Confirm in Supabase (Authentication → Users) or adjust email settings.'
          );
        } else if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
          setError('Wrong email or password. Sign up first or create the user in Supabase.');
        } else {
          setError(msg);
        }
        return;
      }

      await setAuth(
        {
          id: data.user.id,
          email: data.user.email || email,
          name: (data.user.user_metadata?.name as string) || data.user.email?.split('@')[0] || 'User',
          role: UserRole.USER,
          phone: data.user.user_metadata?.phone as string | undefined,
          avatar: data.user.user_metadata?.avatar as string | undefined,
          createdAt: new Date(data.user.created_at || Date.now()),
          updatedAt: new Date(),
        },
        data.session.access_token,
        data.session.refresh_token ?? ''
      );

      router.replace('/(tabs)/home' as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      if (message.toLowerCase().includes('network request failed')) {
        setError('Cannot reach auth server. Check your connection.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <MaterialIcons name="shield" size={48} color="#22d3ee" />
          </View>
          <Text style={styles.title}>Risk Radar</Text>
          <Text style={styles.subtitle}>See the risk. Avoid danger.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error" size={16} color="#ef4444" />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={onLogin} 
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In Securely'}</Text>
          </TouchableOpacity>

          <Link href={'/auth/signup' as never} style={styles.link}>
            Don't have an account? <Text style={styles.linkHighlight}>Create one</Text>
          </Link>
        </View>

      //<Text style={styles.demoNote}>Demo: demo@riskradar.local / demo123</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    color: '#64748b',
    marginTop: 4,
    fontSize: 14,
  },
  form: {
    gap: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#22d3ee',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    marginTop: 16,
  },
  linkHighlight: {
    color: '#22d3ee',
    fontWeight: '600',
  },
  demoNote: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 11,
    marginTop: 24,
  },
});
