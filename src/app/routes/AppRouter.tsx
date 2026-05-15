/**
 * Головний компонент маршрутизації додатку
 * Визначає всі маршрути та захищені області
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from '@/features/auth/model/authContext';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { Layout } from '@/widgets/layout/ui/Layout';
import { AuthPage } from '@/pages/auth/ui/AuthPage';
import { AuthCallbackPage } from '@/pages/auth/ui/AuthCallbackPage';
import { VerifyEmailPage } from '@/pages/auth/ui/VerifyEmailPage';
import { ForgotPasswordPage } from '@/pages/auth/ui/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ui/ResetPasswordPage';
import { SetGooglePasswordPage } from '@/pages/auth/ui/SetGooglePasswordPage';
import { OnboardingPage } from '@/pages/onboarding/ui/OnboardingPage';
import { HomePage } from '@/pages/home/ui/HomePage';
import { BookDetailsPage } from '@/pages/book-details/ui/BookDetailsPage';
import { MyBooksPage } from '@/pages/my-books/ui/MyBooksPage';
import { ProfilePage } from '@/pages/profile/ui/ProfilePage';
import { SearchPage } from '@/pages/search/ui/SearchPage';
import { AuthorPage } from '@/pages/author/ui/AuthorPage';
import { UserProfilePage } from '@/pages/user-profile/ui/UserProfilePage';

// Ледачі завантаження важких компонентів для оптимізації
const AdminPage = lazy(() => import('@/pages/admin/ui/AdminPage').then((m) => ({ default: m.AdminPage })));
const DiscoverPage = lazy(() => import('@/pages/discover/ui/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));

/**
 * Компонент спінера завантаження для маршрутів
 */
function RouteSpinner() {
  return (
    <div className="min-h-screen bg-linen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
    </div>
  );
}

/**
 * Захищений маршрут - вимагає аутентифікації
 * Перенаправляє неавторизованих користувачів на сторінку входу
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <RouteSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

/**
 * Маршрут аутентифікації - тільки для неавторизованих користувачів
 * Перенаправляє авторизованих користувачів на головну або онбординг
 */
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <RouteSpinner />;
  }

  if (isAuthenticated) {
    if (user && !user.onboarded) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * Маршрут онбордингу - тільки для авторизованих користувачів, які не пройшли онбординг
 */
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <RouteSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user?.onboarded) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * Головний компонент маршрутизації
 * Визначає всі маршрути додатку з відповідними захисними механізмами
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Маршрути аутентифікації - доступні без авторизації */}
        <Route
          path="/auth/callback"
          element={
            <ErrorBoundary>
              <AuthCallbackPage />
            </ErrorBoundary>
          }
        />
        <Route
          path="/verify-email"
          element={
            <ErrorBoundary>
              <VerifyEmailPage />
            </ErrorBoundary>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <ErrorBoundary>
              <ForgotPasswordPage />
            </ErrorBoundary>
          }
        />
        <Route
          path="/reset-password"
          element={
            <ErrorBoundary>
              <ResetPasswordPage />
            </ErrorBoundary>
          }
        />
        <Route
          path="/auth/set-password"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <SetGooglePasswordPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/auth"
          element={
            <ErrorBoundary>
              <AuthRoute>
                <AuthPage />
              </AuthRoute>
            </ErrorBoundary>
          }
        />

        {/* Онбординг - тільки для нових користувачів */}
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <OnboardingPage />
            </OnboardingRoute>
          }
        />

        {/* Захищені маршрути - вимагають авторизації */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <HomePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/book/*"
          element={
            <ProtectedRoute>
              <Layout>
                <BookDetailsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<RouteSpinner />}>
                  <DiscoverPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-books"
          element={
            <ProtectedRoute>
              <Layout>
                <MyBooksPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Layout>
                <SearchPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/author/*"
          element={
            <ProtectedRoute>
              <Layout>
                <AuthorPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <UserProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<RouteSpinner />}>
                  <AdminPage />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Редирект для неіснуючих маршрутів */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
