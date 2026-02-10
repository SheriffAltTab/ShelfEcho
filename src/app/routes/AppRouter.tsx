import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/authContext';
import { Layout } from '@/widgets/layout/ui/Layout';
import { AuthPage } from '@/pages/auth/ui/AuthPage';
import { OnboardingPage } from '@/pages/onboarding/ui/OnboardingPage';
import { HomePage } from '@/pages/home/ui/HomePage';
import { BookDetailsPage } from '@/pages/book-details/ui/BookDetailsPage';
import { MyBooksPage } from '@/pages/my-books/ui/MyBooksPage';
import { ProfilePage } from '@/pages/profile/ui/ProfilePage';
import { SearchPage } from '@/pages/search/ui/SearchPage';
import { DiscoverPage } from '@/pages/discover/ui/DiscoverPage';

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
          path="/auth"
          element={
            <AuthRoute>
              <AuthPage />
            </AuthRoute>
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
                <DiscoverPage />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
