import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../theme';

const ManageCrimesScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Crimes</Text>
      <Text style={styles.subtitle}>
        Crime management tools will be accessible here for authorized users.
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

export default ManageCrimesScreen;
