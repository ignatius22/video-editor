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
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function BillingPage() {
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await api.getTransactions();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCredits = async (amount) => {
    try {
      setBuying(true);
      await api.buyCredits(amount, `Purchased ${amount} credits bundle`);
      toast.success(`Purchased ${amount} credits!`);
      await refreshUser();
      await fetchTransactions();
    } catch (error) {
      toast.error('Purchase failed');
    } finally {
      setBuying(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      await api.upgradeTier('pro');
      toast.success('Successfully upgraded to PRO!');
      await refreshUser();
      await fetchTransactions();
    } catch (error) {
      toast.error('Upgrade failed');
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
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white mb-6 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Credits</h1>
          <p className="text-muted-foreground">Manage your subscription and credits</p>
        </div>
        
        <div className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl backdrop-blur-sm">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase font-semibold">Current Balance</span>
            <span className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              {user?.credits || 0} Credits
            </span>
          </div>
          <div className="h-10 w-px bg-zinc-800 mx-2" />
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase font-semibold">Plan Tier</span>
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full mt-1 inline-block text-center ${
              user?.tier === 'pro' 
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}>
              {user?.tier?.toUpperCase() || 'FREE'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Buy Credits Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-800/50">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Purchase Credits
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[20, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    disabled={buying}
                    onClick={() => handleBuyCredits(amount)}
                    className="flex flex-col items-center p-6 border border-zinc-800 rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
                  >
                    <span className="text-2xl font-bold mb-1 group-hover:scale-110 transition-transform">
                      {amount}
                    </span>
                    <span className="text-xs text-zinc-500 mb-4">Credits</span>
                    <span className="w-full py-2 bg-zinc-800 rounded-lg text-sm font-medium group-hover:bg-indigo-600 transition-colors">
                      Buy for ${amount / 10}
                    </span>
                  </button>
                ))}
              </div>
              
              <div className="mt-6 flex items-start gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-sm text-indigo-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>Credits never expire and can be used for any video or image processing operation. 1 credit = 1 operation.</p>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-zinc-400" />
                Transaction History
              </h2>
              <button 
                type="button"
                onClick={fetchTransactions}
                disabled={loading}
                className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {loading && <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent animate-spin rounded-full" />}
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : transactions.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-zinc-800/30 text-xs text-zinc-400 border-b border-zinc-800">
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Description</th>
                      <th className="px-6 py-4 font-semibold">Type</th>
                      <th className="px-6 py-4 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="text-sm hover:bg-zinc-800/10">
                        <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                          {formatDate(tx.created_at)}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {tx.description}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            tx.type === 'addition' 
                              ? 'bg-green-500/10 text-green-400' 
                              : 'bg-red-500/10 text-red-400'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${
                          tx.type === 'addition' ? 'text-green-400' : 'text-zinc-300'
                        }`}>
                          {tx.type === 'addition' ? '+' : ''}{tx.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-zinc-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No transactions found. Your history will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upgrade Card */}
        <div className="space-y-6">
          <div className={`bg-zinc-900 border ${user?.tier === 'pro' ? 'border-indigo-500/50' : 'border-zinc-800'} rounded-2xl overflow-hidden shadow-xl flex flex-col h-full sticky top-8`}>
            {user?.tier === 'pro' && (
              <div className="bg-indigo-600 px-4 py-1 text-center text-[10px] font-bold uppercase tracking-widest">
                Current Plan
              </div>
            )}
            <div className="p-8 pb-4">
              <h3 className="text-2xl font-bold mb-2">Pro Membership</h3>
              <p className="text-zinc-400 text-sm mb-6">Unlock high-performance processing and features.</p>
              
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold">$29</span>
                <span className="text-zinc-500 text-sm">/month</span>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>500MB Video Upload Limit</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>50MB Image Upload Limit</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Priority Queueing</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>50 Bonus Monthly Credits</span>
                </div>
              </div>
            </div>

            <div className="p-8 pt-0 mt-auto">
              <button
                onClick={handleUpgrade}
                disabled={upgrading || user?.tier === 'pro'}
                className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg ${
                  user?.tier === 'pro'
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                    : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white transform hover:-translate-y-1'
                }`}
              >
                {upgrading ? 'Upgrading...' : user?.tier === 'pro' ? 'Active Subscription' : 'Upgrade to Pro'}
              </button>
              <p className="text-[10px] text-zinc-500 text-center mt-4 uppercase font-bold tracking-tighter opacity-50">
                Cancel anytime • No credit card required (Simulation)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
