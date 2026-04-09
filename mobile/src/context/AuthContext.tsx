// Authentication Context for Mobile App
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, wsService } from '../services/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  profileImage?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPolice: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const [storedUser, token] = await Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('token'),
      ]);

      if (storedUser && token) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        // Connect WebSocket
        await wsService.connect();

        // Verify token is still valid
        try {
          const response = await authAPI.getMe();
          if (response.success && response.data) {
            setUser(response.data);
            await AsyncStorage.setItem('user', JSON.stringify(response.data));
          }
        } catch (error) {
          // Token invalid, logout
          await logout();
        }
      }
    } catch (error) {
      console.error('Check stored auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      
      if (response.success && response.data.user) {
        setUser(response.data.user);
        
        // Connect WebSocket
        await wsService.connect();
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ) => {
    try {
      const response = await authAPI.register({
        email,
        password,
        fullName,
        phone,
      });

      if (response.success && response.data.user) {
        setUser(response.data.user);
        
        // Connect WebSocket
        await wsService.connect();
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      // Disconnect WebSocket
      wsService.disconnect();

      // Clear storage
      await authAPI.logout();

      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateProfile = async (data: any) => {
    try {
      const response = await authAPI.updateProfile(data);
      
      if (response.success && response.data) {
        const updatedUser = { ...user, ...response.data };
        setUser(updatedUser as User);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error: any) {
      console.error('Update profile error:', error);
      throw new Error(error.message || 'Update failed');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isPolice: user?.role === 'police',
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
