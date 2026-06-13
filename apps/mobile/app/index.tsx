import { Link, router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthReady } from '@/hooks/useAuthHydration';
import { useAuthStore } from '@/store/auth';
import { MaterialIcons } from '@expo/vector-icons';

export default function Index() {
  const ready = useAuthReady();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userName = useAuthStore((state) => state.user?.name);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>🛡️</Text>
        </View>
        <ActivityIndicator size="large" color="#22d3ee" style={{ marginTop: 24 }} />
        <Text style={styles.bootText}>Preparing Risk Radar…</Text>
      </View>
    );
  }

  // After the live Supabase check (via useAuthReady + sessionChecked not being persisted),
  // we ALWAYS land on this explicit "Log in or Sign up" page first.
  // This is the required "previous step" gate.
  // The user must actively choose to log in (or continue with a valid saved session)
  // or sign up before they can enter the main app.
  // There is no direct jump to the home/tabs on launch.
  // This enforces "every [user/time] to enter the app must log in".

  return (
    <View style={styles.authEntry}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>🛡️</Text>
      </View>
      <Text style={styles.title}>Risk Radar</Text>
      <Text style={styles.subtitle}>See the risk. Avoid danger.</Text>

      <View style={styles.actions}>
        {/* If we have a valid live session (persisted login that passed fresh getSession check),
            offer a quick "Continue" so returning users don't have to re-type credentials,
            but they still must tap on this page to "log in" and proceed. */}
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => {
              // User explicitly chooses to "log in" / continue with their valid saved session.
              // This is the action on the "log in or sign up page" that lets them enter the home.
              router.replace('/(tabs)/map' as never);
            }}
          >
            <MaterialIcons name="check-circle" size={20} color="#020617" />
            <Text style={styles.continueBtnText}>
              Continue as {userName || 'User'}
            </Text>
          </TouchableOpacity>
        )}

        <Link href="/auth/login" asChild>
          <TouchableOpacity style={isAuthenticated ? styles.secondaryBtn : styles.primaryBtn}>
            <MaterialIcons name="login" size={20} color={isAuthenticated ? '#22d3ee' : '#020617'} />
            <Text style={isAuthenticated ? styles.secondaryBtnText : styles.primaryBtnText}>
              {isAuthenticated ? 'Log in with a different account' : 'Log in'}
            </Text>
          </TouchableOpacity>
        </Link>

        <Link href="/auth/signup" asChild>
          <TouchableOpacity style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Create account (Sign up)</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <Text style={styles.footerNote}>
        {isAuthenticated
          ? 'You are logged in. Tap Continue or choose another option.'
          : 'You must log in or sign up to enter the app.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 42,
  },
  bootText: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },

  // Explicit login-or-signup choice page shown to everyone who is not authenticated.
  // This is the required previous step before any access to the main app.
  authEntry: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
  actions: {
    width: '100%',
    maxWidth: 320,
    marginTop: 48,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22d3ee',
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '700',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22d3ee',
    paddingVertical: 16,
    borderRadius: 14,
  },
  continueBtnText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryBtnText: {
    color: '#22d3ee',
    fontSize: 15,
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 32,
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
});
