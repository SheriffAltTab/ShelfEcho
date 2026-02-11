import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Award, Shield } from 'lucide-react';
import { Badge } from '@/shared/ui/Badge';
import apiClient from '@/shared/api/apiClient';

interface ProfileUser {
  id: number;
  name: string;
  avatar: string | null;
  favoriteGenres: string[];
  readingGoal: number;
  createdAt: string;
  role: string;
}

interface ProfileStats {
  totalBooks: number;
  readBooks: number;
  readingBooks: number;
  wantBooks: number;
  reviews: number;
  favorites: number;
}

interface ProfileResponse {
  user: ProfileUser;
  stats: ProfileStats;
  earnedAchievementIds: number[];
}

const achievements = [
  { id: 1, title: 'First Steps', icon: '👣' },
  { id: 2, title: 'Wishlist', icon: '🔖' },
  { id: 3, title: 'From the List', icon: '📌' },
  { id: 4, title: 'Reviewer', icon: '🖊️' },
  { id: 5, title: 'Dabbler', icon: '🎲' },
  { id: 6, title: 'Explorer', icon: '🧭' },
  { id: 7, title: 'Page Turner', icon: '📑' },
  { id: 8, title: 'Genre Explorer', icon: '🗺️' },
  { id: 9, title: 'Critic', icon: '✍️' },
  { id: 10, title: 'Favorites', icon: '❤️' },
  { id: 11, title: 'Bookworm', icon: '📚' },
  { id: 12, title: 'Book Lover', icon: '💕' },
  { id: 13, title: 'Super Critic', icon: '⭐' },
  { id: 14, title: 'Genre Master', icon: '🎯' },
  { id: 15, title: 'Collector', icon: '📖' },
  { id: 16, title: 'Curator', icon: '💎' },
  { id: 17, title: 'Avid Reader', icon: '📗' },
  { id: 18, title: 'Reviewer Pro', icon: '📝' },
  { id: 19, title: 'Monthly Reader', icon: '📅' },
  { id: 20, title: 'Consistent', icon: '🔄' },
  { id: 21, title: 'Speed Reader', icon: '⚡' },
  { id: 22, title: 'Dedicated', icon: '💪' },
  { id: 23, title: 'Plan Ahead', icon: '📋' },
  { id: 24, title: 'Library Builder', icon: '🏛️' },
  { id: 25, title: 'Completionist', icon: '✅' },
  { id: 26, title: 'Stack Builder', icon: '📦' },
  { id: 27, title: 'Bibliophile', icon: '🌟' },
  { id: 28, title: 'Centurion', icon: '🏆' },
  { id: 29, title: 'Prolific', icon: '🔥' },
  { id: 30, title: 'Legend', icon: '👑' },
];

function getRoleBadgeText(role: string): string | null {
  switch (role) {
    case 'superadmin':
      return 'Admin';
    case 'moderator':
      return 'Moderator';
    case 'content_manager':
      return 'Manager';
    default:
      return null;
  }
}

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setError('Invalid user ID');
      return;
    }

    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const { data: res } = await apiClient.get<ProfileResponse>(`/user/${id}/profile`);
        setData(res);
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
        setError(msg || 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
          <span className="ml-3 text-brown/60 font-serif">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-brown/60 hover:text-brown mb-6 transition-colors"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="text-center py-24">
          <h2 className="text-2xl font-serif font-bold text-brown mb-4">
            {error || 'Profile not found'}
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="text-brown/70 hover:text-brown font-serif underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { user, stats, earnedAchievementIds } = data;
  const earnedAchievements = achievements.filter((a) => earnedAchievementIds.includes(a.id));
  const roleBadgeText = getRoleBadgeText(user.role);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-brown/60 hover:text-brown mb-6 transition-colors"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-8"
      >
        {/* Profile Header */}
        <div className="bg-cream rounded-3xl p-8 shadow-warm border border-white/50">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-amber/20 flex items-center justify-center shrink-0">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-serif font-bold text-brown">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>

            <div className="text-center md:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl font-serif font-bold text-brown">{user.name}</h1>
                {roleBadgeText && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber/20 text-amber-800 text-sm font-medium">
                    <Shield size={14} className="text-amber" />
                    {roleBadgeText}
                  </span>
                )}
              </div>
              <p className="text-brown/50 text-sm">#{user.id}</p>
              {user.createdAt && (
                <p className="text-sm text-brown/50 mt-1">
                  Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {[
            { val: stats.totalBooks, label: 'Total Books' },
            { val: stats.readBooks, label: 'Read' },
            { val: stats.readingBooks, label: 'Reading' },
            { val: stats.wantBooks, label: 'Want' },
            { val: stats.reviews, label: 'Reviews' },
            { val: stats.favorites, label: 'Favorites' },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl p-4 shadow-warm border border-brown/5 flex flex-col items-center text-center"
            >
              <p className="text-2xl font-bold text-brown">{s.val}</p>
              <p className="text-xs text-brown/50 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Favorite Genres */}
        {user.favoriteGenres?.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-warm border border-brown/5">
            <h3 className="font-serif font-bold text-xl text-brown mb-4">Favorite Genres</h3>
            <div className="flex flex-wrap gap-2">
              {user.favoriteGenres.map((genre) => (
                <Badge key={genre} variant="amber" className="text-base px-4 py-2">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Earned Achievements */}
        <div className="bg-white p-6 rounded-2xl shadow-warm border border-brown/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif font-bold text-xl text-brown flex items-center gap-2">
              <Award size={20} className="text-amber" /> Achievements
            </h3>
            <span className="text-sm text-brown/50">
              {earnedAchievementIds.length} earned
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {earnedAchievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center p-4 rounded-xl text-center bg-amber/10 border border-amber/20"
              >
                <span className="text-3xl mb-2">{achievement.icon}</span>
                <h4 className="font-bold text-brown text-sm">{achievement.title}</h4>
              </motion.div>
            ))}
          </div>
          {earnedAchievements.length === 0 && (
            <p className="text-brown/50 text-center py-8">No achievements earned yet</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
