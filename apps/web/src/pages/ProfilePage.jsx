import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, Mail, Shield, Calendar, LogOut, Settings, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Account Profile</h1>
        <p className="text-zinc-500">Manage your personal information and security settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* User Card */}
        <div className="md:col-span-1">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
            
            <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border-2 border-indigo-500/20 group-hover:scale-105 transition-transform duration-500">
              <User className="w-10 h-10 text-indigo-400" />
            </div>
            
            <h2 className="text-2xl font-bold mb-1">{user?.username}</h2>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-6 ${
              user?.tier === 'pro' 
                ? 'bg-indigo-500 text-white' 
                : 'bg-zinc-800 text-zinc-500'
            }`}>
              {user?.tier || 'Free'}
            </div>
            
            <button 
              onClick={handleLogout}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl flex items-center justify-center gap-2 transition-colors border border-zinc-700"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Details Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-800 bg-zinc-800/20 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold">Account Details</h3>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-800 rounded-lg">
                    <User className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Username</p>
                    <p className="font-medium text-zinc-200">{user?.username}</p>
                  </div>
                </div>
                <button className="text-xs text-indigo-400 hover:underline font-bold">Edit</button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-800 rounded-lg">
                    <Mail className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Email Address</p>
                    <p className="font-medium text-zinc-200">{user?.email}</p>
                  </div>
                </div>
                <button className="text-xs text-indigo-400 hover:underline font-bold">Change</button>
              </div>

              <div className="flex items-center gap-4 border-t border-zinc-800 pt-8">
                <div className="p-3 bg-zinc-800 rounded-lg">
                  <Calendar className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Member Since</p>
                  <p className="font-medium text-zinc-200">{user?.created_at ? formatDate(user.created_at) : 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-800 rounded-lg">
                  <Shield className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Role</p>
                  <p className="font-medium text-zinc-200">{user?.is_admin ? 'Administrator' : 'User'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Zap className="w-6 h-6 text-indigo-400" />
              <div>
                <p className="font-bold text-indigo-200 tracking-tight">Need more power?</p>
                <p className="text-xs text-indigo-300 opacity-70">Upgrade to Pro for higher limits and priority support.</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/billing')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors"
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
