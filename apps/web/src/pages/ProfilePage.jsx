import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, Mail, Shield, Calendar, LogOut, Settings, Zap, ChevronLeft } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

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
    <div className="mx-auto py-12 px-4 max-w-5xl space-y-12 animate-in-fade">
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-all group px-4 py-2 hover:bg-primary/10 rounded-xl w-fit"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="uppercase tracking-widest text-[11px]">Dashboard</span>
      </Link>

      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl uppercase">
          My <span className="text-primary italic">Profile</span>
        </h1>
        <p className="text-base text-muted-foreground font-medium">Manage your Convertix account settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* User Card */}
        <div className="lg:col-span-1">
          <div className="glass-card rounded-3xl p-10 flex flex-col items-center text-center shadow-3xl relative overflow-hidden group border-none">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
            
            <div className="w-28 h-28 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 border border-primary/20 group-hover:scale-105 transition-transform duration-700 shadow-inner">
              <User className="w-12 h-12 text-primary" />
            </div>
            
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-foreground">{user?.username}</h2>
            <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase mb-10 shadow-sm ${
              user?.tier === 'pro' 
                ? 'bg-primary text-primary-foreground italic' 
                : 'bg-muted text-muted-foreground border border-border'
            }`}>
              {user?.tier?.toUpperCase() || 'STANDARD'} MEMBER
            </div>
            
            <Button 
              onClick={handleLogout}
              variant="outline"
              className="w-full py-7 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all group/btn"
            >
              <LogOut className="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform" />
              Terminate Session
            </Button>
          </div>
        </div>

        {/* Details Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card rounded-3xl shadow-3xl overflow-hidden border-none">
            <div className="px-10 py-8 border-b border-border/50 bg-muted/30 flex items-center gap-3">
              <Settings className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-bold tracking-tight">Identity Matrix</h3>
            </div>
            
            <div className="p-10 space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1 opacity-60">Identity Name</p>
                    <p className="text-lg font-black text-foreground tracking-tight">{user?.username}</p>
                  </div>
                </div>
                <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-xl">Revise</Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                    <Mail className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1 opacity-60">Communication Protocol</p>
                    <p className="text-lg font-black text-foreground tracking-tight">{user?.email}</p>
                  </div>
                </div>
                <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-xl">Update</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-border/50">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                    <Calendar className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1 opacity-60">Incorporation</p>
                    <p className="text-sm font-bold text-foreground">{user?.created_at ? formatDate(user.created_at) : 'COMMENCING'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                    <Shield className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1 opacity-60">Security Clearance</p>
                    <p className="text-sm font-bold text-foreground uppercase tracking-widest">{user?.is_admin ? 'Administrator' : 'Standard Entity'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-10 bg-primary/5 border border-primary/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-primary/5 group">
            <div className="flex items-center gap-6">
              <div className="p-5 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-primary fill-primary" />
              </div>
              <div>
                <p className="text-xl font-black text-foreground tracking-tight mb-1 uppercase italic">Escalate Capabilities?</p>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-sm">Unlock high-performance processing and priority infrastructure access.</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/billing')}
              className="px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 whitespace-nowrap"
            >
              Elevate Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
