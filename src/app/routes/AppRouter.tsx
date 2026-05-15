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

const AdminPage = lazy(() => import('@/pages/admin/ui/AdminPage').then((m) => ({ default: m.AdminPage })));
const DiscoverPage = lazy(() => import('@/pages/discover/ui/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));

function RouteSpinner() {
  return (
    <div className="min-h-screen bg-linen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (user && !user.onboarded) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user?.onboarded) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
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
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <OnboardingPage />
            </OnboardingRoute>
          }
        />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
