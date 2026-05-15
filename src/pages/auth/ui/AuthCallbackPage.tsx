import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/authContext';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const mode = searchParams.get('mode');
    if (!token) {
      setError('Missing sign-in token. Please try again.');
      return;
    }

    let cancelled = false;
    (async () => {
      localStorage.setItem('shelfecho_token', token);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      const user = await refreshUser();
      if (cancelled) return;
      if (!user) {
        localStorage.removeItem('shelfecho_token');
        setError('Could not complete sign-in. Please try again.');
        return;
      }
      if (mode === 'set-password') {
        navigate('/auth/set-password', { replace: true });
        return;
      }
      navigate(user.onboarded ? '/' : '/onboarding', { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, refreshUser]);

  if (error) {
    return (
      <div className="min-h-screen bg-linen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-700 mb-4">{error}</p>
        <button type="button" className="text-amber-800 underline" onClick={() => navigate('/auth', { replace: true })}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
    </div>
  );
}
