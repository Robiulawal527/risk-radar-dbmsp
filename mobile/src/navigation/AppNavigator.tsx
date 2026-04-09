// Main App Navigator
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuth } from '../context/AuthContext';

// Auth Screens
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import CrimeListScreen from '../screens/CrimeListScreen';
import CrimeDetailScreen from '../screens/CrimeDetailScreen';
import ReportCrimeScreen from '../screens/ReportCrimeScreen';
import SafeRouteScreen from '../screens/SafeRouteScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import ManageCrimesScreen from '../screens/ManageCrimesScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
const MainTabs = () => {
  const { isAdmin, isPolice } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'home';

          switch (route.name) {
            case 'Home':
              iconName = 'map-marker-radius';
              break;
            case 'Crimes':
              iconName = 'alert-circle';
              break;
            case 'Report':
              iconName = 'plus-circle';
              break;
            case 'SafeRoute':
              iconName = 'routes';
              break;
            case 'Profile':
              iconName = 'account';
              break;
            case 'Admin':
              iconName = 'shield-account';
              break;
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#dc2626',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Map' }}
      />
      <Tab.Screen 
        name="Crimes" 
        component={CrimeListScreen}
        options={{ title: 'Crimes' }}
      />
      <Tab.Screen 
        name="Report" 
        component={ReportCrimeScreen}
        options={{ title: 'Report' }}
      />
      <Tab.Screen 
        name="SafeRoute" 
        component={SafeRouteScreen}
        options={{ title: 'Safe Route' }}
      />
      
      {(isAdmin || isPolice) && (
        <Tab.Screen 
          name="Admin" 
          component={AdminDashboardScreen}
          options={{ title: 'Admin' }}
        />
      )}
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// Main App Navigator
const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#dc2626',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {!isAuthenticated ? (
        // Auth Flow
        <>
          <Stack.Screen 
            name="Onboarding" 
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen}
            options={{ title: 'Sign Up' }}
          />
        </>
      ) : (
        // Main App Flow
        <>
          <Stack.Screen 
            name="MainTabs" 
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="CrimeDetail" 
            component={CrimeDetailScreen}
            options={{ title: 'Crime Details' }}
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationsScreen}
            options={{ title: 'Notifications' }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen 
            name="ManageCrimes" 
            component={ManageCrimesScreen}
            options={{ title: 'Manage Crimes' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
