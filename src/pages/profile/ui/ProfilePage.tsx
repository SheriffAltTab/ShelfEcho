import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import {
  Book, Settings, Edit2, Target, TrendingUp, LogOut, Award,
  X, Plus, Check, Camera, Upload, Lock, Mail,
} from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { useAuth } from '@/features/auth/model/authContext';
import { getUserStats, updateProfile, getGenreBreakdown } from '@/features/auth/api/authApi';
import apiClient from '@/shared/api/apiClient';

interface Stats {
  totalBooks: number;
  readBooks: number;
  readingBooks: number;
  wantBooks: number;
  reviews: number;
  favorites: number;
  monthlyReading: { month: string; count: number }[];
}

interface GenreItem {
  name: string;
  count: number;
  percent: number;
}

const ALL_GENRES = [
  'Literary Fiction', 'Mystery', 'Sci-Fi', 'Fantasy', 'Romance',
  'Thriller', 'History', 'Biography', 'Poetry', 'Self-Help',
  'Cooking', 'Art', 'Travel', 'Nature', 'Horror', 'Philosophy',
  'Psychology', 'Science', 'Comics', 'Children',
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GENRE_COLORS = ['#D4A574', '#7BA7A7', '#C9A0A0', '#8C705F', '#b08968', '#6d9a9a', '#a8856c', '#8db3b3'];

const achievements = [
  { id: 1, title: 'Bookworm', description: 'Read 10 books', icon: '📚', threshold: (s: Stats) => s.readBooks >= 10 },
  { id: 2, title: 'First Steps', description: 'Add first book', icon: '👣', threshold: (s: Stats) => s.totalBooks >= 1 },
  { id: 3, title: 'Genre Explorer', description: 'Read 5 genres', icon: '🗺️', threshold: (_s: Stats, gc: number) => gc >= 5 },
  { id: 4, title: 'Critic', description: 'Write 5 reviews', icon: '✍️', threshold: (s: Stats) => s.reviews >= 5 },
  { id: 5, title: 'Centurion', description: 'Read 100 books', icon: '🏆', threshold: (s: Stats) => s.readBooks >= 100 },
  { id: 6, title: 'Collector', description: '20 books in library', icon: '📖', threshold: (s: Stats) => s.totalBooks >= 20 },
];

// Custom label that shows percentage on each pie segment
// Recharts passes all data fields + its own calculated fields to label function.
// We use "pct" (our field) to avoid collision with Recharts' "percent" field.
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct, value }: any) => {
  // Use our pct field (integer 0-100) from the data if available
  const displayPercent = typeof pct === 'number' ? pct : 0;
  if (displayPercent < 3) return null; // Don't show label for tiny segments
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${displayPercent}%`}
    </text>
  );
};

export function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [genreBreakdown, setGenreBreakdown] = useState<GenreItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(true);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsGoal, setSettingsGoal] = useState(12);
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsCurrentPw, setSettingsCurrentPw] = useState('');
  const [settingsNewPw, setSettingsNewPw] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Genre editing
  const [editingGenres, setEditingGenres] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genreSaving, setGenreSaving] = useState(false);
  const [genreError, setGenreError] = useState('');

  // Photo modal
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUserStats().then(setStats).catch(() => {});
    setGenreLoading(true);
    getGenreBreakdown()
      .then((data) => setGenreBreakdown(data.genres))
      .catch(() => {})
      .finally(() => setGenreLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // ---------- Settings ----------
  const openSettings = () => {
    setSettingsName(user?.name || '');
    setSettingsGoal(user?.readingGoal || 12);
    setSettingsEmail(user?.email || '');
    setSettingsCurrentPw('');
    setSettingsNewPw('');
    setSettingsError('');
    setSettingsSuccess('');
    setShowSettings(true);
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const updates: any = {
        name: settingsName,
        readingGoal: settingsGoal,
        email: settingsEmail,
      };
      if (settingsNewPw) {
        updates.currentPassword = settingsCurrentPw;
        updates.newPassword = settingsNewPw;
      }
      await updateProfile(updates);
      await refreshUser();
      setSettingsSuccess('Settings saved successfully!');
      setTimeout(() => setShowSettings(false), 800);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setSettingsError(err?.response?.data?.error || 'Failed to save settings');
    }
    setSettingsSaving(false);
  };

  // ---------- Genres ----------
  const startEditGenres = () => {
    setSelectedGenres(user?.favoriteGenres || []);
    setGenreError('');
    setEditingGenres(true);
  };

  const saveGenres = async () => {
    setGenreSaving(true);
    setGenreError('');
    try {
      await updateProfile({ favoriteGenres: selectedGenres });
      await refreshUser();
      setEditingGenres(false);
    } catch (err: any) {
      console.error('Failed to save genres:', err);
      setGenreError(err?.response?.data?.error || 'Failed to save genres');
    }
    setGenreSaving(false);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  // ---------- Photo Upload ----------
  const openPhotoModal = () => {
    setPhotoPreview(user?.avatar || null);
    setPhotoFile(null);
    setPhotoError('');
    setShowPhotoModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('File too large (max 5MB)'); return; }
    setPhotoError('');
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const savePhoto = async () => {
    if (!photoFile) { setShowPhotoModal(false); return; }
    setPhotoUploading(true);
    setPhotoError('');
    try {
      const formData = new FormData();
      formData.append('avatar', photoFile);
      await apiClient.post('/upload/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      setShowPhotoModal(false);
    } catch (err: any) {
      setPhotoError(err?.response?.data?.error || 'Failed to upload photo');
    }
    setPhotoUploading(false);
  };

  const removePhoto = async () => {
    setPhotoUploading(true);
    try {
      await updateProfile({ avatar: '' });
      await refreshUser();
      setShowPhotoModal(false);
    } catch (err: any) {
      setPhotoError(err?.response?.data?.error || 'Failed to remove photo');
    }
    setPhotoUploading(false);
  };

  // ---------- Chart Data ----------
  const readData = MONTH_NAMES.map((name, idx) => {
    const monthNum = String(idx + 1).padStart(2, '0');
    const entry = stats?.monthlyReading?.find((m) => m.month === monthNum);
    return { name, books: entry?.count || 0 };
  }).filter((_, idx) => idx < new Date().getMonth() + 1 || stats?.monthlyReading?.some((m) => parseInt(m.month) > new Date().getMonth() + 1));

  const chartData = readData.length > 0 ? readData : MONTH_NAMES.slice(0, 6).map((name) => ({ name, books: 0 }));

  // Genre breakdown from real reading data
  // NOTE: Do NOT include a field named "percent" — it conflicts with Recharts' internal percent prop
  const genreData = genreBreakdown.length > 0
    ? genreBreakdown.map((g, i) => ({
        name: g.name,
        value: g.count,
        pct: g.percent,
        color: GENRE_COLORS[i % GENRE_COLORS.length],
      }))
    : [{ name: 'No data yet', value: 100, pct: 100, color: '#ddd' }];

  const favoriteGenres = user?.favoriteGenres || [];

  const earnedAchievements = achievements.map((a) => ({
    ...a,
    earned: stats ? a.threshold(stats, genreBreakdown.length) : false,
  }));
  const earnedCount = earnedAchievements.filter((a) => a.earned).length;

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="bg-cream rounded-3xl p-8 shadow-warm border border-white/50">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-white shadow-md overflow-hidden bg-amber/20 flex items-center justify-center">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl font-serif font-bold text-brown">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <button onClick={openPhotoModal} className="absolute bottom-0 right-0 bg-amber text-brown-dark p-2 rounded-full border-2 border-cream shadow-sm hover:bg-amber/90 transition-colors">
              <Camera size={16} />
            </button>
          </div>

          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-serif font-bold text-brown mb-2">{user?.name}</h1>
            <p className="text-brown/60 mb-4">{user?.email}</p>
            <p className="text-sm text-brown/50 mb-6">
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'recently'}
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-8">
              {[
                { val: stats?.totalBooks || 0, label: 'Books' },
                { val: stats?.readBooks || 0, label: 'Books Read' },
                { val: stats?.reviews || 0, label: 'Reviews' },
                { val: stats?.favorites || 0, label: 'Favorites' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-bold text-brown">{s.val}</p>
                  <p className="text-xs text-brown/50 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="outline" leftIcon={<Settings size={16} />} onClick={openSettings}>Settings</Button>
            <Link to="/my-books"><Button variant="ghost" leftIcon={<Book size={16} />}>My Library</Button></Link>
            <Button variant="ghost" leftIcon={<LogOut size={16} />} onClick={handleLogout} className="text-rose">Log Out</Button>
          </div>
        </div>
      </div>

      {/* Favorite Genres */}
      <div className="bg-white p-6 rounded-2xl shadow-warm border border-brown/5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif font-bold text-xl text-brown">Favorite Genres</h3>
          {!editingGenres ? (
            <button onClick={startEditGenres} className="text-sm text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1">
              <Edit2 size={14} /> Edit
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              {genreError && <span className="text-rose text-xs">{genreError}</span>}
              <Button variant="ghost" size="sm" onClick={() => setEditingGenres(false)}><X size={14} /></Button>
              <Button variant="secondary" size="sm" onClick={saveGenres} isLoading={genreSaving} leftIcon={<Check size={14} />}>Save</Button>
            </div>
          )}
        </div>
        {editingGenres ? (
          <div className="flex flex-wrap gap-2">
            {ALL_GENRES.map((genre) => (
              <Badge key={genre} variant={selectedGenres.includes(genre) ? 'amber' : 'default'} onClick={() => toggleGenre(genre)} selected={selectedGenres.includes(genre)} className="text-base px-4 py-2 cursor-pointer">
                {genre}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {favoriteGenres.length > 0 ? favoriteGenres.map((genre) => (
              <Badge key={genre} variant="amber" className="text-base px-4 py-2">{genre}</Badge>
            )) : (
              <p className="text-brown/40 text-sm">No genres selected yet</p>
            )}
            <button onClick={startEditGenres} className="px-4 py-2 border-2 border-dashed border-brown/20 rounded-full text-brown/50 text-sm hover:border-brown/40 hover:text-brown/70 transition-colors">
              <Plus size={14} className="inline mr-1" /> Add Genre
            </button>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Reading Activity */}
        <div className="bg-white p-6 rounded-2xl shadow-warm border border-brown/5">
          <h3 className="font-serif font-bold text-xl text-brown mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-amber" /> Reading Activity
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8C705F' }} />
                <Tooltip cursor={{ fill: '#FAF6F0' }} contentStyle={{ backgroundColor: '#FFF', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="books" radius={[4, 4, 0, 0]}>
                  {chartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#D4A574' : '#C9A0A0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Genre Breakdown */}
        <div className="bg-white p-6 rounded-2xl shadow-warm border border-brown/5">
          <h3 className="font-serif font-bold text-xl text-brown mb-6 flex items-center gap-2">
            <Book size={20} className="text-teal" /> Genre Breakdown
          </h3>
          {genreLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genreData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={renderCustomLabel}
                      labelLine={false}
                    >
                      {genreData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} books`, name]}
                      contentStyle={{ backgroundColor: '#FFF', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {genreData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-brown/70">{entry.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-white p-6 rounded-2xl shadow-warm border border-brown/5">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-serif font-bold text-xl text-brown flex items-center gap-2">
            <Award size={20} className="text-amber" /> Achievements
          </h3>
          <span className="text-sm text-brown/50">{earnedCount} of {achievements.length} earned</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {earnedAchievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              whileHover={{ scale: 1.05 }}
              className={`flex flex-col items-center p-4 rounded-xl text-center transition-colors ${
                achievement.earned ? 'bg-amber/10 border border-amber/20' : 'bg-brown/5 border border-brown/10 opacity-50'
              }`}
            >
              <span className="text-3xl mb-2">{achievement.icon}</span>
              <h4 className="font-bold text-brown text-sm mb-1">{achievement.title}</h4>
              <p className="text-xs text-brown/50">{achievement.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Reading Goal */}
      <div className="bg-gradient-to-br from-teal/20 to-teal/5 rounded-3xl p-8 border border-teal/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <Target size={28} className="text-teal" />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold text-brown">2026 Reading Goal</h3>
              <p className="text-brown/70">{user?.readingGoal || 12} books &bull; {stats?.readBooks || 0} completed</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-full md:w-64 bg-brown/10 rounded-full h-3">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((stats?.readBooks || 0) / (user?.readingGoal || 12)) * 100)}%` }} transition={{ duration: 0.8, delay: 0.2 }} className="bg-teal h-3 rounded-full" />
            </div>
            <span className="text-lg font-bold text-teal-800 whitespace-nowrap">
              {Math.round(((stats?.readBooks || 0) / (user?.readingGoal || 12)) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-cream rounded-2xl shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif font-bold text-brown">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-brown/40 hover:text-brown"><X size={24} /></button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-brown">Display Name</label>
                <input type="text" value={settingsName} onChange={(e) => setSettingsName(e.target.value)} className="w-full bg-linen border border-brown/10 rounded-xl py-3 px-4 text-brown focus:outline-none focus:ring-2 focus:ring-amber/50" />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-brown flex items-center gap-1"><Mail size={14} /> Email</label>
                <input type="email" value={settingsEmail} onChange={(e) => setSettingsEmail(e.target.value)} className="w-full bg-linen border border-brown/10 rounded-xl py-3 px-4 text-brown focus:outline-none focus:ring-2 focus:ring-amber/50" />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-brown">
                  Reading Goal: <span className="font-bold text-amber-700">{settingsGoal} books</span>
                </label>
                <input type="range" min="1" max="100" value={settingsGoal} onChange={(e) => setSettingsGoal(parseInt(e.target.value))} className="w-full h-2 bg-brown/10 rounded-lg appearance-none cursor-pointer accent-amber" />
              </div>

              <div className="border-t border-brown/10 pt-5">
                <h3 className="text-sm font-bold text-brown flex items-center gap-1 mb-3"><Lock size={14} /> Change Password</h3>
                <div className="space-y-2">
                  <input type="password" placeholder="Current password" value={settingsCurrentPw} onChange={(e) => setSettingsCurrentPw(e.target.value)} className="w-full bg-linen border border-brown/10 rounded-xl py-3 px-4 text-brown placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50" />
                  <input type="password" placeholder="New password (min 6 characters)" value={settingsNewPw} onChange={(e) => setSettingsNewPw(e.target.value)} className="w-full bg-linen border border-brown/10 rounded-xl py-3 px-4 text-brown placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50" />
                </div>
                <p className="text-xs text-brown/40 mt-1">Leave blank if you don't want to change password</p>
              </div>

              {settingsError && <p className="text-rose text-sm">{settingsError}</p>}
              {settingsSuccess && <p className="text-teal text-sm font-medium">{settingsSuccess}</p>}

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={() => setShowSettings(false)} className="flex-1">Cancel</Button>
                <Button variant="wood" onClick={saveSettings} isLoading={settingsSaving} className="flex-1">Save Changes</Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPhotoModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-cream rounded-2xl shadow-2xl w-full max-w-sm p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif font-bold text-brown">Change Photo</h2>
              <button onClick={() => setShowPhotoModal(false)} className="text-brown/40 hover:text-brown"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-amber/20 flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <Camera size={32} className="text-brown/30" />
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleFileSelect} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-brown/20 rounded-xl text-brown/60 hover:border-brown/40 hover:text-brown/80 transition-colors">
                <Upload size={18} />
                {photoFile ? photoFile.name : 'Choose an image file'}
              </button>
              <p className="text-xs text-brown/40 text-center">JPEG, PNG, GIF, or WebP. Max 5MB.</p>
              {photoError && <p className="text-rose text-sm text-center">{photoError}</p>}
              <div className="flex gap-3">
                <Button variant="ghost" onClick={removePhoto} size="sm" isLoading={photoUploading && !photoFile}>Remove Photo</Button>
                <Button variant="wood" onClick={savePhoto} className="flex-1" isLoading={photoUploading && !!photoFile} disabled={!photoFile}>Upload</Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
