import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

export default function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, cancel
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  
  const sessionId = searchParams.get('session_id');
  const isSuccess = window.location.pathname.includes('/success');

  useEffect(() => {
    if (isSuccess && sessionId) {
      setStatus('success');
      // Refresh user credits after a short delay to allow webhook to process
      const timer = setTimeout(() => {
        refreshUser();
      }, 3000);
      return () => clearTimeout(timer);
    } else if (!isSuccess) {
      setStatus('cancel');
    } else {
      // Success path but no session ID?
      setStatus('cancel');
    }
  }, [isSuccess, sessionId, refreshUser]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="glass-card max-w-md w-full p-10 rounded-3xl shadow-2xl text-center space-y-8 animate-in-fade">
        {status === 'loading' ? (
          <>
            <div className="flex justify-center">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight italic">Verifying Payment</h2>
              <p className="text-muted-foreground text-sm font-medium">Please wait while we confirm your transaction...</p>
            </div>
          </>
        ) : status === 'success' ? (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tight italic">Payment <span className="text-emerald-500">Successful</span></h2>
              <p className="text-muted-foreground text-sm font-medium">Your credits have been added to your account. It may take a few seconds to reflect in your dashboard.</p>
            </div>
            <div className="pt-4 space-y-4">
              <Button 
                onClick={() => navigate('/')}
                className="w-full py-6 rounded-2xl font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              >
                Go to Dashboard
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tight italic">Payment <span className="text-destructive">Canceled</span></h2>
              <p className="text-muted-foreground text-sm font-medium">No charges were made. If this was a mistake, you can try again from the billing page.</p>
            </div>
            <div className="pt-4">
              <Button 
                onClick={() => navigate('/billing')}
                variant="outline"
                className="w-full py-6 rounded-2xl font-black uppercase tracking-widest border-2"
              >
                Back to Billing
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
