"use client";

import React from "react";
import Image from "next/image";
import { ChevronDown, LogOut, Coins, RefreshCw, CreditCard, ArrowLeft } from "lucide-react";
import { useUserBalance } from "@/hooks/useUserBalance";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function Navbar({ 
  user,
  isLoading = false,
  isAuthenticated = false,
  onLogout,
  showUserInfo = true,
  showBackButton = false,
  onBack,
}: NavbarProps) {
  const { balance, isLoading: balanceLoading, error: balanceError, refreshBalance } = useUserBalance();

  const handleBuyTokens = () => {
    window.open('https://makebell-supabase.onrender.com/tokens/purchase', '_blank');
  };

  const handleLogout = async () => {
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
    <nav className="sticky top-0 z-50 bg-white text-gray-900 border-b border-gray-200 shadow-sm">
      <div className="w-full px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Back Button - only show if prop is provided */}
            {showBackButton && onBack && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                  title="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="text-gray-300">|</span>
              </>
            )}
         
            <Image 
              src="/logo.svg"
              alt="Makebell Logo" 
              width={90} 
              height={15}
              className="h-6 w-auto"
            />
            <span className="text-gray-400">|</span>
            <span className="text-lg text-black font-bold">Tabular Review</span>
         
          </div>

          {/* User Info Section */}
          {shouldShowUserInfo && (
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Token Balance Display */}
              <Badge 
                variant="secondary"
                className="flex items-center gap-2 px-3 py-2 h-9 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-900 hover:from-amber-100 hover:to-yellow-100 transition-all cursor-pointer shadow-sm hover:shadow-md"
                onClick={handleRefreshBalance}
                title="Click to refresh balance"
              >
                <Coins className="w-4 h-4 text-amber-600" />
                <span className="font-semibold tabular-nums">
                  {formatBalance()}
                </span>
                <span className="text-xs font-medium text-amber-700">
                  {balanceLoading ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    'Tokens'
                  )}
                </span>
                {balanceError && (
                  <span className="text-red-500 text-xs">⚠</span>
                )}
              </Badge>

              {/* Profile Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex items-center gap-2 h-9 px-2 hover:bg-muted/50 transition-colors"
                    disabled={isLoading}
                  >
                    {/* Profile Avatar */}
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-bold border-2 border-white shadow-md">
                          {isLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            getUserInitials()
                          )}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                    </div>

                    {/* User Info - Hidden on mobile */}
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium leading-none">
                        {isLoading ? 'Loading...' : getUserName()}
                      </div>
                      <div className="text-xs text-muted-foreground leading-none mt-1">
                        {user?.email && user.email.length > 20 ? `${user.email.substring(0, 20)}...` : user?.email}
                      </div>
                    </div>

                    {/* Dropdown Arrow */}
                    <ChevronDown className="w-4 h-4 text-muted-foreground/70" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent 
                  className="w-64 p-2" 
                  align="end"
                  sideOffset={4}
                >
                  {/* Clean User Info Header */}
                  <DropdownMenuLabel className="font-normal p-0 mb-2">
                    <div className="flex items-center gap-3 px-2 py-3 rounded-lg bg-muted/50">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium leading-none">{getUserName()}</p>
                        <p className="text-xs text-muted-foreground leading-none">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  {/* Menu Items */}
                  <DropdownMenuItem 
                    onClick={handleBuyTokens}
                    className="cursor-pointer p-3 rounded-md focus:bg-green-50 group"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                        <CreditCard className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-green-600">Buy Tokens</div>
                        <div className="text-xs text-muted-foreground">Purchase more tokens</div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="my-2" />
                  
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    disabled={isLoading}
                    variant="destructive"
                    className="cursor-pointer p-3 rounded-md focus:bg-red-50 group"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                        <LogOut className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-red-600">
                          {isLoading ? 'Signing out...' : 'Sign Out'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isLoading ? 'Please wait...' : 'End your session'}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 