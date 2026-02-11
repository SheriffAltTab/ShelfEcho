import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { ShelfEchoLogo } from '@/shared/ui/ShelfEchoLogo';
import { useAuth } from '@/features/auth/model/authContext';

type AuthMode = 'login' | 'signup';

export function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        await register(formData.name, formData.email, formData.password);
        navigate('/onboarding');
      } else {
        await login(formData.email, formData.password);
        navigate('/');
      }
    } catch (err: unknown) {
      const ax = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: unknown; status?: number } }) : null;
      const msg =
        (ax?.response?.data && typeof ax.response.data === 'object' && 'error' in ax.response.data && ax.response.data.error) ||
        (err instanceof Error ? err.message : '') ||
        (ax?.response?.status === 404 || (ax?.response?.status != null && ax.response.status >= 500)
          ? 'Сервер недоступний. Спробуйте пізніше.'
          : ax?.response?.data && typeof ax.response.data === 'string'
            ? 'Сервер повернув некоректну відповідь. Перевірте, чи працює бекенд.'
            : 'Щось пішло не так. Спробуйте ще раз.');
      setError(typeof msg === 'string' && msg.trim() ? msg : 'Щось пішло не так. Спробуйте ще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  return (
    <div className="min-h-screen bg-linen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-amber/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-rose/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <ShelfEchoLogo className="h-24 w-auto" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-cream rounded-3xl shadow-warm border border-white/50 overflow-hidden"
        >
          <div className="flex border-b border-brown/10">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-4 text-center font-medium transition-colors relative ${
                mode === 'login' ? 'text-brown' : 'text-brown/50 hover:text-brown/70'
              }`}
            >
              Sign In
              {mode === 'login' && (
                <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />
              )}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-4 text-center font-medium transition-colors relative ${
                mode === 'signup' ? 'text-brown' : 'text-brown/50 hover:text-brown/70'
              }`}
            >
              Create Account
              {mode === 'signup' && (
                <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />
              )}
            </button>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-serif font-bold text-brown mb-2">
                    {mode === 'login' ? 'Welcome Back' : 'Join the Community'}
                  </h1>
                  <p className="text-brown/60 text-sm">
                    {mode === 'login'
                      ? 'Sign in to continue your reading journey'
                      : 'Create an account to start discovering books'}
                  </p>
                </div>

                {error ? (
                  <div role="alert" className="mb-4 min-h-[2.5rem] p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center flex items-center justify-center">
                    {error}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {mode === 'signup' && (
                    <div className="space-y-2">
                      <label htmlFor="name" className="block text-sm font-medium text-brown">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brown/40" size={18} />
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Alice Reader"
                          className="w-full bg-linen border border-brown/10 rounded-xl py-3 pl-12 pr-4 text-brown placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-transparent transition-all"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium text-brown">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brown/40" size={18} />
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className="w-full bg-linen border border-brown/10 rounded-xl py-3 pl-12 pr-4 text-brown placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password" className="block text-sm font-medium text-brown">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brown/40" size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full bg-linen border border-brown/10 rounded-xl py-3 pl-12 pr-12 text-brown placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-transparent transition-all"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-brown/40 hover:text-brown transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="wood"
                    size="lg"
                    className="w-full"
                    isLoading={isLoading}
                  >
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        <p className="text-center text-sm text-brown/50 mt-6">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className="text-amber-700 hover:text-amber-800 font-medium"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className="text-amber-700 hover:text-amber-800 font-medium"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
