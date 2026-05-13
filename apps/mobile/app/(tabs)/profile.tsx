import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();

  const onLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            await clearAuth();
            router.replace('/auth/login' as never);
          },
        },
      ]
    );
  };

  const menuItems = [
    { icon: 'person', label: 'Edit Profile', onPress: () => Alert.alert('Coming Soon', 'Profile editing will be available in next update.') },
    { icon: 'notifications', label: 'Notifications', onPress: () => {} },
    { icon: 'security', label: 'Privacy & Safety', onPress: () => {} },
    { icon: 'help', label: 'Help & Support', onPress: () => {} },
    { icon: 'info', label: 'About Risk Radar', onPress: () => Alert.alert('Risk Radar v2.0', 'See the risk. Avoid danger. Make meaningful connections.') },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0] || 'U'}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Safety Champion'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>47</Text>
            <Text style={styles.statLabel}>Reports</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>92</Text>
            <Text style={styles.statLabel}>Trust Score</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>Level 8</Text>
            <Text style={styles.statLabel}>Safety Hero</Text>
          </View>
        </View>
      </View>

      <View style={styles.menu}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
            <MaterialIcons name={item.icon as any} size={22} color="#64748b" />
            <Text style={styles.menuText}>{item.label}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#475569" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <MaterialIcons name="logout" size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Risk Radar v2.0 • Made with ❤️ for safer Bangladesh</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2937',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22d3ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#020617',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  email: {
    color: '#64748b',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 32,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#22d3ee',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  menu: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2937',
    gap: 14,
  },
  menuText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 14,
    marginHorizontal: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 11,
    marginTop: 24,
  },
});
