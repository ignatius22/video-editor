import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/api/client';
import { 
  CreditCard, 
  History, 
  Zap, 
  CheckCircle2, 
  Plus, 
  TrendingUp, 
  AlertCircle,
  ChevronLeft,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function BillingPage() {
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [buying, setBuying] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchTransactions(true);
  }, []);

  const fetchTransactions = async (initial = false) => {
    try {
      if (initial) setLoading(true);
      else setIsRefreshing(true);
      
      const data = await api.getTransactions();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleBuyCredits = async (amount) => {
    try {
      setBuying(true);
      const { url } = await api.createPaymentSession(amount);
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      toast.error('Failed to initiate purchase');
      console.error(error);
    } finally {
      setBuying(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      const { url } = await api.createUpgradeSession();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      toast.error('Failed to initiate upgrade');
      console.error(error);
    } finally {
      setUpgrading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pricingPlans = [
    { title: 'Starter', credits: 10, price: 'FREE', description: 'Perfect for trying out the platform' },
    { title: 'Basic', credits: 50, price: '$5', description: 'For occasional media processing' },
    { title: 'Pro Pack', credits: 200, price: '$15', description: 'Best value for regular creators' },
  ];

  return (
    <div className="mx-auto py-12 px-4 max-w-6xl space-y-12 animate-in-fade">
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-all group px-4 py-2 hover:bg-primary/10 rounded-xl w-fit"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="uppercase tracking-widest text-[11px]">Dashboard</span>
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl uppercase">
            Billing <span className="text-primary italic">&</span> Credits
          </h1>
          <p className="text-base text-muted-foreground font-medium">Manage your subscription, purchase processing power, and view usage history.</p>
        </div>
        
        <div className="flex items-center gap-6 glass p-6 rounded-2xl shadow-xl shadow-primary/5 border-primary/10">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Available Credits</span>
            <span className="text-3xl font-black flex items-center gap-2 text-foreground tracking-tighter">
              <Zap className="w-6 h-6 text-primary fill-primary" />
              {user?.credits || 0}
            </span>
          </div>
          <div className="h-12 w-px bg-border/50 mx-2" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Current Tier</span>
            <span className={`text-[11px] font-black px-3 py-1 rounded-lg tracking-widest shadow-sm ${
              user?.tier === 'pro' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground border border-border'
            }`}>
              {user?.tier?.toUpperCase() || 'FREE'}
            </span>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${user?.tier === 'pro' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-10 items-start`}>
        {/* Main Content Area */}
        <div className={`${user?.tier === 'pro' ? 'lg:col-span-2' : 'lg:col-span-2'} space-y-10`}>
          <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-border/50 bg-muted/30">
              <h2 className="text-xl font-bold flex items-center gap-3 tracking-tight">
                <Plus className="w-5 h-5 text-primary" />
                Purchase Power
              </h2>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[20, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    disabled={buying}
                    onClick={() => handleBuyCredits(amount)}
                    className="flex flex-col items-center p-8 glass border border-border/50 rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all group shadow-sm hover:shadow-primary/10"
                  >
                    <span className="text-4xl font-black mb-1 group-hover:scale-110 transition-transform tracking-tighter">
                      {amount}
                    </span>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-6">Credits</span>
                    <span className="w-full py-2.5 bg-muted rounded-xl text-[11px] font-black uppercase tracking-widest group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      ${amount / 10} USD
                    </span>
                  </button>
                ))}
              </div>
              
              <div className="mt-8 flex items-start gap-3 p-5 bg-primary/5 border border-primary/10 rounded-2xl text-[13px] text-muted-foreground font-medium leading-relaxed">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-primary" />
                <p>Credits grant processing power across the platform. Every operation costs 1 credit. High-resolution exports or advanced AI models may require additional processing units.</p>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-border/50 flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold flex items-center gap-3 tracking-tight">
                <History className="w-5 h-5 text-muted-foreground" />
                Usage History
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => fetchTransactions(false)}
                disabled={loading || isRefreshing}
                className="text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary rounded-xl"
              >
                {isRefreshing ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                Refresh
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto relative transition-all custom-scrollbar">
              {loading && transactions.length === 0 ? (
                <div className="p-20 flex flex-col items-center justify-center gap-6 text-muted-foreground">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[11px] font-black uppercase tracking-widest animate-pulse">Scanning Ledger...</p>
                </div>
              ) : transactions.length > 0 ? (
                <div className={isRefreshing ? 'opacity-40 transition-opacity duration-300' : 'opacity-100 transition-opacity duration-300'}>
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
                      <tr className="text-[10px] text-muted-foreground border-b border-border/50 uppercase font-black tracking-widest">
                        <th className="px-8 py-5">Date</th>
                        <th className="px-8 py-5">Activity</th>
                        <th className="px-8 py-5">Type</th>
                        <th className="px-8 py-5 text-right">Units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {transactions.map((tx) => (
                      <tr key={tx.id} className="text-sm hover:bg-primary/5 transition-colors group">
                        <td className="px-8 py-5 text-[12px] text-muted-foreground font-medium group-hover:text-foreground">
                          {formatDate(tx.created_at)}
                        </td>
                        <td className="px-8 py-5 font-bold text-foreground">
                          {tx.description}
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-black tracking-widest ${
                            tx.type === 'addition' 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : 'bg-destructive/10 text-destructive'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`px-8 py-5 text-right font-black tracking-tighter text-base ${
                          tx.type === 'addition' ? 'text-emerald-500' : 'text-foreground'
                        }`}>
                          {tx.type === 'addition' ? '+' : ''}{tx.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
                <div className="p-20 text-center text-muted-foreground flex flex-col items-center justify-center gap-4">
                  <TrendingUp className="w-16 h-16 opacity-10" />
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-40">No records found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upgrade Card - Only show for non-Pro users */}
        {user?.tier !== 'pro' && (
          <div className="space-y-6">
          <div className={`glass-card border-none rounded-3xl overflow-hidden shadow-3xl shadow-primary/10 flex flex-col sticky top-28 transition-all hover:shadow-primary/20`}>
            {user?.tier === 'pro' && (
              <div className="bg-primary px-4 py-1.5 text-center text-[10px] font-black uppercase tracking-widest text-primary-foreground italic">
                Active Tier
              </div>
            )}
            <div className={`p-10 pb-6 bg-gradient-to-br from-primary/10 via-transparent to-transparent ${user?.tier === 'pro' ? 'border-t-0' : ''}`}>
              <h3 className="text-3xl font-black mb-3 tracking-tighter uppercase italic">Convertix <span className="text-primary">Pro</span></h3>
              <p className="text-muted-foreground text-[13px] font-medium leading-relaxed mb-8">Access professional-grade infrastructure for serious content creators.</p>
              
              <div className="flex items-baseline gap-2 mb-10">
                <span className="text-5xl font-black tracking-tighter">$29</span>
                <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">/ billed monthly</span>
              </div>

              <div className="space-y-5 mb-10">
                {[
                  '500MB Upload Threshold',
                  'High Resolution Buffering',
                  'Priority Dispatch Queuing',
                  '50 Bonus Credits Monthly',
                  'Exclusive AI Features'
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-[13px] font-bold text-foreground/80">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-10 pt-0 mt-auto">
              <Button
                onClick={handleUpgrade}
                disabled={upgrading || user?.tier === 'pro'}
                className={`w-full py-7 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all text-[12px] ${
                  user?.tier === 'pro'
                    ? 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed border-none'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground transform hover:-translate-y-1 active:scale-95'
                }`}
              >
                {upgrading ? 'Upgrading...' : user?.tier === 'pro' ? 'Current Plan' : 'Elevate to Pro'}
              </Button>
              <p className="text-[9px] text-muted-foreground text-center mt-6 uppercase font-bold tracking-widest opacity-40 px-4">
                Full access to all tools • No-risk simulation • 100% Secure
              </p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
