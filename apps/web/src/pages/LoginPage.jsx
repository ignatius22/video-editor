import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ConvertixLogo from '@/components/ConvertixLogo';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      console.log('Attempting login for:', username);
      const res = await login(username, password);
      console.log('Login successful:', res);
      navigate('/');
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 animate-in-fade">
      <div className="w-full max-w-[420px] space-y-10">
        {/* Brand/Logo Area */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="animate-in-slide-up">
            <ConvertixLogo size={64} />
          </div>
          <div className="space-y-1 animate-in-slide-up" style={{ animationDelay: '100ms' }}>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground uppercase italic leading-none">
              Converti<span className="text-primary">x</span>
            </h1>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
              Media Processing Studio
            </p>
          </div>
        </div>

        <Card className="glass-card border-none shadow-3xl animate-in-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="space-y-2 p-8 pb-4">
            <CardTitle className="text-2xl font-black tracking-tight uppercase">Sign In</CardTitle>
            <CardDescription className="text-[13px] font-medium text-muted-foreground">Enter your credentials to access your Convertix workspace.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-[12px] font-bold text-destructive uppercase tracking-widest animate-in-fade">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Username"
                  className="rounded-xl bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 h-12 px-4 font-medium"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" aria-label="Password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="rounded-xl bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 h-12 px-4 font-medium tracking-widest"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] bg-primary hover:bg-primary/90" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            
            <div className="mt-8 text-center">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">New recruit? </span>
              <Link to="/register" className="text-[11px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors border-b-2 border-primary/20 hover:border-primary">
                Initialize Account
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
