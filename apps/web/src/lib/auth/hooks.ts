import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { authManager } from './auth-manager';
import { UserRole, Permission } from './types';

/**
 * Hook for managing authentication state and operations
 */
export function useAuthState() {
  const auth = useAuth();
  const [authStatus, setAuthStatus] = useState(() => authManager.getAuthStatus());

  // Update auth status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAuthStatus(authManager.getAuthStatus());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    ...auth,
    ...authStatus
  };
}

/**
 * Hook for token management and refresh
 */
export function useTokenManager() {
  const { refreshToken, isTokenExpired, getTimeUntilExpiry } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      setRefreshError(null);
      await refreshToken();
    } catch (error: any) {
      setRefreshError(error.message || 'Token refresh failed');
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshToken, isRefreshing]);

  const forceRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setRefreshError(null);
      await authManager.forceRefresh();
    } catch (error: any) {
      setRefreshError(error.message || 'Token refresh failed');
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return {
    isRefreshing,
    refreshError,
    isTokenExpired: isTokenExpired(),
    timeUntilExpiry: getTimeUntilExpiry(),
    refreshToken: handleRefresh,
    forceRefresh,
    clearRefreshError: () => setRefreshError(null)
  };
}

/**
 * Hook for role-based access control
 */
export function useRoleAccess(requiredRoles: UserRole[] = []) {
  const { user, hasRole } = useAuth();

  const hasAccess = useCallback(() => {
    if (!user) return false;
    if (requiredRoles.length === 0) return true;
    
    return requiredRoles.some(role => hasRole(role));
  }, [user, hasRole, requiredRoles]);

  const checkRole = useCallback((role: UserRole) => {
    return hasRole(role);
  }, [hasRole]);

  return {
    hasAccess: hasAccess(),
    checkRole,
    userRole: user?.role || null
  };
}

/**
 * Hook for permission-based access control
 */
export function usePermissionAccess(requiredPermissions: Permission[] = []) {
  const { user, checkPermission } = useAuth();

  const hasAccess = useCallback(() => {
    if (!user) return false;
    if (requiredPermissions.length === 0) return true;
    
    return requiredPermissions.every(permission => checkPermission(permission));
  }, [user, checkPermission, requiredPermissions]);

  const hasAnyPermission = useCallback((permissions: Permission[]) => {
    if (!user) return false;
    return permissions.some(permission => checkPermission(permission));
  }, [user, checkPermission]);

  const hasAllPermissions = useCallback((permissions: Permission[]) => {
    if (!user) return false;
    return permissions.every(permission => checkPermission(permission));
  }, [user, checkPermission]);

  return {
    hasAccess: hasAccess(),
    hasAnyPermission,
    hasAllPermissions,
    checkPermission,
    userPermissions: user?.permissions || []
  };
}

/**
 * Hook for session management
 */
export function useSession() {
  const { user, logout, lastActivity } = useAuth();
  const [sessionWarning, setSessionWarning] = useState(false);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState(0);

  // Update session info
  useEffect(() => {
    const updateSessionInfo = () => {
      const timeLeft = authManager.getTimeUntilExpiry();
      setTimeUntilExpiry(timeLeft);
      
      // Show warning 5 minutes before expiry
      const warningThreshold = 5 * 60 * 1000; // 5 minutes
      setSessionWarning(timeLeft > 0 && timeLeft <= warningThreshold);
    };

    updateSessionInfo();
    const interval = setInterval(updateSessionInfo, 1000);

    return () => clearInterval(interval);
  }, [user]);

  const extendSession = useCallback(async () => {
    try {
      await authManager.forceRefresh();
      setSessionWarning(false);
    } catch (error) {
      console.error('Failed to extend session:', error);
      throw error;
    }
  }, []);

  const endSession = useCallback(async () => {
    await logout();
  }, [logout]);

  return {
    isActive: !!user,
    sessionWarning,
    timeUntilExpiry,
    lastActivity,
    extendSession,
    endSession
  };
}

/**
 * Hook for authentication form management
 */
export function useAuthForm() {
  const { login, register, isLoading, error, clearError } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const handleLogin = useCallback(async (credentials: any) => {
    try {
      setFormError(null);
      clearError();
      await login(credentials);
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      setFormError(errorMessage);
      throw error;
    }
  }, [login, clearError]);

  const handleRegister = useCallback(async (data: any) => {
    try {
      setFormError(null);
      clearError();
      await register(data);
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
      setFormError(errorMessage);
      throw error;
    }
  }, [register, clearError]);

  const clearFormError = useCallback(() => {
    setFormError(null);
    clearError();
  }, [clearError]);

  return {
    handleLogin,
    handleRegister,
    isLoading,
    error: formError || error,
    clearError: clearFormError
  };
}

/**
 * Hook for user profile management
 */
export function useUserProfile() {
  const { user, updateUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const updateProfile = useCallback(async (updates: any) => {
    try {
      setIsUpdating(true);
      setUpdateError(null);
      
      // Call API to update profile
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updatedUser = await response.json();
      updateUser(updatedUser);
    } catch (error: any) {
      setUpdateError(error.message || 'Failed to update profile');
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [updateUser]);

  const clearUpdateError = useCallback(() => {
    setUpdateError(null);
  }, []);

  return {
    user,
    updateProfile,
    isUpdating,
    updateError,
    clearUpdateError
  };
}

/**
 * Hook for authentication status monitoring
 */
export function useAuthMonitor() {
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [authHealth, setAuthHealth] = useState<'healthy' | 'warning' | 'error'>('healthy');

  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const checkAuthHealth = async () => {
      const status = await authManager.getAuthStatus();
      
      if (!status.isAuthenticated) {
        setAuthHealth('error');
      } else if (status.isTokenExpired || status.timeUntilExpiry < 5 * 60 * 1000) {
        setAuthHealth('warning');
      } else {
        setAuthHealth('healthy');
      }
    };

    checkAuthHealth();
    const interval = setInterval(checkAuthHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    connectionStatus,
    authHealth,
    isOnline: connectionStatus === 'online',
    isHealthy: authHealth === 'healthy'
  };
}