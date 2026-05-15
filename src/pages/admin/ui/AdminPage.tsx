import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { bookPath } from '@/shared/lib/bookKeys';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  BarChart3, Settings, Shield, Activity, Users, Search,
  AlertTriangle, Trash2, Eye, Ban, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/features/auth/model/authContext';
import apiClient from '@/shared/api/apiClient';

/* ------------------------------------------------------------------ */
/*  Google Logo Component                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Tab = 'dashboard' | 'recommendations' | 'moderation' | 'health';
type ModerationSubTab = 'reports' | 'users';

interface RegistrationPoint { day: string; count: number }
interface TopWantBook { rank: number; title: string; count: number }
interface GenreSlice { name: string; count: number; percent?: number }

interface RecWeights {
  genre_weight: number;
  author_weight: number;
  subject_weight: number;
  collaborative_weight: number;
}

interface SimulationResult {
  user: { id: number; name: string; email?: string };
  favoriteGenres?: string[];
  readingList?: { title: string; author: string; status: string }[];
  similarUsers?: { userId: number; commonBooks: number }[];
  explanation?: string | Record<string, string>;
}

interface Report {
  id: number;
  comment_id: number;
  book_key: string;
  comment_text: string;
  comment_user_name: string;
  reporter_name: string;
  reason: string;
  created_at: string;
}

interface SearchedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  blocked: boolean;
  created_at?: string;
  google_id?: string;
  isGoogleUser?: boolean;
}

interface UserActivity {
  comments: { text: string; book_key: string; created_at: string }[];
  reading_list: { title: string; status: string }[];
  favorites: string[];
  searches: string[];
}

interface ZeroResultSearch {
  query: string;
  times_searched: number;
  last_searched: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CHART_COLORS = ['#D4A574', '#7BA7A7', '#C9A0A0', '#8C705F', '#b08968', '#6d9a9a', '#a8856c', '#8db3b3'];

const SIDEBAR_ITEMS: { tab: Tab; icon: typeof BarChart3; label: string }[] = [
  { tab: 'dashboard', icon: BarChart3, label: 'Dashboard' },
  { tab: 'recommendations', icon: Settings, label: 'Rec Tuning' },
  { tab: 'moderation', icon: Shield, label: 'Community & Moderation' },
  { tab: 'health', icon: Activity, label: 'System Health' },
];

function tabsForRole(role?: string): Tab[] {
  switch (role) {
    case 'superadmin':
      return ['dashboard', 'recommendations', 'moderation', 'health'];
    case 'content_manager':
      return ['dashboard', 'recommendations', 'health'];
    case 'moderator':
      return ['moderation'];
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Shared UI helpers                                                  */
/* ------------------------------------------------------------------ */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-2xl shadow-[0_2px_12px_rgba(140,112,95,0.08)] p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold text-amber-900 mb-4">{children}</h2>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
    </div>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'danger' | 'success' }) {
  const colors = {
    default: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-700',
    success: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[variant]}`}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard Statistics                                               */
/* ------------------------------------------------------------------ */

function DashboardSection() {
  const [registrations, setRegistrations] = useState<RegistrationPoint[]>([]);
  const [topWant, setTopWant] = useState<TopWantBook[]>([]);
  const [genres, setGenres] = useState<GenreSlice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      apiClient.get<{ registrations: RegistrationPoint[] }>('/admin/stats/registrations'),
      apiClient.get<{ books: TopWantBook[] }>('/admin/stats/top-want'),
      apiClient.get<{ genres: GenreSlice[] }>('/admin/stats/genre-distribution'),
    ])
      .then(([regRes, topRes, genreRes]) => {
        if (cancelled) return;
        setRegistrations(regRes.data?.registrations ?? []);
        const books = topRes.data?.books ?? [];
        setTopWant(books.map((b, i) => ({ ...b, rank: i + 1 })));
        setGenres(genreRes.data?.genres ?? []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <SectionHeading>Dashboard Statistics</SectionHeading>

      {/* Registrations chart */}
      <Card>
        <h3 className="text-sm font-medium text-gray-500 mb-4">New Registrations (Last 30 Days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={registrations}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#D4A574"
                strokeWidth={2}
                dot={{ r: 3, fill: '#D4A574' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top "Want to Read" */}
        <Card>
          <h3 className="text-sm font-medium text-gray-500 mb-4">Top 10 "Want to Read"</h3>
          <ul className="space-y-2">
            {topWant.map((book, i) => (
              <li key={i} className="flex items-center gap-3 py-1.5">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">
                  {book.rank}
                </span>
                <span className="flex-1 text-sm text-gray-800 truncate">{book.title}</span>
                <span className="text-xs text-gray-400 font-medium">{book.count}</span>
              </li>
            ))}
            {topWant.length === 0 && (
              <li className="text-sm text-gray-400 py-4 text-center">No data yet</li>
            )}
          </ul>
        </Card>

        {/* Genre distribution */}
        <Card>
          <h3 className="text-sm font-medium text-gray-500 mb-4">Genre Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genres}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                  label={({ name }) => name}
                >
                  {genres.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recommendation Tuning                                              */
/* ------------------------------------------------------------------ */

function RecommendationSection() {
  const [weights, setWeights] = useState<RecWeights>({
    genre_weight: 50,
    author_weight: 50,
    subject_weight: 50,
    collaborative_weight: 50,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [simUserId, setSimUserId] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    apiClient.get<{ weights: RecWeights }>('/admin/rec-weights')
      .then((res) => setWeights(res.data?.weights ?? { genre_weight: 50, author_weight: 50, subject_weight: 50, collaborative_weight: 50 }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/admin/rec-weights', { weights });
      showToast('Weights saved');
    } catch {
      showToast('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async () => {
    if (!simUserId.trim()) return;
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await apiClient.get(`/admin/simulate/${simUserId.trim()}`);
      setSimResult(res.data);
    } catch {
      showToast('Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await apiClient.post('/admin/cache/clear');
      showToast('Cache cleared');
    } catch {
      showToast('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  if (loading) return <Spinner />;

  const sliders: { key: keyof RecWeights; label: string }[] = [
    { key: 'genre_weight', label: 'Genre Weight' },
    { key: 'author_weight', label: 'Author Weight' },
    { key: 'subject_weight', label: 'Subject Weight' },
    { key: 'collaborative_weight', label: 'Collaborative Weight' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeading>Recommendation Tuning</SectionHeading>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 bg-amber-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weight sliders */}
      <Card>
        <h3 className="text-sm font-medium text-gray-500 mb-5">Weight Configuration</h3>
        <div className="space-y-5">
          {sliders.map(({ key, label }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-700">{label}</label>
                <span className="text-xs font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  {weights[key]}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={weights[key]}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                className="w-full h-2 rounded-full appearance-none bg-amber-100 accent-amber-700 cursor-pointer"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Weights'}
          </button>
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {clearing ? 'Clearing…' : 'Clear Cache'}
          </button>
        </div>
      </Card>

      {/* Simulation */}
      <Card>
        <h3 className="text-sm font-medium text-gray-500 mb-4">Simulate Recommendations</h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="User ID"
            value={simUserId}
            onChange={(e) => setSimUserId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <button
            onClick={handleSimulate}
            disabled={simulating || !simUserId.trim()}
            className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition disabled:opacity-50"
          >
            {simulating ? 'Running…' : 'Simulate'}
          </button>
        </div>

        <AnimatePresence>
          {simResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 border-t pt-5 space-y-4 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">User</p>
                  <p className="text-sm font-medium text-gray-800">
                    {simResult.user.name} <span className="text-gray-400">(#{simResult.user.id})</span>
                  </p>
                  <p className="text-xs text-gray-500">{simResult.user.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Favorite Genres</p>
                  <div className="flex flex-wrap gap-1">
                    {(simResult.favoriteGenres ?? []).map((g) => (
                      <Badge key={g}>{g}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Reading List</p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                  {(simResult.readingList ?? []).map((t, i) => (
                    <li key={i}>{typeof t === 'string' ? t : `${t.title} — ${t.status}`}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Similar Users</p>
                <div className="flex flex-wrap gap-1.5">
                  {(simResult.similarUsers ?? []).map((u, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {typeof u === 'object' && u !== null && 'userId' in u ? `User #${(u as any).userId} (${(u as any).commonBooks} books)` : String(u)}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Explanation</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {typeof simResult.explanation === 'string'
                    ? simResult.explanation
                    : simResult.explanation && typeof simResult.explanation === 'object'
                      ? Object.entries(simResult.explanation).map(([k, v]) => `${k}: ${v}`).join('\n')
                      : '—'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Community & Moderation                                             */
/* ------------------------------------------------------------------ */

function ModerationSection() {
  const { user: currentUser } = useAuth();
  const [subTab, setSubTab] = useState<ModerationSubTab>('reports');

  const subTabs: { key: ModerationSubTab; icon: typeof Shield; label: string }[] = [
    { key: 'reports', icon: AlertTriangle, label: 'Reports' },
    { key: 'users', icon: Users, label: 'Users' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeading>Community & Moderation</SectionHeading>

      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-[0_1px_4px_rgba(140,112,95,0.06)]">
        {subTabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition ${
              subTab === key
                ? 'bg-amber-100/60 text-amber-800'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {subTab === 'reports' && <ReportsPanel key="reports" />}
        {subTab === 'users' && <UsersPanel key="users" isSuperadmin={currentUser?.role === 'superadmin'} currentUserId={currentUser?.id ?? null} />}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Reports Panel ---------- */

function ReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<{ reports: Report[] }>('/admin/moderation/reports')
      .then((res) => setReports(res.data?.reports ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (reports.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Card className="text-center py-12">
          <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No reports</p>
        </Card>
      </motion.div>
    );
  }

  const handleDeleteComment = async (commentId: number) => {
    try {
      await apiClient.put(`/admin/moderation/${commentId}`, { action: 'delete' });
      setReports((prev) => prev.filter((r) => r.comment_id !== commentId));
    } catch { /* ignore */ }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      {reports.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-800">Comment author: {r.comment_user_name ?? '—'}</span>
                <span className="text-xs text-gray-400">Reported by: {r.reporter_name}</span>
              </div>
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{r.comment_text}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="danger">{r.reason}</Badge>
                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                to={r.book_key ? bookPath(r.book_key) : '#'}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 transition"
              >
                <Eye className="w-4 h-4" />
                View comment
              </Link>
              <button
                onClick={() => handleDeleteComment(r.comment_id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete comment
              </button>
            </div>
          </div>
        </Card>
      ))}
    </motion.div>
  );
}

/* ---------- Users Panel ---------- */

function UsersPanel({ isSuperadmin, currentUserId }: { isSuperadmin: boolean; currentUserId: number | null }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SearchedUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [usersError, setUsersError] = useState('');
  const [activityUser, setActivityUser] = useState<SearchedUser | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const loadUsers = useCallback(async (nextPage = page, nextQuery = query) => {
    setListLoading(true);
    setUsersError('');
    try {
      const res = await apiClient.get<{
        users: SearchedUser[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>('/admin/users', {
        params: { page: nextPage, pageSize, q: nextQuery.trim() || undefined },
      });
      const raw = res.data?.users ?? [];
      setUsers(raw.map((u) => ({ ...u, blocked: !!u.blocked, isGoogleUser: !!u.google_id })));
      setTotal(res.data?.total ?? raw.length);
      setPage(res.data?.page ?? nextPage);
      setTotalPages(Math.max(1, res.data?.totalPages ?? 1));
    } catch {
      setUsers([]);
      setTotal(0);
      setTotalPages(1);
      setUsersError('Failed to load users');
    } finally {
      setListLoading(false);
    }
  }, [page, pageSize, query]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadUsers(page, query);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [loadUsers, page, query]);

  const handleViewActivity = async (u: SearchedUser) => {
    setActivityUser(u);
    setActivityLoading(true);
    setActivity(null);
    try {
      const res = await apiClient.get(`/admin/users/${u.id}/activity`);
      const d = res.data as any;
      setActivity({
        comments: d?.comments ?? [],
        reading_list: d?.readingList ?? d?.reading_list ?? [],
        favorites: Array.isArray(d?.favorites) ? d.favorites.map((f: any) => typeof f === 'string' ? f : f?.title ?? f?.book_key ?? '') : [],
        searches: Array.isArray(d?.searches) ? d.searches.map((s: any) => typeof s === 'string' ? s : s?.query ?? '') : [],
      });
    } catch { /* ignore */ }
    finally { setActivityLoading(false); }
  };

  const handleBlockToggle = async (u: SearchedUser) => {
    try {
      await apiClient.put(`/admin/users/${u.id}/block`, { blocked: !u.blocked });
      setUsers((prev) =>
        prev.map((usr) => (usr.id === u.id ? { ...usr, blocked: !usr.blocked } : usr)),
      );
    } catch { /* ignore */ }
  };

  const handleRoleChange = async (u: SearchedUser, newRole: string) => {
    try {
      await apiClient.put(`/admin/users/${u.id}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((usr) => (usr.id === u.id ? { ...usr, role: newRole } : usr)),
      );
    } catch { /* ignore */ }
  };

  const handleDeleteUser = async (u: SearchedUser) => {
    if (!window.confirm(`Delete ${u.name}'s account? This permanently removes their data.`)) return;
    try {
      await apiClient.delete(`/admin/users/${u.id}`);
      if (activityUser?.id === u.id) {
        setActivityUser(null);
        setActivity(null);
      }
      const nextPage = users.length === 1 && page > 0 ? page - 1 : page;
      await loadUsers(nextPage, query);
    } catch (err: any) {
      setUsersError(err?.response?.data?.error || 'Failed to delete user');
    }
  };

  if (listLoading) return <Spinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      {/* Server-side filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by name, email, or user ID…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Showing {users.length} of {total} users
      </p>
      {usersError && <p className="text-sm text-red-500">{usersError}</p>}

      {/* Results */}
      {users.map((u) => (
        <Card key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-medium text-gray-800">{u.name}</span>
              {u.isGoogleUser ? (
                <div className="inline-flex items-center justify-center w-6 h-6">
                  <GoogleGLogo />
                </div>
              ) : null}
              <Badge>{u.role}</Badge>
              {u.blocked ? <Badge variant="danger">Blocked</Badge> : <Badge variant="success">Not Blocked</Badge>}
            </div>
            <p className="text-xs text-gray-500">{u.email} · ID {u.id}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => handleViewActivity(u)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              <Eye className="w-3.5 h-3.5" /> Activity
            </button>
            <button
              onClick={() => handleBlockToggle(u)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                u.blocked
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              <Ban className="w-3.5 h-3.5" /> {u.blocked ? 'Unblock' : 'Block'}
            </button>
            <button
              onClick={() => handleDeleteUser(u)}
              disabled={u.id === currentUserId}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-40 disabled:pointer-events-none"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            {isSuperadmin && (
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u, e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                <option value="user">user</option>
                <option value="moderator">moderator</option>
                <option value="content_manager">content_manager</option>
                <option value="superadmin">superadmin</option>
              </select>
            )}
          </div>
        </Card>
      ))}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page <= 0 || listLoading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
        >
          Previous
        </button>
        <span className="text-xs text-gray-500">
          Page {page + 1} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1 || listLoading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
        >
          Next
        </button>
      </div>

      {/* Activity Modal / Inline */}
      <AnimatePresence>
        {activityUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            onClick={() => { setActivityUser(null); setActivity(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Activity — {activityUser.name}
                </h3>
                <button
                  onClick={() => { setActivityUser(null); setActivity(null); }}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ✕
                </button>
              </div>

              {activityLoading ? (
                <Spinner />
              ) : activity ? (
                <div className="space-y-5">
                  {/* Comments */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Comments ({(activity.comments ?? []).length})
                    </p>
                    {(activity.comments ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400">None</p>
                    ) : (
                      <ul className="space-y-2">
                        {(activity.comments ?? []).map((c, i) => (
                          <li key={i} className="text-sm text-gray-600">
                            <span className="text-gray-400 text-xs">{c.book_key}</span> — {c.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Reading list */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Reading List ({(activity.reading_list ?? []).length})
                    </p>
                    {(activity.reading_list ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400">Empty</p>
                    ) : (
                      <ul className="space-y-1">
                        {(activity.reading_list ?? []).map((b, i) => (
                          <li key={i} className="text-sm text-gray-600 flex justify-between">
                            <span>{b.title}</span>
                            <Badge>{b.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Favorites */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Favorites ({(activity.favorites ?? []).length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(activity.favorites ?? []).map((f, i) => (
                        <Badge key={i}>{typeof f === 'string' ? f : (f as any)?.title ?? ''}</Badge>
                      ))}
                      {(activity.favorites ?? []).length === 0 && (
                        <p className="text-sm text-gray-400">None</p>
                      )}
                    </div>
                  </div>

                  {/* Searches */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Recent Searches ({(activity.searches ?? []).length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(activity.searches ?? []).map((s, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{typeof s === 'string' ? s : (s as any)?.query ?? ''}</span>
                      ))}
                      {(activity.searches ?? []).length === 0 && (
                        <p className="text-sm text-gray-400">None</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-red-500">Failed to load activity</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  System Health                                                      */
/* ------------------------------------------------------------------ */

function HealthSection() {
  const [searches, setSearches] = useState<ZeroResultSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<{ zeroResults: { query: string; search_count: number; last_searched: string }[] }>('/admin/search-analytics')
      .then((res) => {
        const list = res.data?.zeroResults ?? [];
        setSearches(list.map((r) => ({
          query: r.query,
          times_searched: r.search_count,
          last_searched: r.last_searched,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <SectionHeading>System Health</SectionHeading>

      <Card>
        <h3 className="text-sm font-medium text-gray-500 mb-4">Zero-Result Searches</h3>

        {searches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No zero-result searches recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Query</th>
                  <th className="text-right py-2 px-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Times Searched</th>
                  <th className="text-right py-2 pl-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Last Searched</th>
                </tr>
              </thead>
              <tbody>
                {searches.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-4 text-gray-800 font-medium">{s.query}</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">{s.times_searched}</td>
                    <td className="py-2.5 pl-4 text-right text-gray-400 text-xs">
                      {new Date(s.last_searched).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main AdminPage                                                     */
/* ------------------------------------------------------------------ */

export function AdminPage() {
  const { user } = useAuth();
  const allowedTabs = tabsForRole(user?.role);
  const [activeTab, setActiveTab] = useState<Tab>(allowedTabs[0] ?? 'dashboard');

  // Reset active tab if role changes and current tab is not allowed
  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] ?? 'dashboard');
    }
  }, [allowedTabs, activeTab]);

  if (allowedTabs.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF0E6] flex items-center justify-center p-8">
        <Card className="text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">Access Denied</p>
          <p className="text-sm text-gray-500">You don't have permission to view the admin panel.</p>
        </Card>
      </div>
    );
  }

  const visibleSidebarItems = SIDEBAR_ITEMS.filter((item) => allowedTabs.includes(item.tab));

  return (
    <div className="min-h-screen bg-[#FAF0E6] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-[2px_0_12px_rgba(140,112,95,0.06)] sticky top-0 h-screen shrink-0 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-lg font-bold text-amber-900">Admin Panel</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {user?.name} · <span className="capitalize">{user?.role?.replace('_', ' ')}</span>
          </p>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-1">
          {visibleSidebarItems.map(({ tab, icon: Icon, label }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-50/80 text-amber-800 border-l-2 border-amber-600 pl-[10px]'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-l-2 border-transparent pl-[10px]'
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-300 text-center">ShelfEcho Admin v1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <DashboardSection />}
            {activeTab === 'recommendations' && <RecommendationSection />}
            {activeTab === 'moderation' && <ModerationSection />}
            {activeTab === 'health' && <HealthSection />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
