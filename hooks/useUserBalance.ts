import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface BalanceCache {
  balance: string;
  timestamp: number;
}

export function useUserBalance() {
  const supabase = createClient();
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authenticated = !!session?.user;
      setIsAuthenticated(authenticated);
      return authenticated;
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      return false;
    }
  }, [supabase.auth]);

  const fetchBalance = useCallback(async (forceRefresh = false) => {
    // Check if user is authenticated first
    const authenticated = await checkAuth();
    if (!authenticated) {
      setBalance('0');
      setError(null);
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const now = Date.now();
      if (now - lastFetch < CACHE_DURATION) {
        return; // Use cached data
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use our internal API route instead of calling external API directly
      const response = await fetch('/api/tokens/balance', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch balance');
      }
      
      const newBalance = data.token_balance?.toString() || '0';
      console.log('🚀 NEW BALANCE:', newBalance);
      setBalance(newBalance);
      setLastFetch(Date.now());
      
      // Cache in localStorage
      const cacheData: BalanceCache = {
        balance: newBalance,
        timestamp: Date.now(),
      };
      localStorage.setItem('user_balance_cache', JSON.stringify(cacheData));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance';
      setError(errorMessage);
      console.error('Balance fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [checkAuth, lastFetch]);

  // Load cached balance on mount and set up auth listener
  useEffect(() => {
    const initializeBalance = async () => {
      const authenticated = await checkAuth();
      
      if (!authenticated) {
        setBalance('0');
        setError(null);
        return;
      }

      try {
        const cached = localStorage.getItem('user_balance_cache');
        if (cached) {
          const cacheData: BalanceCache = JSON.parse(cached);
          const now = Date.now();
          
          if (now - cacheData.timestamp < CACHE_DURATION) {
            setBalance(cacheData.balance);
            setLastFetch(cacheData.timestamp);
            return; // Use cached data, don't fetch
          }
        }
      } catch (error) {
        console.error('Failed to load cached balance:', error);
      }

      // No valid cache, fetch fresh data
      fetchBalance();
    };

    initializeBalance();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const authenticated = !!session?.user;
        setIsAuthenticated(authenticated);
        
        if (event === 'SIGNED_OUT' || !authenticated) {
          setBalance('0');
          setError(null);
          localStorage.removeItem('user_balance_cache');
        } else if (event === 'SIGNED_IN' && authenticated) {
          // Fetch balance when user signs in
          fetchBalance(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth, checkAuth, fetchBalance]);

  const refreshBalance = useCallback(async () => {
    if (isAuthenticated) {
      await fetchBalance(true);
    }
  }, [fetchBalance, isAuthenticated]);

  return {
    balance,
    isLoading,
    error,
    refreshBalance,
  };
} 