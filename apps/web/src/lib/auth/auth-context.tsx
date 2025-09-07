'use client';

import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { 
  AuthState, 
  AuthContextValue, 
  AuthUser, 
  LoginCredentials, 
  RegisterData, 
  UserRole, 
  Permission 
} from './types';
import { authManager } from './auth-manager';

// Auth state reducer
type AuthAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: AuthUser | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_ACTIVITY' };

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  lastActivity: Date.now()
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    case 'UPDATE_ACTIVITY':
      return { ...state, lastActivity: Date.now() };
    
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext<AuthContextValue | null>(null);

// Auth provider component
interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        const currentUser = authManager.getCurrentUser();
        const isAuthenticated = authManager.isAuthenticated();
        
        if (isAuthenticated && currentUser) {
          dispatch({ type: 'SET_USER', payload: currentUser });
        } else {
          dispatch({ type: 'SET_USER', payload: null });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize authentication' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = authManager.addAuthListener((user) => {
      dispatch({ type: 'SET_USER', payload: user });
    });

    return unsubscribe;
  }, []);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const user = await authManager.login(credentials);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Register function
  const register = useCallback(async (data: RegisterData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const user = await authManager.register(data);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await authManager.logout();
      dispatch({ type: 'SET_USER', payload: null });
    } catch (error: any) {
      console.error('Logout error:', error);
      // Still clear user state even if server logout fails
      dispatch({ type: 'SET_USER', payload: null });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async (): Promise<string> => {
    try {
      return await authManager.refreshToken();
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Token refresh failed' });
      throw error;
    }
  }, []);

  // Update user function
  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    authManager.updateUser(updates);
    // The auth listener will handle the state update
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Permission check function
  const checkPermission = useCallback((permission: Permission): boolean => {
    return authManager.checkPermission(permission);
  }, []);

  // Role check function
  const hasRole = useCallback((role: UserRole): boolean => {
    return authManager.hasRole(role);
  }, []);

  // Token expiry check
  const isTokenExpired = useCallback((): boolean => {
    return authManager.isTokenExpired();
  }, []);

  // Get time until expiry
  const getTimeUntilExpiry = useCallback((): number => {
    return authManager.getTimeUntilExpiry();
  }, []);

  // Activity tracking
  useEffect(() => {
    const handleActivity = () => {
      dispatch({ type: 'UPDATE_ACTIVITY' });
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, []);

  const contextValue: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
    clearError,
    checkPermission,
    hasRole,
    isTokenExpired,
    getTimeUntilExpiry
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
interface WithAuthProps {
  requiredRole?: UserRole;
  requiredPermissions?: Permission[];
  fallback?: React.ComponentType;
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthProps = {}
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, hasRole, checkPermission } = useAuth();
    const { requiredRole, requiredPermissions = [], fallback: Fallback } = options;

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      if (Fallback) {
        return <Fallback />;
      }
      return <div>Please log in to access this page.</div>;
    }

    // Check role requirement
    if (requiredRole && !hasRole(requiredRole)) {
      if (Fallback) {
        return <Fallback />;
      }
      return <div>You don't have permission to access this page.</div>;
    }

    // Check permission requirements
    const hasAllPermissions = requiredPermissions.every(permission => 
      checkPermission(permission)
    );

    if (requiredPermissions.length > 0 && !hasAllPermissions) {
      if (Fallback) {
        return <Fallback />;
      }
      return <div>You don't have the required permissions to access this page.</div>;
    }

    return <Component {...props} />;
  };
}

// Hook for conditional rendering based on permissions
export function usePermissions() {
  const { checkPermission, hasRole } = useAuth();

  const canAccess = useCallback((
    permissions: Permission[] = [],
    roles: UserRole[] = []
  ): boolean => {
    const hasRequiredPermissions = permissions.length === 0 || 
      permissions.some(permission => checkPermission(permission));
    
    const hasRequiredRole = roles.length === 0 || 
      roles.some(role => hasRole(role));

    return hasRequiredPermissions && hasRequiredRole;
  }, [checkPermission, hasRole]);

  return { canAccess, checkPermission, hasRole };
}