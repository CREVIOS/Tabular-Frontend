import { User, AuthTokens, ApiError } from '@/types/auth'

const API_BASE_URL = 'https://makebell-supabase.onrender.com';
const USER_KEY = 'makebell_user_data';

class AuthService {
  private static instance: AuthService;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Get access token from cookies (via API route)
  async getAccessToken(): Promise<string | null> {
    try {
      console.log('[AuthService] Calling getAccessToken...');
      
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : (process.env.NODE_ENV === 'production' 
            ? process.env.NEXT_PUBLIC_BASE_URL
            : 'http://localhost:3000/');
      
      const url = `${baseUrl}/api/auth/token`;
      
      console.log('[AuthService] About to fetch from:', url);
  
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });
  
      console.log('[AuthService] Response status:', response.status);
      console.log('[AuthService] Response ok:', response.ok);
  
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          console.log('[AuthService] Response data:', data);
          return data.accessToken || null;
        } else {
          const text = await response.text();
          console.error('[AuthService] Expected JSON, got:', text);
          return null;
        }
      } else {
        const errorText = await response.text();
        console.error('[AuthService] Server returned error:', response.status);
        console.error('[AuthService] Response body:', errorText);
        return null;
      }
    } catch (error) {
      console.error('[AuthService] Failed to get access token:', error);
      return null;
    }
  }
  

  // Get user context from server (set by middleware)
  async getUserContext(): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/user-context', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        return data.user || null;
      }
    } catch (error) {
      console.error('Failed to get user context:', error);
    }
    return null;
  }

  // Legacy localStorage methods (kept for compatibility)
  saveUser(user: User): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  }

  getUser(): User | null {
    try {
      if (typeof window !== 'undefined') {
        const user = localStorage.getItem(USER_KEY);
        return user ? JSON.parse(user) : null;
      }
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
    return null;
  }

  clearUser(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USER_KEY);
      }
    } catch (error) {
      console.error('Failed to clear user:', error);
    }
  }

  // Check if user is authenticated (by checking for cookies)
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  // Fetch user data using the provided API endpoint
  async fetchUser(accessToken: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/auth/user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = {
        message: `Failed to fetch user data: ${response.statusText}`,
        status: response.status,
      };
      
      if (response.status === 401) {
        error.code = 'UNAUTHORIZED';
        error.message = 'Invalid or expired access token';
      } else if (response.status >= 500) {
        error.code = 'SERVER_ERROR';
        error.message = 'Server error occurred. Please try again later.';
      }
      
      throw error;
    }

    const user = await response.json();
    this.saveUser(user); // Cache in localStorage
    return user;
  }

  // Get user information using access token (for API endpoints)
  async getUserInfo(accessToken: string): Promise<User | null> {
    try {
      // Validate token format
      if (!this.validateTokenFormat(accessToken)) {
        return null;
      }

      // Fetch user data from external auth service
      const user = await this.fetchUser(accessToken);
      return user;
    } catch (error) {
      console.error('Failed to get user info:', error);
      return null;
    }
  }

  // Logout by calling the logout API route
  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Clear local storage
      this.clearUser();
      // Redirect to external auth service logout
      window.location.href = 'https://makebell-supabase.onrender.com/auth/logout';
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout API fails, redirect to external auth service
      window.location.href = 'https://makebell-supabase.onrender.com/auth/logout';
    }
  }

  // Utility methods
  extractUsernameFromEmail(email: string): string {
    return email.split('@')[0] || 'User';
  }

  validateTokenFormat(token: string): boolean {
    // Basic JWT format validation
    return typeof token === 'string' && token.split('.').length === 3;
  }

  // Token management is now handled by middleware/cookies
  // These methods are kept for compatibility but delegate to cookie-based system
  async getTokens(): Promise<AuthTokens | null> {
    const accessToken = await this.getAccessToken();
    return accessToken ? { accessToken } : null;
  }

  saveTokens(tokens: AuthTokens): void {
    // Tokens are managed by cookies/middleware, this is a no-op
    console.log('Tokens are managed by server-side cookies');
  }

  clearTokens(): void {
    // Tokens are managed by cookies/middleware, clear local data
    this.clearUser();
  }

  isTokenExpired(tokens: AuthTokens): boolean {
    if (!tokens.expiresAt) return false;
    return Date.now() >= tokens.expiresAt;
  }

  // Cross-tab synchronization (less relevant with httpOnly cookies)
  onStorageChange(callback: (tokens: AuthTokens | null) => void): () => void {
    // Since tokens are in httpOnly cookies, we can't listen to storage changes
    // Return a no-op cleanup function
    return () => {};
  }
}

export default AuthService.getInstance(); 