import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/authContext';
import { Button } from '@/shared/ui/Button';
import { ShelfEchoLogo } from '@/shared/ui/ShelfEchoLogo';
import { updateProfile } from '@/features/auth/api/authApi';

export function SetGooglePasswordPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await updateProfile({ newPassword: password });
      await refreshUser();
      setSuccess('Password saved successfully.');
      const nextPath = user?.onboarded ? '/' : '/onboarding';
      navigate(nextPath, { replace: true });
    } catch (err: unknown) {
      const ax = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { error?: string } } }).response : undefined;
      setError(ax?.data?.error && typeof ax.data.error === 'string' ? ax.data.error : 'Failed to save password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <ShelfEchoLogo className="h-20 w-auto" />
        </div>
        <div className="bg-cream rounded-3xl shadow-warm border border-white/50 p-8">
          <h1 className="text-2xl font-serif font-bold text-brown mb-2 text-center">Set a password</h1>
          <p className="text-sm text-brown/60 mb-6 text-center">
            You signed up with Google. Enter a password so you can sign in with email later.
          </p>
          {error ? (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center mb-4">
              {error}
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-brown">
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-linen border border-brown/10 rounded-xl py-3 px-4 text-brown focus:outline-none focus:ring-2 focus:ring-amber/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brown/40"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <Button type="submit" variant="wood" className="w-full" isLoading={isLoading}>
              Save password
            </Button>
          </form>
          {success ? <p className="text-center text-green-800 text-sm mt-4">{success}</p> : null}
        </div>
      </div>
    </div>
  );
}
