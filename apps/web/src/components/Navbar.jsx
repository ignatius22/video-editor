import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LogOut, User, Zap, CreditCard, LayoutDashboard, ShieldCheck } from 'lucide-react';
import ConvertixLogo from '@/components/ConvertixLogo';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="glass sticky top-0 z-50 px-6 py-3 flex items-center justify-between animate-in-fade border-b">
      <div className="flex items-center gap-10">
        <Link to="/" className="flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] group">
          <ConvertixLogo size={36} />
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter text-foreground uppercase italic leading-none">
              Converti<span className="text-primary">x</span>
            </span>
            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
              Media Studio
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <Link 
            to="/" 
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
              isActive('/') 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link 
            to="/billing" 
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
              isActive('/billing') 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Billing
          </Link>
          {user.is_admin && (
            <Link 
              to="/admin" 
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                location.pathname.startsWith('/admin')
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <Link to="/billing" className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border/50 hover:border-primary/50 transition-all group shadow-sm hover:shadow-primary/5">
            <Zap className="w-4 h-4 text-primary fill-primary group-hover:scale-110 transition-transform" />
            <span className="text-sm font-bold">{user.credits ?? 0}</span>
            <span className="text-[10px] text-muted-foreground font-bold uppercase hidden sm:inline tracking-widest">credits</span>
          </Link>
          
          {user.tier === 'pro' && (
            <div className="bg-gradient-to-br from-primary to-primary/60 text-[10px] font-black px-2 py-0.5 rounded-md shadow-lg shadow-primary/20 text-primary-foreground tracking-widest">
              PRO
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-border/50 mx-2" />

        <div className="flex items-center gap-4">
          <Link to="/profile" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center border border-border group-hover:border-primary transition-all shadow-sm">
              <User className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-semibold group-hover:text-primary transition-colors leading-none">{user.username}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{user.tier} Plan</span>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
