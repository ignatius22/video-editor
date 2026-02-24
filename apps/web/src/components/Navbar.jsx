import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LogOut, User, Zap, CreditCard, LayoutDashboard } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-xl font-black tracking-tighter flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">SAAS EDITOR</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <Link to="/" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all duration-200">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link to="/billing" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all duration-200">
            <CreditCard className="w-4 h-4" />
            Billing
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <Link to="/billing" className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800 hover:border-yellow-500/50 transition-colors group">
            <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-bold text-zinc-200">{user.credits ?? 0}</span>
            <span className="text-[10px] text-zinc-500 font-semibold uppercase hidden sm:inline tracking-wider">Credits</span>
          </Link>
          
          {user.tier === 'pro' && (
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-[10px] font-black px-2 py-0.5 rounded italic tracking-tighter shadow-lg shadow-indigo-500/20 text-white">
              PRO
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-zinc-800 ml-2 mr-2" />

        <div className="flex items-center gap-4">
          <Link to="/profile" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700 group-hover:border-indigo-500 transition-colors">
              <User className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400" />
            </div>
            <span className="text-sm font-medium text-zinc-300 hidden sm:inline group-hover:text-white">{user.username}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
