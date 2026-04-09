import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../theme';

const CrimeListScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crime Feed</Text>
      <Text style={styles.subtitle}>
        This screen will show a list of nearby incidents and trending safety alerts.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});

export default CrimeListScreen;
