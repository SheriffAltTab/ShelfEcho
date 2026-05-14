import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/shared/ui/Button';
import { ShelfEchoLogo } from '@/shared/ui/ShelfEchoLogo';
import apiClient from '@/shared/api/apiClient';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid reset link.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err: unknown) {
      const ax = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { error?: string } } }).response : undefined;
      setError(ax?.data?.error && typeof ax.data.error === 'string' ? ax.data.error : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-linen flex flex-col items-center justify-center p-6">
        <p className="text-red-700 mb-4">Invalid reset link.</p>
        <Link to="/auth" className="text-amber-800 underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <ShelfEchoLogo className="h-20 w-auto" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-cream rounded-3xl shadow-warm border border-white/50 p-8"
        >
          <h1 className="text-2xl font-serif font-bold text-brown mb-2 text-center">New password</h1>
          {done ? (
            <p className="text-center text-green-800 text-sm mb-4">
              Password updated. You can sign in with your new password.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              {error ? (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center">
                  {error}
                </div>
              ) : null}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-brown">
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brown/40" size={18} />
                  <input
                    id="password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-linen border border-brown/10 rounded-xl py-3 pl-12 pr-12 text-brown focus:outline-none focus:ring-2 focus:ring-amber/50"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-brown/40"
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <Button type="submit" variant="wood" className="w-full" isLoading={loading}>
                Save password
              </Button>
            </form>
          )}
          <p className="text-center mt-6 text-sm">
            <Link to="/auth" className="text-amber-800 hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
