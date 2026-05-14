import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '@/shared/api/apiClient';
import { Button } from '@/shared/ui/Button';
import { useAuth } from '@/features/auth/model/authContext';
import type { User } from '@/entities/user/model/types';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'ok' | 'err'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('err');
      setMessage('Invalid verification link.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/auth/verify-email', { params: { token } });
        const data = res.data as { token?: string; user?: User };
        if (cancelled || !data.token) {
          if (!cancelled) {
            setStatus('err');
            setMessage('Unexpected response from server.');
          }
          return;
        }
        localStorage.setItem('shelfecho_token', data.token);
        await refreshUser();
        if (cancelled) return;
        setStatus('ok');
        setMessage('Your email is verified.');
        navigate(data.user && !data.user.onboarded ? '/onboarding' : '/', { replace: true });
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus('err');
        const ax = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { error?: string } } }).response : undefined;
        setMessage(ax?.data?.error && typeof ax.data.error === 'string' ? ax.data.error : 'Verification failed.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, refreshUser, searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-linen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
        <p className="text-brown/70 text-sm">Verifying your email…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
      <p className={status === 'ok' ? 'text-green-800 mb-6' : 'text-red-700 mb-6'}>{message}</p>
      <Button variant="wood" onClick={() => navigate('/auth', { replace: true })}>
        Sign in
      </Button>
    </div>
  );
}
