/**
 * Контекст аутентифікації для управління станом користувача
 * Забезпечує функції входу, реєстрації, виходу та оновлення даних користувача
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@/entities/user/model/types';
import * as authApi from '../api/authApi';

// Інтерфейс для контексту аутентифікації
interface AuthContextType {
  user: User | null; // Поточний користувач або null
  isLoading: boolean; // Стан завантаження
  isAuthenticated: boolean; // Чи аутентифікований користувач
  login: (email: string, password: string) => Promise<void>; // Функція входу
  register: (name: string, email: string, password: string) => Promise<{ needsVerification: boolean; message?: string }>; // Функція реєстрації
  logout: () => void; // Функція виходу
  completeOnboarding: (genres: string[], goal: number) => Promise<void>; // Завершення онбордингу
  refreshUser: () => Promise<User | null>; // Оновлення даних користувача з сервера
  updateUser: (updates: Partial<User>) => void; // Оновлення даних користувача локально
}

// Створюємо контекст з початковим значенням null
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Провайдер контексту аутентифікації
 * Забезпечує стан та функції аутентифікації для дочірніх компонентів
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Стан користувача
  const [user, setUser] = useState<User | null>(null);
  // Стан завантаження при ініціалізації
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Оновлює дані користувача з сервера
   * Перевіряє токен у localStorage та отримує актуальні дані користувача
   */
  const refreshUser = useCallback(async (): Promise<User | null> => {
    // Отримуємо токен з localStorage
    const token = localStorage.getItem('shelfecho_token');
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      // Отримуємо дані користувача з API
      const { user } = await authApi.getMe();
      setUser(user);
      return user;
    } catch {
      // Якщо токен недійсний, видаляємо його
      localStorage.removeItem('shelfecho_token');
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Ініціалізуємо дані користувача при завантаженні компонента
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  /**
   * Функція входу користувача
   * @param email - Email користувача
   * @param password - Пароль користувача
   */
  const login = async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password);
    // Зберігаємо токен у localStorage
    localStorage.setItem('shelfecho_token', token);
    // Оновлюємо стан користувача
    setUser(user);
  };

  /**
   * Функція реєстрації нового користувача
   * @param name - Ім'я користувача
   * @param email - Email користувача
   * @param password - Пароль користувача
   */
  const register = async (name: string, email: string, password: string) => {
    const result = await authApi.register(name, email, password);
    if (result.needsVerification) {
      // Якщо потрібна верифікація email
      return { needsVerification: true as const, message: result.message };
    }
    // Зберігаємо токен та оновлюємо стан
    localStorage.setItem('shelfecho_token', result.token);
    setUser(result.user);
    return { needsVerification: false as const };
  };

  /**
   * Функція виходу користувача
   * Видаляє токен та очищує стан користувача
   */
  const logout = () => {
    localStorage.removeItem('shelfecho_token');
    setUser(null);
  };

  /**
   * Завершує процес онбордингу користувача
   * @param genres - Улюблені жанри користувача
   * @param goal - Річна мета читання
   */
  const completeOnboarding = async (genres: string[], goal: number) => {
    await authApi.completeOnboarding(genres, goal);
    // Оновлюємо локальний стан користувача
    setUser((prev) => prev ? { ...prev, onboarded: true, favoriteGenres: genres, readingGoal: goal } : null);
  };

  /**
   * Оновлює дані користувача локально (без запиту до сервера)
   * @param updates - Об'єкт з оновленнями
   */
  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : null);
  };

  // Повертаємо провайдер з усіма функціями та станом
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

/**
 * Хук для використання контексту аутентифікації
 * @returns Об'єкт з функціями та станом аутентифікації
 * @throws Помилка, якщо використовується поза AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
