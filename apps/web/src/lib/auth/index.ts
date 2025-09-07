// Import types and enums
import { authManager } from './auth-manager';
import { UserRole, Permission } from './types';

// Types
export type {
  AuthTokens,
  AuthUser,
  LoginCredentials,
  RegisterData,
  AuthState,
  AuthConfig,
  TokenRefreshResponse,
  AuthContextValue,
  AuthError,
  SecureStorageOptions
} from './types';

export { UserRole, Permission } from './types';

// Core authentication manager
export { AuthManager, authManager } from './auth-manager';

// Secure storage utilities
export { SecureStorage, TokenStorage } from './secure-storage';

// React context and provider
export { AuthProvider, useAuth, withAuth, usePermissions } from './auth-context';

// Authentication hooks
export {
  useAuthState,
  useTokenManager,
  useRoleAccess,
  usePermissionAccess,
  useSession,
  useAuthForm,
  useUserProfile,
  useAuthMonitor
} from './hooks';

// Authorization system
export { AuthorizationManager, ROLE_PERMISSIONS, ROLE_HIERARCHY } from './authorization';
export { ApiAuthorizationManager } from './api-authorization';
export type { AuthorizationError, ApiAuthorizationContext } from './api-authorization';

// Permission components
export {
  PermissionGate,
  RoleGate,
  ConditionalRender,
  AuthenticatedOnly,
  UnauthenticatedOnly,
  OwnerOnly,
  AgeGate,
  FeatureFlag,
  LoadingGate,
  AuthorizationErrorBoundary,
  withPermissions,
  withRoles,
  useConditionalRender
} from './permission-components';

// Re-export commonly used utilities
export const auth = {
  manager: authManager,
  isAuthenticated: () => authManager.isAuthenticated(),
  getCurrentUser: () => authManager.getCurrentUser(),
  checkPermission: (permission: Permission) => authManager.checkPermission(permission),
  hasRole: (role: UserRole) => authManager.hasRole(role),
  logout: () => authManager.logout()
};