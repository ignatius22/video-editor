import React, { useState, useEffect } from 'react';
import ConvertixLogo from '@/components/ConvertixLogo';
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
  Badge,
} from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';

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
            <ConvertixLogo size={48} animated />
            <p className="text-muted-foreground animate-pulse font-medium text-sm">Loading Management Console...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-12 animate-in-fade">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl uppercase">
              Platform <span className="text-primary italic">Intelligence</span>
            </h1>
            <p className="text-base text-muted-foreground font-medium">Global command center for user oversight and infrastructure health monitoring.</p>
          </div>
          <Button 
            variant="outline"
            size="sm"
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="rounded-xl border-border/50 hover:bg-muted font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-sm shadow-primary/5"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            Sync Data
          </Button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-6 rounded-2xl shadow-xl transition-all hover:shadow-primary/5 border-primary/5 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted/50">
                {stats?.users?.length || 0} Tiers
              </Badge>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tighter mb-1">
              {stats?.users?.reduce((acc, u) => acc + parseInt(u.count), 0) || 0}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Global Userbase</div>
          </div>

          <div className="glass-card p-6 rounded-2xl shadow-xl transition-all hover:shadow-yellow-500/5 border-yellow-500/5 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-500 group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5 fill-yellow-500" />
              </div>
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-green-500/20 text-green-500 bg-green-500/5">
                +{parseInt(stats?.credits?.total_added) || 0} Inflow
              </Badge>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tighter mb-1">
              {parseInt(stats?.credits?.total_spent) || 0}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Units Dispatched (30d)</div>
          </div>

          <div className="glass-card p-6 rounded-2xl shadow-xl transition-all hover:shadow-emerald-500/5 border-emerald-500/5 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
              <div className="mt-2.5">
                {(() => {
                  const totalJobs = stats?.jobs?.reduce((acc, j) => acc + parseInt(j.count), 0) || 0;
                  const rate = totalJobs > 0 ? ((parseInt(stats?.jobs?.find(j => j.status === 'completed')?.count || 0) / totalJobs) * 100).toFixed(0) : 0;
                  return (
                    <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-1000" style={{ width: `${rate}%` }} />
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tighter mb-1">
              {(() => {
                const totalJobs = stats?.jobs?.reduce((acc, j) => acc + parseInt(j.count), 0) || 0;
                return totalJobs > 0
                  ? ((parseInt(stats?.jobs?.find(j => j.status === 'completed')?.count || 0) / totalJobs) * 100).toFixed(1) + '%'
                  : 'N/A';
              })()}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Infrastructure Integrity</div>
          </div>

          <div className="glass-card p-6 rounded-2xl shadow-xl transition-all border-border/5 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-muted rounded-xl text-muted-foreground group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tighter mb-1">
              {(parseInt(stats?.media?.total_videos) || 0) + (parseInt(stats?.media?.total_images) || 0)}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Total Indexed Assets</div>
          </div>
        </div>

        {/* User Management Section */}
        <div className="glass-card rounded-3xl shadow-3xl overflow-hidden border-none transition-all">
          <div className="p-8 border-b border-border/50 flex flex-col xl:flex-row justify-between gap-6 items-center bg-muted/20">
            <h2 className="text-xl font-bold flex items-center gap-3 text-foreground tracking-tight">
              <Users className="w-5 h-5 text-primary" />
              Directorate Registry
            </h2>
            
            <div className="relative w-full xl:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text"
                placeholder="Search by identity or email matrix..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-2xl pl-12 pr-6 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-[10px] text-muted-foreground uppercase font-black tracking-widest border-b border-border/30">
                  <th className="px-8 py-5">Entity Identity</th>
                  <th className="px-8 py-5">Sub. Tier</th>
                  <th className="px-8 py-5">Operation Balance</th>
                  <th className="px-8 py-5">Security Protocol</th>
                  <th className="px-8 py-5">Incorporation Date</th>
                  <th className="px-8 py-5 text-right">Admin Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="group hover:bg-primary/5 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-black shadow-lg shadow-primary/20 flex-shrink-0 group-hover:scale-110 transition-transform">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{u.username}</div>
                          <div className="text-[11px] font-medium text-muted-foreground truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <select 
                        value={u.tier} 
                        onChange={(e) => handleUpdateUser(u.id, { tier: e.target.value })}
                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg cursor-pointer border border-transparent shadow-sm hover:border-primary/30 bg-muted/50 appearance-none focus:ring-2 focus:ring-primary/20 transition-all ${
                          u.tier === 'pro' ? 'text-primary' : 
                          u.tier === 'enterprise' ? 'text-amber-500' :
                          'text-muted-foreground'
                        }`}
                      >
                        <option value="free" className="bg-background">Standard</option>
                        <option value="pro" className="bg-background text-primary font-bold">Pro Studio</option>
                        <option value="enterprise" className="bg-background text-amber-500 font-bold">Enterprise</option>
                      </select>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3 font-black text-foreground tracking-tighter text-base">
                        <span>{u.credits}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleUpdateUser(u.id, { credits: u.credits + 10 })}
                            className="w-7 h-7 rounded-md hover:bg-emerald-500/10 hover:text-emerald-500 text-muted-foreground"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleUpdateUser(u.id, { credits: Math.max(0, u.credits - 10) })}
                            className="w-7 h-7 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                          >
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <button
                        onClick={() => handleToggleAdmin(u.id, u.is_admin, u.username)}
                        className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-all shadow-sm ${
                          u.is_admin
                            ? 'text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:shadow-primary/5'
                            : 'text-muted-foreground bg-muted border border-border hover:bg-muted/80 hover:border-primary/20'
                        }`}
                      >
                        {u.is_admin ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Privileged
                          </>
                        ) : (
                          <>
                            <ShieldOff className="w-3.5 h-3.5" />
                            Restricted
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-8 py-6 text-[11px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUpdateUser(u.id, { credits: u.credits + 100 })}
                          className="h-8 text-[9px] font-black uppercase tracking-widest px-3 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all shadow-sm border-none bg-muted"
                        >
                          Injection +100
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-8 bg-muted/10 border-t border-border/30 flex justify-between items-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              Identity Segment <span className="text-foreground">{offset + 1}</span> — <span className="text-foreground">{Math.min(offset + limit, total)}</span> of <span className="text-primary">{total}</span>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                size="icon"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="h-10 w-10 border-border/50 rounded-xl hover:bg-muted font-bold transition-all shadow-sm disabled:opacity-30"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </Button>
              <Button 
                variant="outline"
                size="icon"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="h-10 w-10 border-border/50 rounded-xl hover:bg-muted font-bold transition-all shadow-sm disabled:opacity-30"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
