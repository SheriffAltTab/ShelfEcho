import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/authContext';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState('');
  const processedRef = useRef(false); // Prevent double-processing in StrictMode

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (processedRef.current) {
      return;
    }
    processedRef.current = true;

    // Get token from sessionStorage or localStorage
    const token = sessionStorage.getItem('google_oauth_token') || localStorage.getItem('shelfecho_token');
    const mode = sessionStorage.getItem('google_oauth_mode') || new URLSearchParams(window.location.search).get('mode');
    
    if (!token) {
      setError('Missing sign-in token. Please try again.');
      return;
    }
    
    // Clean up sessionStorage only
    sessionStorage.removeItem('google_oauth_token');
    sessionStorage.removeItem('google_oauth_mode');

    let cancelled = false;
    (async () => {
      localStorage.setItem('shelfecho_token', token);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      try {
        const user = await refreshUser();
        if (cancelled) return;
        if (!user) {
          localStorage.removeItem('shelfecho_token');
          setError('Could not complete sign-in. Please try again.');
          return;
        }
        const destination = mode === 'set-password' ? '/auth/set-password' : user.onboarded ? '/' : '/onboarding';
        window.location.href = destination;
      } catch (error) {
        console.error('[AuthCallback] refreshUser threw', error);
        setError('Could not complete sign-in. Please try again.');
      }
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
