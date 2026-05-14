import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@/entities/user/model/types';
import * as authApi from '../api/authApi';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ needsVerification: boolean; message?: string }>;
  logout: () => void;
  completeOnboarding: (genres: string[], goal: number) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const token = localStorage.getItem('shelfecho_token');
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }
    try {
      const { user } = await authApi.getMe();
      setUser(user);
      return user;
    } catch {
      localStorage.removeItem('shelfecho_token');
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password);
    localStorage.setItem('shelfecho_token', token);
    setUser(user);
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await authApi.register(name, email, password);
    if (result.needsVerification) {
      return { needsVerification: true as const, message: result.message };
    }
    localStorage.setItem('shelfecho_token', result.token);
    setUser(result.user);
    return { needsVerification: false as const };
  };

  const logout = () => {
    localStorage.removeItem('shelfecho_token');
    setUser(null);
  };

  const completeOnboarding = async (genres: string[], goal: number) => {
    await authApi.completeOnboarding(genres, goal);
    setUser((prev) => prev ? { ...prev, onboarded: true, favoriteGenres: genres, readingGoal: goal } : null);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        completeOnboarding,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
