import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { ShelfEchoLogo } from '@/shared/ui/ShelfEchoLogo';
import { useAuth } from '@/features/auth/model/authContext';
import { getGoogleAuthStartUrl } from '@/features/auth/api/authApi';

type AuthMode = 'login' | 'signup';

function GoogleGLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerBanner, setRegisterBanner] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(decodeURIComponent(err));
    if (searchParams.get('needsVerification') === '1') {
      setError('Please verify your email before signing in.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegisterBanner('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const r = await register(formData.name, formData.email, formData.password);
        if (r.needsVerification) {
          setRegisterBanner(r.message || 'Check your email to verify your account before signing in.');
        } else {
          navigate('/onboarding');
        }
      } else {
        await login(formData.email, formData.password);
        navigate('/');
      }
    } catch (err: unknown) {
      const ax = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: unknown; status?: number } }) : null;
      const data = ax?.response?.data;
      const backendError =
        data && typeof data === 'object' && ('error' in data ? (data as { error?: string }).error : ('message' in data ? (data as { message?: string }).message : undefined));
      const msg =
        (typeof backendError === 'string' && backendError.trim() ? backendError : null) ||
        (err instanceof Error ? err.message : '') ||
        (ax?.response?.status === 404 || (ax?.response?.status != null && ax.response.status >= 500)
          ? 'Server unavailable. Please try again later.'
          : ax?.response?.data && typeof ax.response.data === 'string'
            ? 'Server returned an invalid response. Check that the API is running.'
            : 'Something went wrong. Please try again.');
      setError(typeof msg === 'string' && msg.trim() ? msg : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setRegisterBanner('');
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
              onClick={() => { setMode('login'); setError(''); setRegisterBanner(''); }}
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
              onClick={() => { setMode('signup'); setError(''); setRegisterBanner(''); }}
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

                {registerBanner ? (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-sm text-center">
                    {registerBanner}
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
                    {mode === 'login' ? (
                      <div className="text-right -mt-2">
                        <Link to="/forgot-password" className="text-sm text-amber-800 hover:underline">
                          Forgot password?
                        </Link>
                      </div>
                    ) : null}
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

                  <div className="flex items-center gap-3 pt-1">
                    <div className="h-px flex-1 bg-brown/15" />
                    <span className="text-xs text-brown/45 uppercase tracking-wide">or</span>
                    <div className="h-px flex-1 bg-brown/15" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full border-brown/20 text-brown"
                    leftIcon={<GoogleGLogo />}
                    onClick={() => {
                      window.location.assign(getGoogleAuthStartUrl());
                    }}
                  >
                    Continue with Google
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
                onClick={() => { setMode('signup'); setError(''); setRegisterBanner(''); }}
                className="text-amber-700 hover:text-amber-800 font-medium"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); setRegisterBanner(''); }}
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
