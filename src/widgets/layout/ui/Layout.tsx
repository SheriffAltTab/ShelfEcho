import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Home, User, Search, LogOut, Compass } from 'lucide-react';
import { ShelfEchoLogo } from '@/shared/ui/ShelfEchoLogo';
import { useAuth } from '@/features/auth/model/authContext';
import { useState, type FormEvent } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Compass, label: 'Discover', path: '/discover' },
    { icon: BookOpen, label: 'My Books', path: '/my-books' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-linen text-brown font-sans selection:bg-amber/30">
      <header className="sticky top-0 z-50 bg-linen/95 backdrop-blur-sm border-b border-brown/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <ShelfEchoLogo className="h-20 w-auto" />
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors relative py-4 ${
                    location.pathname === item.path
                      ? 'text-brown'
                      : 'text-brown/60 hover:text-brown'
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                  {location.pathname === item.path && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber"
                    />
                  )}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <form onSubmit={handleSearch} className="hidden sm:flex relative">
                <input
                  type="text"
                  placeholder="Search books..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-cream border-none rounded-full py-1.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-amber/50 w-48 transition-all focus:w-64"
                />
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-brown/40"
                  size={14}
                />
              </form>

              <button
                onClick={handleLogout}
                className="relative p-2 text-brown/60 hover:text-brown transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>

              <Link
                to="/profile"
                className="w-8 h-8 rounded-full bg-amber/20 border border-amber/50 flex items-center justify-center overflow-hidden text-sm font-bold text-brown"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user?.name?.charAt(0)?.toUpperCase() || 'U'
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
