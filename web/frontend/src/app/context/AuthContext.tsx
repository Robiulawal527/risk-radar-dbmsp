// Context for managing authentication and user state
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, wsService } from '../services/api';

interface User {
  id?: string;
  fullName?: string;
  name?: string;
  role?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, fullName: string, phone?: string) => Promise<User>;
  logout: () => void;
  loading: boolean;
  isAdmin: boolean;
  isPolice: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user and token on mount
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Connect WebSocket with token
        wsService.connect();
        
        // Verify token is still valid
        authAPI.getMe().catch(() => {
          // Token invalid, logout
          logout();
        });
      } catch (error) {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const response: any = await authAPI.login(email, password);
      
      if (response.success && response.data.user) {
        setUser(response.data.user);
        
        // Connect WebSocket
        wsService.connect();
        
        return response.data.user;
      }
      throw new Error(response.message || 'Login failed');
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, fullName: string, phone = ''): Promise<User> => {
    try {
      const response: any = await authAPI.register({
        email,
        password,
        fullName,
        phone
      });
      
      if (response.success && response.data.user) {
        setUser(response.data.user);
        
        // Connect WebSocket
        wsService.connect();
        
        return response.data.user;
      }
      throw new Error(response.message || 'Signup failed');
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    
    // Disconnect WebSocket
    wsService.disconnect();
    
    // Clear localStorage
    authAPI.logout();
  };

  const value = {
    user,
    login,
    signup,
    logout,
    loading,
    isAdmin: user?.role === 'admin',
    isPolice: user?.role === 'police',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};