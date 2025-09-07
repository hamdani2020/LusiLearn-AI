'use client';

import React from 'react';
import { useAuth, usePermissions } from './auth-context';
import { UserRole, Permission } from './types';

/**
 * Component-based permission and role checking utilities
 */

interface PermissionGateProps {
  permissions?: Permission[];
  roles?: UserRole[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Gate component that renders children only if user has required permissions/roles
 */
export function PermissionGate({
  permissions = [],
  roles = [],
  requireAll = false,
  fallback = null,
  children
}: PermissionGateProps) {
  const { canAccess } = usePermissions();

  const hasAccess = canAccess(permissions, roles);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RoleGateProps {
  roles: UserRole[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Gate component that renders children only if user has required roles
 */
export function RoleGate({
  roles,
  requireAll = false,
  fallback = null,
  children
}: RoleGateProps) {
  const { hasRole } = usePermissions();

  const hasAccess = requireAll
    ? roles.every(role => hasRole(role))
    : roles.some(role => hasRole(role));

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface ConditionalRenderProps {
  condition: (user: any) => boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditional render component based on custom user condition
 */
export function ConditionalRender({
  condition,
  fallback = null,
  children
}: ConditionalRenderProps) {
  const { user } = useAuth();

  if (!user || !condition(user)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface AuthenticatedOnlyProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Component that only renders for authenticated users
 */
export function AuthenticatedOnly({
  fallback = <div>Please log in to access this content.</div>,
  children
}: AuthenticatedOnlyProps) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface UnauthenticatedOnlyProps {
  children: React.ReactNode;
}

/**
 * Component that only renders for unauthenticated users
 */
export function UnauthenticatedOnly({ children }: UnauthenticatedOnlyProps) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

interface OwnerOnlyProps {
  ownerId: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Component that only renders for resource owners or users with management permissions
 */
export function OwnerOnly({
  ownerId,
  fallback = <div>You don't have permission to access this content.</div>,
  children
}: OwnerOnlyProps) {
  const { user, checkPermission } = useAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  const isOwner = user.id === ownerId;
  const canManage = checkPermission(Permission.MANAGE_USERS);

  if (!isOwner && !canManage) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface AgeGateProps {
  minimumAge: number;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Component that renders based on user age (for age-appropriate content)
 */
export function AgeGate({
  minimumAge,
  fallback = <div>This content is not available for your age group.</div>,
  children
}: AgeGateProps) {
  const { user } = useAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  // Calculate age from user data (implement based on your user model)
  const userAge = calculateUserAge(user);

  if (userAge < minimumAge) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface FeatureFlagProps {
  feature: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Component that renders based on feature flags
 */
export function FeatureFlag({
  feature,
  fallback = null,
  children
}: FeatureFlagProps) {
  const { user } = useAuth();

  // Check if feature is enabled for user
  const isFeatureEnabled = checkFeatureFlag(feature, user);

  if (!isFeatureEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface LoadingGateProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Component that shows fallback while authentication is loading
 */
export function LoadingGate({
  fallback = <div>Loading...</div>,
  children
}: LoadingGateProps) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface ErrorBoundaryProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Error boundary for authorization errors
 */
export class AuthorizationErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean; error?: Error }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Authorization error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Authorization Error</h2>
          <p>You don't have permission to access this content.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for permission-based rendering
 */
export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions: Permission[],
  options: {
    requireAll?: boolean;
    fallback?: React.ComponentType;
  } = {}
) {
  const { requireAll = false, fallback: Fallback } = options;

  return function PermissionWrappedComponent(props: P) {
    return (
      <PermissionGate
        permissions={requiredPermissions}
        requireAll={requireAll}
        fallback={Fallback ? <Fallback /> : undefined}
      >
        <Component {...props} />
      </PermissionGate>
    );
  };
}

/**
 * Higher-order component for role-based rendering
 */
export function withRoles<P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles: UserRole[],
  options: {
    requireAll?: boolean;
    fallback?: React.ComponentType;
  } = {}
) {
  const { requireAll = false, fallback: Fallback } = options;

  return function RoleWrappedComponent(props: P) {
    return (
      <RoleGate
        roles={requiredRoles}
        requireAll={requireAll}
        fallback={Fallback ? <Fallback /> : undefined}
      >
        <Component {...props} />
      </RoleGate>
    );
  };
}

/**
 * Hook for conditional rendering based on permissions
 */
export function useConditionalRender() {
  const { user, checkPermission, hasRole } = useAuth();

  const renderIf = React.useCallback((
    condition: boolean | ((user: any) => boolean),
    component: React.ReactNode,
    fallback: React.ReactNode = null
  ) => {
    const shouldRender = typeof condition === 'function' 
      ? condition(user) 
      : condition;

    return shouldRender ? component : fallback;
  }, [user]);

  const renderForPermission = React.useCallback((
    permission: Permission,
    component: React.ReactNode,
    fallback: React.ReactNode = null
  ) => {
    return checkPermission(permission) ? component : fallback;
  }, [checkPermission]);

  const renderForRole = React.useCallback((
    role: UserRole,
    component: React.ReactNode,
    fallback: React.ReactNode = null
  ) => {
    return hasRole(role) ? component : fallback;
  }, [hasRole]);

  const renderForOwner = React.useCallback((
    ownerId: string,
    component: React.ReactNode,
    fallback: React.ReactNode = null
  ) => {
    const isOwner = user?.id === ownerId;
    const canManage = checkPermission(Permission.MANAGE_USERS);
    
    return (isOwner || canManage) ? component : fallback;
  }, [user, checkPermission]);

  return {
    renderIf,
    renderForPermission,
    renderForRole,
    renderForOwner
  };
}

/**
 * Helper functions
 */
function calculateUserAge(user: any): number {
  // Implement age calculation based on your user model
  // This is a placeholder implementation
  if (user.dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(user.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
  
  return 18; // Default age
}

function checkFeatureFlag(feature: string, user: any): boolean {
  // Implement feature flag checking logic
  // This is a placeholder implementation
  return true;
}