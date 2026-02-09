import { AuthProvider } from '@/features/auth/model/authContext';
import { AppRouter } from './routes/AppRouter';

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
