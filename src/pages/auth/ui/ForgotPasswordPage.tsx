import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/shared/ui/Button';
import { ShelfEchoLogo } from '@/shared/ui/ShelfEchoLogo';
import apiClient from '@/shared/api/apiClient';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-serif font-bold text-brown mb-2 text-center">Forgot password</h1>
          <p className="text-brown/60 text-sm text-center mb-6">
            Enter your email and we will send you a reset link if an account exists.
          </p>

          {sent ? (
            <p className="text-center text-green-800 text-sm mb-6">
              If an account exists for that email, you will receive reset instructions shortly.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error ? (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center">
                  {error}
                </div>
              ) : null}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-brown">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brown/40" size={18} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-linen border border-brown/10 rounded-xl py-3 pl-12 pr-4 text-brown placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <Button type="submit" variant="wood" className="w-full" isLoading={loading}>
                Send reset link
              </Button>
            </form>
          )}

          <p className="text-center mt-6 text-sm">
            <Link to="/auth" className="text-amber-800 hover:underline">
              Back to sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
