import React, { useState, useEffect } from 'react';
import ConvertixLogo from '@/components/ConvertixLogo';
import { 
  TrendingUp, 
  Activity, 
  Info,
  Zap,
  Clock,
  Database,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/api/client';
import AdminLayout from '@/components/AdminLayout';

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getPlatformStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load platform analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Analytics">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <ConvertixLogo size={48} animated />
          <p className="text-muted-foreground animate-pulse font-medium text-sm">Loading analytics...</p>
        </div>
      </AdminLayout>
    );
  }

  // Compute totals from real data
  const totalSpent = parseInt(stats?.credits?.total_spent) || 0;
  const totalAdded = parseInt(stats?.credits?.total_added) || 0;
  const totalUsers = stats?.users?.reduce((sum, u) => sum + parseInt(u.count), 0) || 0;
  const totalMedia = (parseInt(stats?.media?.total_videos) || 0) + (parseInt(stats?.media?.total_images) || 0);

  // Build chart data from real daily credits
  const chartData = (stats?.dailyCredits || []).map(d => ({
    label: d.label?.trim() || '',
    value: parseInt(d.spent) || 0
  }));

  // Build operation stats from real data
  const operationData = (stats?.operations || []).map(op => {
    const total = parseInt(op.total) || 0;
    const succeeded = parseInt(op.succeeded) || 0;
    const successRate = total > 0 ? ((succeeded / total) * 100).toFixed(1) : 0;
    return {
      type: op.operation || 'Unknown',
      success: parseFloat(successRate),
      total
    };
  });

  // Job stats from real data
  const completedJobs = stats?.jobs?.find(j => j.status === 'completed');
  const totalJobs = stats?.jobs?.reduce((sum, j) => sum + parseInt(j.count), 0) || 0;
  const overallSuccessRate = totalJobs > 0 
    ? ((parseInt(completedJobs?.count || 0) / totalJobs) * 100).toFixed(1) 
    : 0;

  // Simple Bar Chart Component using SVG
  const SimpleBarChart = ({ data, color = "#6366f1" }) => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
          No credit activity in the last 7 days
        </div>
      );
    }
    const max = Math.max(...data.map(d => d.value), 1);
    const height = 150;
    const width = 400;
    const barWidth = (width / Math.max(data.length, 1)) * 0.7;
    const gap = (width / Math.max(data.length, 1)) * 0.3;

    return (
      <svg width="100%" height={height + 20} viewBox={`0 0 ${width} ${height + 20}`} className="overflow-visible">
        {data.map((d, i) => {
          const barHeight = (d.value / max) * height;
          return (
            <g key={i} className="group">
              <rect
                x={i * (barWidth + gap) + gap / 2}
                y={height - barHeight}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                fill={color}
                rx="4"
                className="opacity-80 group-hover:opacity-100 transition-all duration-300"
              />
              <text
                x={i * (barWidth + gap) + gap / 2 + barWidth / 2}
                y={height + 15}
                fontSize="10"
                fill="#71717a"
                textAnchor="middle"
              >
                {d.label}
              </text>
              <text
                x={i * (barWidth + gap) + gap / 2 + barWidth / 2}
                y={height - barHeight - 5}
                fontSize="9"
                fill="#a1a1aa"
                textAnchor="middle"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <AdminLayout title="Analytics">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        {/* Page header */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Platform Analytics</h2>
            <p className="text-zinc-500 text-sm mt-1">Real-time performance data and consumption trends</p>
          </div>
          <button 
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Charts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Credit Consumption Chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    Credit Utilization (Last 7 Days)
                  </h3>
                  <p className="text-xs text-zinc-500">Credits consumed daily across all user tiers</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{totalSpent.toLocaleString()}</div>
                  <div className="text-[10px] text-zinc-400 font-bold">credits spent (30d)</div>
                </div>
              </div>
              
              <div className="h-48 mt-4 flex items-end">
                <SimpleBarChart data={chartData} />
              </div>
            </div>

            {/* Job Success Rate Breakdown */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-400" />
                    System Performance
                  </h3>
                  <p className="text-xs text-zinc-500">Operation success rates by processing type (last 30 days)</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-zinc-400">Success</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-zinc-400">Failed</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {operationData.length > 0 ? operationData.map(job => (
                  <div key={job.type} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-300 font-medium capitalize">{job.type}</span>
                      <span className="text-zinc-500">{job.success}% Success • {job.total} jobs</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500" 
                        style={{ width: `${job.success}%` }}
                      />
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-zinc-600 text-sm">
                    No job history recorded yet. Process some media to see stats here.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Analytics */}
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-5">Overview</h3>
              <div className="space-y-3.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Total Users</span>
                  <span className="text-lg font-bold text-white">{totalUsers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Credits Added (30d)</span>
                  <span className="text-lg font-bold text-green-400">+{totalAdded.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Credits Spent (30d)</span>
                  <span className="text-lg font-bold text-zinc-300">{totalSpent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Total Assets</span>
                  <span className="text-lg font-bold text-white">{totalMedia}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Overall Success (7d)</span>
                  <span className="text-lg font-bold text-white">{overallSuccessRate}%</span>
                </div>
              </div>
            </div>

            {/* User Distribution */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-5">User Distribution</h3>
              <div className="space-y-3">
                {stats?.users?.map(u => {
                  const pct = totalUsers > 0 ? ((parseInt(u.count) / totalUsers) * 100).toFixed(0) : 0;
                  return (
                    <div key={u.tier} className="bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-800">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold uppercase text-white">{u.tier}</span>
                        <span className="text-xs text-zinc-500">{u.count} users ({pct}%)</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* System Load */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Processing (7d)</span>
              </div>
              <div className="space-y-3">
                {stats?.jobs?.map(j => (
                  <div key={j.status} className="flex justify-between items-center">
                    <span className={`text-sm capitalize font-medium ${
                      j.status === 'completed' ? 'text-green-400' :
                      j.status === 'failed' ? 'text-red-400' :
                      j.status === 'active' ? 'text-amber-400' :
                      'text-zinc-400'
                    }`}>{j.status}</span>
                    <span className="text-lg font-black text-white">{j.count}</span>
                  </div>
                ))}
                {(!stats?.jobs || stats.jobs.length === 0) && (
                  <div className="text-sm text-zinc-600">No jobs processed in last 7 days</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
