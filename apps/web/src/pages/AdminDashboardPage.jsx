import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Zap, 
  Search, 
  Activity, 
  ShieldCheck,
  ShieldOff,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import AdminLayout from '@/components/AdminLayout';

export default function AdminDashboardPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchData(true);
  }, [offset]);

  const fetchData = async (initial = false) => {
    try {
      if (initial) setLoading(true);
      else setRefreshing(true);
      
      const [usersData, statsData] = await Promise.all([
        api.getAllUsers(limit, offset),
        api.getPlatformStats()
      ]);
      
      setUsers(usersData.users || []);
      setTotal(usersData.pagination?.total || 0);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to load administrative data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUpdateUser = async (userId, data) => {
    try {
      await api.updateUserAdmin(userId, data);
      toast.success('User updated successfully');
      fetchData(false);
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleToggleAdmin = async (userId, currentIsAdmin, username) => {
    // Prevent removing your own admin access
    if (userId === currentUser?.id && currentIsAdmin) {
      toast.error("You cannot remove your own admin privileges");
      return;
    }
    const action = currentIsAdmin ? 'revoke admin from' : 'grant admin to';
    if (!confirm(`Are you sure you want to ${action} ${username}?`)) return;
    await handleUpdateUser(userId, { is_admin: !currentIsAdmin });
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            <p className="text-zinc-500 animate-pulse font-medium">Loading Management Console...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        {/* Page header */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Platform Overview</h2>
            <p className="text-zinc-500 text-sm mt-1">Manage users and monitor system health</p>
          </div>
          <button 
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl hover:border-indigo-500/30 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full uppercase">
                {stats?.users?.length || 0} tiers
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              {stats?.users?.reduce((acc, u) => acc + parseInt(u.count), 0) || 0}
            </div>
            <div className="text-xs text-zinc-500">Total Users</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl hover:border-yellow-500/30 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-yellow-500/10 rounded-xl text-yellow-500">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full uppercase">
                +{parseInt(stats?.credits?.total_added) || 0} added
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              {parseInt(stats?.credits?.total_spent) || 0}
            </div>
            <div className="text-xs text-zinc-500">Credits Consumed (30d)</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl hover:border-green-500/30 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-green-500/10 rounded-xl text-green-500">
                <Activity className="w-5 h-5" />
              </div>
              {(() => {
                const totalJobs = stats?.jobs?.reduce((acc, j) => acc + parseInt(j.count), 0) || 0;
                const rate = totalJobs > 0 ? ((parseInt(stats?.jobs?.find(j => j.status === 'completed')?.count || 0) / totalJobs) * 100).toFixed(0) : 0;
                return (
                  <div className="h-1.5 w-20 bg-zinc-800 rounded-full overflow-hidden mt-2.5">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                  </div>
                );
              })()}
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              {(() => {
                const totalJobs = stats?.jobs?.reduce((acc, j) => acc + parseInt(j.count), 0) || 0;
                return totalJobs > 0
                  ? ((parseInt(stats?.jobs?.find(j => j.status === 'completed')?.count || 0) / totalJobs) * 100).toFixed(1) + '%'
                  : 'N/A';
              })()}
            </div>
            <div className="text-xs text-zinc-500">Success Rate (7d)</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl hover:border-zinc-700 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-zinc-800 rounded-xl text-zinc-400">
                <Database className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              {(parseInt(stats?.media?.total_videos) || 0) + (parseInt(stats?.media?.total_images) || 0)}
            </div>
            <div className="text-xs text-zinc-500">Total Assets</div>
          </div>
        </div>

        {/* User Management Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex flex-col md:flex-row justify-between gap-4 items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-indigo-400" />
              User Management
            </h2>
            
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text"
                placeholder="Search by username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-900 text-[11px] text-zinc-500 uppercase font-bold tracking-widest border-b border-zinc-800">
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Tier</th>
                  <th className="px-5 py-3.5">Credits</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="group hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{u.username}</div>
                          <div className="text-xs text-zinc-500 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <select 
                        value={u.tier} 
                        onChange={(e) => handleUpdateUser(u.id, { tier: e.target.value })}
                        className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-1 rounded cursor-pointer border border-transparent hover:border-zinc-700 bg-transparent appearance-none ${
                          u.tier === 'pro' ? 'text-indigo-400 bg-indigo-400/10' : 
                          u.tier === 'enterprise' ? 'text-amber-400 bg-amber-400/10' :
                          'text-zinc-400 bg-zinc-400/10'
                        }`}
                      >
                        <option value="free" className="bg-zinc-900">Free</option>
                        <option value="pro" className="bg-zinc-900">Pro</option>
                        <option value="enterprise" className="bg-zinc-900">Enterprise</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">{u.credits}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleUpdateUser(u.id, { credits: u.credits + 10 })}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-indigo-400"
                            title="Add 10 credits"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleUpdateUser(u.id, { credits: Math.max(0, u.credits - 10) })}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400"
                            title="Remove 10 credits"
                          >
                            <ArrowDownRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggleAdmin(u.id, u.is_admin, u.username)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all ${
                          u.is_admin
                            ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20'
                            : 'text-zinc-400 bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700/50'
                        }`}
                        title={u.is_admin ? 'Click to revoke admin' : 'Click to grant admin'}
                      >
                        {u.is_admin ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Admin
                          </>
                        ) : (
                          <>
                            <ShieldOff className="w-3.5 h-3.5" />
                            User
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-zinc-500">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleUpdateUser(u.id, { credits: u.credits + 100 })}
                          className="px-2 py-1 text-[10px] font-bold bg-indigo-600/10 text-indigo-400 rounded hover:bg-indigo-600/20 transition-colors"
                        >
                          +100 CR
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-5 bg-zinc-900/50 border-t border-zinc-800 flex justify-between items-center">
            <div className="text-xs text-zinc-500 font-medium">
              Showing <span className="text-zinc-300">{offset + 1}</span> to <span className="text-zinc-300">{Math.min(offset + limit, total)}</span> of <span className="text-zinc-300">{total}</span> users
            </div>
            <div className="flex gap-2">
              <button 
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="p-2 border border-zinc-800 rounded-lg disabled:opacity-30 hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="p-2 border border-zinc-800 rounded-lg disabled:opacity-30 hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
