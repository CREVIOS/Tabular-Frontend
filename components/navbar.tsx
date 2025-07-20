"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronDown, LogOut, Coins, RefreshCw, CreditCard } from "lucide-react";
import { useUserBalance } from "@/hooks/useUserBalance";

// User type compatible with auth context
interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active?: boolean;
  created_at: string;
  last_login?: string;
}

interface NavbarProps {
  user?: User | null;
  isLoading?: boolean;
  isAuthenticated?: boolean;
  onLogout?: () => Promise<void>;
  showUserInfo?: boolean;
}

export default function Navbar({ 
  user,
  isLoading = false,
  isAuthenticated = false,
  onLogout,
  showUserInfo = true,
}: NavbarProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { balance, isLoading: balanceLoading, error: balanceError, refreshBalance } = useUserBalance();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-menu-container')) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleBuyTokens = () => {
    window.open('https://makebell-supabase.onrender.com/tokens/purchase', '_blank');
    setIsUserMenuOpen(false);
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    
    if (onLogout) {
      await onLogout();
    }
  };

  const handleRefreshBalance = async () => {
    await refreshBalance();
  };

  // Extract username from email (part before @)
  const getUserName = () => {
    if (user?.full_name) {
      return user.full_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  // Get user initials for profile icon
  const getUserInitials = () => {
    if (user?.full_name) {
      return user.full_name
        .split(' ')
        .map(name => name.charAt(0))
        .join('')
        .substring(0, 2)
        .toUpperCase();
    }
    if (user?.email) {
      const username = user.email.split('@')[0];
      return username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Format balance for display
  const formatBalance = () => {
    const numBalance = parseInt(balance) || 0;
    return numBalance.toLocaleString();
  };

  // Don't show user info if not authenticated
  const shouldShowUserInfo = showUserInfo && isAuthenticated;

  return (
    <nav className="bg-white text-gray-900 border-b border-gray-200 shadow-sm">
      <div className="w-full px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3">
         
            <Image 
              src="/logo wide black transparant.svg"
              alt="Makebell Logo" 
              width={90} 
              height={24}
              className="h-6 w-auto"
            />
            <span className="text-gray-400">|</span>
            <span className="text-lg text-black font-bold">Tabular Review</span>
         
          </div>

          {/* User Info Section */}
          {shouldShowUserInfo && (
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Balance Display */}
              <div className="flex items-center space-x-1 sm:space-x-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-shadow group cursor-pointer"
                   onClick={handleRefreshBalance}
                   title="Click to refresh balance">
                <Coins className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{formatBalance()} Tokens</span>
                <span className="sm:hidden">{formatBalance()}</span>
                {balanceLoading && (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                )}
                {balanceError && (
                  <span className="text-xs text-red-600 ml-1 sm:ml-2">!</span>
                )}
              </div>

              {/* Profile Menu */}
              <div className="relative user-menu-container">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 sm:space-x-3 bg-gray-50 hover:bg-gray-100 transition-colors px-2 sm:px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  {/* Profile Icon */}
                  <div className="relative">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-md">
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                      ) : (
                        getUserInitials()
                      )}
                    </div>
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>

                  {/* User Info - Hidden on mobile */}
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium text-gray-900">
                      {isLoading ? 'Loading...' : getUserName()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {user?.email}
                    </span>
                  </div>

                  {/* Dropdown Arrow */}
                  <ChevronDown 
                    className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-600 transition-transform ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`} 
                  />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white text-gray-900 rounded-xl shadow-lg border border-gray-200 py-2 z-50 overflow-hidden">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {getUserInitials()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{getUserName()}</p>
                          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                          <p className="text-xs text-blue-600 font-medium">{formatBalance()} Tokens</p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <button 
                        onClick={handleBuyTokens}
                        className="w-full flex items-center px-4 py-3 hover:bg-green-50 transition-colors text-green-600 font-medium group"
                      >
                        <CreditCard className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                        <span>Buy Tokens</span>
                        <span className="ml-auto text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          New
                        </span>
                      </button>
                      
                      <button 
                        onClick={handleLogout}
                        disabled={isLoading}
                        className="w-full flex items-center px-4 py-3 hover:bg-red-50 transition-colors text-red-600 disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        <LogOut className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                        <span>{isLoading ? 'Signing out...' : 'Sign Out'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 