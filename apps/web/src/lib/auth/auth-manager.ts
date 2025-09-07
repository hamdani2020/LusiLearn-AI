import {
  AuthTokens,
  AuthUser,
  AuthConfig,
  LoginCredentials,
  RegisterData,
  TokenRefreshResponse,
  AuthError,
  UserRole,
  Permission
} from './types';
import { TokenStorage } from './secure-storage';
import { apiClient } from '../api-client';

/**
 * Enhanced Authentication Manager with automatic token refresh,
 * secure storage, and comprehensive session management
 */
export class AuthManager {
  private config: AuthConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();
  private cachedUser: AuthUser | null = null;
  private cachedAccessToken: string | null = null;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      tokenStorageKey: 'lusilearn_access_token',
      refreshTokenStorageKey: 'lusilearn_refresh_token',
      userStorageKey: 'lusilearn_user_data',
      refreshThreshold: 5, // Refresh 5 minutes before expiry
      maxRetries: 3,
      sessionTimeout: 30, // 30 minutes of inactivity
      rememberMeDuration: 30, // 30 days
      secureStorage: process.env.NODE_ENV === 'production',
      ...config
    };

    this.initializeAuth();
    this.setupActivityTracking();
  }

  /**
   * Initialize authentication state from stored tokens
   */
  private async initializeAuth(): Promise<void> {
    try {
      const accessToken = await TokenStorage.getAccessToken();
      const userData = await TokenStorage.getUserData<AuthUser>();

      if (accessToken && userData) {
        // Cache the user data and token for synchronous access
        this.cachedUser = userData;
        this.cachedAccessToken = accessToken;

        // Set token in API client
        apiClient.setAuthToken(accessToken);

        // Set up refresh token callback
        apiClient.setRefreshTokenCallback(() => this.refreshToken());

        // Check if token needs refresh
        const expirationTime = TokenStorage.getTokenExpirationTime();
        if (expirationTime) {
          this.scheduleTokenRefresh(expirationTime);
        }

        // Notify listeners
        this.notifyListeners(userData);
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      await this.logout();
    }
  }

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    try {
      const response = await apiClient.post<{
        user: AuthUser;
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      }>('/api/auth/login', credentials);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }

      const { user, accessToken, refreshToken, expiresIn } = response.data;

      // Store tokens securely
      await TokenStorage.setTokens(accessToken, refreshToken, expiresIn, credentials.rememberMe);
      await TokenStorage.setUserData(user);

      // Cache the user data and token for synchronous access
      this.cachedUser = user;
      this.cachedAccessToken = accessToken;

      // Set token in API client
      apiClient.setAuthToken(accessToken);
      apiClient.setRefreshTokenCallback(() => this.refreshToken());

      // Schedule token refresh
      this.scheduleTokenRefresh(Date.now() + (expiresIn * 1000));

      // Reset session timer
      this.resetSessionTimer();

      // Notify listeners
      this.notifyListeners(user);

      return user;
    } catch (error) {
      const authError: AuthError = {
        code: 'LOGIN_FAILED',
        message: error instanceof Error ? error.message : 'Login failed',
        details: error
      };
      throw authError;
    }
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthUser> {
    try {
      const response = await apiClient.post<{
        user: AuthUser;
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      }>('/api/auth/register', data);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Registration failed');
      }

      const { user, accessToken, refreshToken, expiresIn } = response.data;

      // Store tokens securely
      await TokenStorage.setTokens(accessToken, refreshToken, expiresIn, false);
      await TokenStorage.setUserData(user);

      // Cache the user data and token for synchronous access
      this.cachedUser = user;
      this.cachedAccessToken = accessToken;

      // Set token in API client
      apiClient.setAuthToken(accessToken);
      apiClient.setRefreshTokenCallback(() => this.refreshToken());

      // Schedule token refresh
      this.scheduleTokenRefresh(Date.now() + (expiresIn * 1000));

      // Reset session timer
      this.resetSessionTimer();

      // Notify listeners
      this.notifyListeners(user);

      return user;
    } catch (error) {
      const authError: AuthError = {
        code: 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Registration failed',
        details: error
      };
      throw authError;
    }
  }

  /**
   * Logout user and clear all auth data
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate server-side session
      const refreshToken = await TokenStorage.getRefreshToken();
      if (refreshToken) {
        await apiClient.post('/api/auth/logout', { refreshToken });
      }
    } catch (error) {
      // Continue with logout even if server call fails
      console.warn('Server logout failed:', error);
    } finally {
      // Clear all auth data
      this.clearAuthData();

      // Clear cached data
      this.cachedUser = null;
      this.cachedAccessToken = null;

      // Notify listeners
      this.notifyListeners(null);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<string> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performTokenRefresh(): Promise<string> {
    try {
      const refreshToken = await TokenStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post<TokenRefreshResponse>('/api/auth/refresh', {
        refreshToken
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Token refresh failed');
      }

      const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;

      // Update stored tokens
      await TokenStorage.setTokens(
        accessToken,
        newRefreshToken || refreshToken,
        expiresIn,
        true // Assume remember me if we're refreshing
      );

      // Update cached token
      this.cachedAccessToken = accessToken;

      // Update API client token
      apiClient.setAuthToken(accessToken);

      // Schedule next refresh
      this.scheduleTokenRefresh(Date.now() + (expiresIn * 1000));

      return accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);

      // If refresh fails, logout user
      await this.logout();

      throw {
        code: 'TOKEN_REFRESH_FAILED',
        message: 'Session expired. Please log in again.',
        details: error
      } as AuthError;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expirationTime: number): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Calculate refresh time (threshold minutes before expiry)
    const refreshTime = expirationTime - (this.config.refreshThreshold * 60 * 1000);
    const delay = Math.max(0, refreshTime - Date.now());

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('Scheduled token refresh failed:', error);
      }
    }, delay);
  }

  /**
   * Setup activity tracking for session timeout
   */
  private setupActivityTracking(): void {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const resetTimer = () => this.resetSessionTimer();

    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });
  }

  /**
   * Reset session timeout timer
   */
  private resetSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(async () => {
      console.log('Session timeout - logging out user');
      await this.logout();
    }, this.config.sessionTimeout * 60 * 1000);
  }

  /**
   * Clear all authentication data
   */
  private clearAuthData(): void {
    // Clear timers
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }

    // Clear stored tokens
    TokenStorage.clearTokens();

    // Clear API client token
    apiClient.clearAuthToken();
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.cachedUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.cachedUser && this.cachedAccessToken);
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(): boolean {
    const expirationTime = TokenStorage.getTokenExpirationTime();
    if (!expirationTime) return true;

    // Consider token expired if it expires within the refresh threshold
    const threshold = this.config.refreshThreshold * 60 * 1000;
    return Date.now() >= (expirationTime - threshold);
  }

  /**
   * Get time until token expiry in milliseconds
   */
  getTimeUntilExpiry(): number {
    const expirationTime = TokenStorage.getTokenExpirationTime();
    if (!expirationTime) return 0;

    return Math.max(0, expirationTime - Date.now());
  }

  /**
   * Update user data
   */
  async updateUser(updates: Partial<AuthUser>): Promise<void> {
    if (!this.cachedUser) return;

    const updatedUser = { ...this.cachedUser, ...updates };

    // Update cache
    this.cachedUser = updatedUser;

    // Update storage
    await TokenStorage.setUserData(updatedUser);

    // Notify listeners
    this.notifyListeners(updatedUser);
  }

  /**
   * Check if user has specific permission
   */
  checkPermission(permission: Permission): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    return user.permissions.includes(permission);
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: UserRole): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    return user.role === role;
  }

  /**
   * Add auth state change listener
   */
  addAuthListener(listener: (user: AuthUser | null) => void): () => void {
    this.listeners.add(listener);

    // Return cleanup function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(user: AuthUser | null): void {
    this.listeners.forEach(listener => {
      try {
        listener(user);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  /**
   * Force token refresh (for testing or manual refresh)
   */
  async forceRefresh(): Promise<void> {
    await this.refreshToken();
  }

  /**
   * Get authentication status info
   */
  async getAuthStatus() {
    const user = this.cachedUser;
    const isAuthenticated = this.isAuthenticated();
    const isTokenExpired = this.isTokenExpired();
    const timeUntilExpiry = this.getTimeUntilExpiry();
    const hasRefreshToken = !!(await TokenStorage.getRefreshToken());

    return {
      user,
      isAuthenticated,
      isTokenExpired,
      timeUntilExpiry,
      hasRefreshToken,
      isRefreshing: this.isRefreshing
    };
  }
}

// Create singleton instance
export const authManager = new AuthManager();