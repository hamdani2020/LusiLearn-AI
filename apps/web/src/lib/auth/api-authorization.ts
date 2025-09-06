import { AuthUser, Permission, UserRole } from './types';
import { AuthorizationManager } from './authorization';
import { apiClient } from '../api-client';

/**
 * API authorization middleware and utilities
 */

export interface ApiAuthorizationContext {
  user: AuthUser | null;
  endpoint: string;
  method: string;
  data?: any;
  params?: Record<string, any>;
}

export interface AuthorizationError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_TOKEN' | 'INSUFFICIENT_PERMISSIONS';
  message: string;
  requiredPermissions?: Permission[];
  requiredRoles?: UserRole[];
  context?: any;
}

export class ApiAuthorizationManager {
  private static unauthorizedCallbacks: Set<() => void> = new Set();
  private static forbiddenCallbacks: Set<(error: AuthorizationError) => void> = new Set();

  /**
   * Initialize API authorization
   */
  static initialize(): void {
    // Add request interceptor to check authorization
    apiClient.addInterceptor({
      onRequest: async (config, context) => {
        const authContext: ApiAuthorizationContext = {
          user: this.getCurrentUser(),
          endpoint: context.endpoint,
          method: context.method,
          data: config.body ? JSON.parse(config.body as string) : undefined
        };

        // Check authorization
        const authResult = await this.checkApiAuthorization(authContext);
        
        if (!authResult.authorized) {
          throw new Error(`Authorization failed: ${authResult.error?.message}`);
        }

        return config;
      },

      onError: async (error, context) => {
        // Handle authorization errors
        if (error.status === 401) {
          this.handleUnauthorized();
        } else if (error.status === 403) {
          this.handleForbidden({
            code: 'FORBIDDEN',
            message: 'Access denied',
            context: { endpoint: context.endpoint, method: context.method }
          });
        }

        return error;
      }
    });
  }

  /**
   * Check API authorization for a request
   */
  static async checkApiAuthorization(
    context: ApiAuthorizationContext
  ): Promise<{
    authorized: boolean;
    error?: AuthorizationError;
  }> {
    const { user, endpoint, method, data } = context;

    // Check if user is authenticated
    if (!user) {
      return {
        authorized: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      };
    }

    // Check endpoint-specific authorization
    const canAccess = AuthorizationManager.canAccessEndpoint(
      user,
      method,
      endpoint,
      { data, params: context.params }
    );

    if (!canAccess) {
      const requiredPermissions = this.getRequiredPermissions(endpoint, method);
      const requiredRoles = this.getRequiredRoles(endpoint, method);

      return {
        authorized: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to access this resource',
          requiredPermissions,
          requiredRoles,
          context: { endpoint, method }
        }
      };
    }

    // Additional context-specific checks
    const contextCheck = await this.checkContextualAuthorization(context);
    if (!contextCheck.authorized) {
      return contextCheck;
    }

    return { authorized: true };
  }

  /**
   * Pre-authorize API call before making request
   */
  static async preAuthorizeApiCall(
    endpoint: string,
    method: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<boolean> {
    const context: ApiAuthorizationContext = {
      user: this.getCurrentUser(),
      endpoint,
      method,
      data,
      params
    };

    const result = await this.checkApiAuthorization(context);
    return result.authorized;
  }

  /**
   * Get user-friendly authorization error message
   */
  static getAuthorizationErrorMessage(error: AuthorizationError): string {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return 'Please log in to access this feature.';
      
      case 'FORBIDDEN':
        return 'You don\'t have permission to access this resource.';
      
      case 'INVALID_TOKEN':
        return 'Your session has expired. Please log in again.';
      
      case 'INSUFFICIENT_PERMISSIONS':
        if (error.requiredPermissions && error.requiredPermissions.length > 0) {
          const permissions = error.requiredPermissions
            .map(p => this.formatPermissionName(p))
            .join(', ');
          return `This action requires the following permissions: ${permissions}`;
        }
        
        if (error.requiredRoles && error.requiredRoles.length > 0) {
          const roles = error.requiredRoles
            .map(r => this.formatRoleName(r))
            .join(' or ');
          return `This action requires ${roles} role.`;
        }
        
        return 'You don\'t have sufficient permissions for this action.';
      
      default:
        return 'Access denied.';
    }
  }

  /**
   * Check if user can perform bulk operations
   */
  static canPerformBulkOperation(
    user: AuthUser | null,
    operation: string,
    resourceType: string,
    resourceIds: string[]
  ): boolean {
    if (!user) {
      return false;
    }

    // Check if user has bulk operation permission
    const bulkPermission = `bulk_${operation}_${resourceType}` as Permission;
    if (AuthorizationManager.hasPermission(user, bulkPermission)) {
      return true;
    }

    // Check if user can perform operation on all individual resources
    return resourceIds.every(id => 
      this.canAccessResource(user, resourceType, operation, { resourceId: id })
    );
  }

  /**
   * Filter resources based on user permissions
   */
  static filterAuthorizedResources<T extends { id: string; ownerId?: string }>(
    user: AuthUser | null,
    resources: T[],
    operation: string = 'read'
  ): T[] {
    if (!user) {
      return [];
    }

    return resources.filter(resource => {
      // Check if user owns the resource
      if (resource.ownerId === user.id) {
        return true;
      }

      // Check if user has permission to access resource
      return this.canAccessResource(user, 'resource', operation, {
        resourceId: resource.id,
        ownerId: resource.ownerId
      });
    });
  }

  /**
   * Add callback for unauthorized events
   */
  static onUnauthorized(callback: () => void): () => void {
    this.unauthorizedCallbacks.add(callback);
    
    return () => {
      this.unauthorizedCallbacks.delete(callback);
    };
  }

  /**
   * Add callback for forbidden events
   */
  static onForbidden(callback: (error: AuthorizationError) => void): () => void {
    this.forbiddenCallbacks.add(callback);
    
    return () => {
      this.forbiddenCallbacks.delete(callback);
    };
  }

  /**
   * Private helper methods
   */
  private static getCurrentUser(): AuthUser | null {
    // This should be implemented to get current user from auth context
    // For now, return null as placeholder
    return null;
  }

  private static async checkContextualAuthorization(
    context: ApiAuthorizationContext
  ): Promise<{ authorized: boolean; error?: AuthorizationError }> {
    const { user, endpoint, method, data } = context;

    if (!user) {
      return { authorized: false };
    }

    // Check resource ownership for modification operations
    if (['PUT', 'PATCH', 'DELETE'].includes(method)) {
      const resourceId = this.extractResourceId(endpoint);
      
      if (resourceId && data?.ownerId && data.ownerId !== user.id) {
        // Check if user has permission to modify others' resources
        const canModifyOthers = AuthorizationManager.hasPermission(
          user,
          Permission.MANAGE_USERS
        );

        if (!canModifyOthers) {
          return {
            authorized: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You can only modify your own resources'
            }
          };
        }
      }
    }

    // Check age-appropriate content access
    if (endpoint.includes('/content/') && user.role === UserRole.STUDENT) {
      const ageRestriction = data?.ageRestriction;
      const userAge = this.calculateAge(user.id); // Implement age calculation
      
      if (ageRestriction && userAge < ageRestriction) {
        return {
          authorized: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Content not appropriate for your age group'
          }
        };
      }
    }

    // Check study group membership for group-specific operations
    if (endpoint.includes('/study-groups/') && method !== 'GET') {
      const groupId = this.extractResourceId(endpoint);
      const isMember = await this.checkStudyGroupMembership(user.id, groupId);
      
      if (!isMember && !AuthorizationManager.hasPermission(user, Permission.MODERATE_STUDY_GROUP)) {
        return {
          authorized: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You must be a member of this study group'
          }
        };
      }
    }

    return { authorized: true };
  }

  private static canAccessResource(
    user: AuthUser,
    resourceType: string,
    operation: string,
    context?: any
  ): boolean {
    return AuthorizationManager.canAccessResource(
      user,
      resourceType,
      operation,
      context
    );
  }

  private static getRequiredPermissions(endpoint: string, method: string): Permission[] {
    // This would be implemented based on your API endpoint mapping
    // Return empty array as placeholder
    return [];
  }

  private static getRequiredRoles(endpoint: string, method: string): UserRole[] {
    // This would be implemented based on your API endpoint mapping
    // Return empty array as placeholder
    return [];
  }

  private static extractResourceId(endpoint: string): string | null {
    const matches = endpoint.match(/\/([a-f0-9-]{36}|\d+)(?:\/|$)/);
    return matches ? matches[1] : null;
  }

  private static calculateAge(userId: string): number {
    // Implement age calculation based on user data
    // Return 18 as placeholder
    return 18;
  }

  private static async checkStudyGroupMembership(
    userId: string,
    groupId: string | null
  ): Promise<boolean> {
    if (!groupId) return false;
    
    // Implement study group membership check
    // Return false as placeholder
    return false;
  }

  private static handleUnauthorized(): void {
    this.unauthorizedCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in unauthorized callback:', error);
      }
    });
  }

  private static handleForbidden(error: AuthorizationError): void {
    this.forbiddenCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in forbidden callback:', callbackError);
      }
    });
  }

  private static formatPermissionName(permission: Permission): string {
    return permission.replace(/_/g, ' ').toLowerCase();
  }

  private static formatRoleName(role: UserRole): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

// Initialize API authorization
ApiAuthorizationManager.initialize();