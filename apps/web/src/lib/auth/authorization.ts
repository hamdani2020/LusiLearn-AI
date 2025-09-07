import { UserRole, Permission, AuthUser } from './types';

/**
 * Role-based access control (RBAC) system
 */

// Define role hierarchy (higher roles inherit permissions from lower roles)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.STUDENT]: 1,
  [UserRole.PARENT]: 2,
  [UserRole.EDUCATOR]: 3,
  [UserRole.MODERATOR]: 4,
  [UserRole.ADMIN]: 5
};

// Define default permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.STUDENT]: [
    Permission.CREATE_LEARNING_PATH,
    Permission.SHARE_LEARNING_PATH,
    Permission.JOIN_STUDY_GROUP,
    Permission.VIEW_ANALYTICS
  ],
  [UserRole.PARENT]: [
    Permission.CREATE_LEARNING_PATH,
    Permission.SHARE_LEARNING_PATH,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_USER_ANALYTICS // Can view their child's analytics
  ],
  [UserRole.EDUCATOR]: [
    Permission.CREATE_CONTENT,
    Permission.EDIT_CONTENT,
    Permission.CREATE_LEARNING_PATH,
    Permission.SHARE_LEARNING_PATH,
    Permission.CREATE_STUDY_GROUP,
    Permission.JOIN_STUDY_GROUP,
    Permission.MODERATE_STUDY_GROUP,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_USER_ANALYTICS
  ],
  [UserRole.MODERATOR]: [
    Permission.CREATE_CONTENT,
    Permission.EDIT_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.MODERATE_CONTENT,
    Permission.CREATE_LEARNING_PATH,
    Permission.SHARE_LEARNING_PATH,
    Permission.CREATE_STUDY_GROUP,
    Permission.JOIN_STUDY_GROUP,
    Permission.MODERATE_STUDY_GROUP,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_USER_ANALYTICS,
    Permission.MANAGE_USERS
  ],
  [UserRole.ADMIN]: [
    // Admins have all permissions
    ...Object.values(Permission)
  ]
};

// Define resource-specific permissions
export interface ResourcePermissions {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface AccessControlRule {
  role: UserRole;
  permissions: Permission[];
  resources?: ResourcePermissions[];
  conditions?: (user: AuthUser, context?: any) => boolean;
}

export class AuthorizationManager {
  private static rules: AccessControlRule[] = [];

  /**
   * Initialize authorization rules
   */
  static initialize(): void {
    // Set up default role-based rules
    Object.entries(ROLE_PERMISSIONS).forEach(([role, permissions]) => {
      this.addRule({
        role: role as UserRole,
        permissions
      });
    });

    // Add custom rules
    this.setupCustomRules();
  }

  /**
   * Add a custom authorization rule
   */
  static addRule(rule: AccessControlRule): void {
    this.rules.push(rule);
  }

  /**
   * Check if user has permission
   */
  static hasPermission(
    user: AuthUser | null,
    permission: Permission,
    context?: any
  ): boolean {
    if (!user) {
      return false;
    }

    // Check explicit user permissions first
    if (user.permissions.includes(permission)) {
      return true;
    }

    // Check role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    if (rolePermissions.includes(permission)) {
      return true;
    }

    // Check inherited permissions from role hierarchy
    if (this.hasInheritedPermission(user.role, permission)) {
      return true;
    }

    // Check custom rules
    return this.checkCustomRules(user, permission, context);
  }

  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(
    user: AuthUser | null,
    permissions: Permission[],
    context?: any
  ): boolean {
    return permissions.some(permission => 
      this.hasPermission(user, permission, context)
    );
  }

  /**
   * Check if user has all specified permissions
   */
  static hasAllPermissions(
    user: AuthUser | null,
    permissions: Permission[],
    context?: any
  ): boolean {
    return permissions.every(permission => 
      this.hasPermission(user, permission, context)
    );
  }

  /**
   * Check if user has specific role
   */
  static hasRole(user: AuthUser | null, role: UserRole): boolean {
    return user?.role === role;
  }

  /**
   * Check if user has role with equal or higher hierarchy level
   */
  static hasRoleOrHigher(user: AuthUser | null, role: UserRole): boolean {
    if (!user) {
      return false;
    }

    const userRoleLevel = ROLE_HIERARCHY[user.role] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[role] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }

  /**
   * Get all permissions for a user
   */
  static getUserPermissions(user: AuthUser): Permission[] {
    const permissions = new Set<Permission>();

    // Add explicit user permissions
    user.permissions.forEach(permission => permissions.add(permission));

    // Add role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    rolePermissions.forEach(permission => permissions.add(permission));

    // Add inherited permissions
    this.getInheritedPermissions(user.role).forEach(permission => 
      permissions.add(permission)
    );

    return Array.from(permissions);
  }

  /**
   * Check resource-specific access
   */
  static canAccessResource(
    user: AuthUser | null,
    resource: string,
    action: string,
    context?: any
  ): boolean {
    if (!user) {
      return false;
    }

    // Check custom resource rules
    const applicableRules = this.rules.filter(rule => 
      rule.role === user.role && rule.resources
    );

    for (const rule of applicableRules) {
      if (!rule.resources) continue;

      for (const resourceRule of rule.resources) {
        if (resourceRule.resource === resource && 
            resourceRule.actions.includes(action)) {
          
          // Check conditions if any
          if (rule.conditions && !rule.conditions(user, context)) {
            continue;
          }

          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get accessible resources for user
   */
  static getAccessibleResources(user: AuthUser): ResourcePermissions[] {
    const resources: ResourcePermissions[] = [];

    const applicableRules = this.rules.filter(rule => rule.role === user.role);

    for (const rule of applicableRules) {
      if (rule.resources) {
        resources.push(...rule.resources);
      }
    }

    return resources;
  }

  /**
   * Validate API endpoint access
   */
  static canAccessEndpoint(
    user: AuthUser | null,
    method: string,
    endpoint: string,
    context?: any
  ): boolean {
    // Define endpoint access rules
    const endpointRules = this.getEndpointRules();
    const rule = endpointRules.find(r => 
      r.method === method && this.matchesEndpoint(endpoint, r.pattern)
    );

    if (!rule) {
      // Default deny for undefined endpoints
      return false;
    }

    // Public endpoints (no authentication required)
    if (rule.permissions.length === 0 && rule.roles.length === 0) {
      return true;
    }

    // All other endpoints require authentication
    if (!user) {
      return false;
    }

    // Check required permissions
    if (rule.permissions.length > 0) {
      const hasRequiredPermissions = rule.requireAll 
        ? this.hasAllPermissions(user, rule.permissions, context)
        : this.hasAnyPermission(user, rule.permissions, context);

      if (!hasRequiredPermissions) {
        return false;
      }
    }

    // Check required roles
    if (rule.roles.length > 0) {
      const hasRequiredRole = rule.roles.some(role => 
        this.hasRoleOrHigher(user, role)
      );

      if (!hasRequiredRole) {
        return false;
      }
    }

    // Check custom conditions
    if (rule.condition && !rule.condition(user, context)) {
      return false;
    }

    return true;
  }

  /**
   * Private helper methods
   */
  private static hasInheritedPermission(role: UserRole, permission: Permission): boolean {
    const inheritedPermissions = this.getInheritedPermissions(role);
    return inheritedPermissions.includes(permission);
  }

  private static getInheritedPermissions(role: UserRole): Permission[] {
    const permissions = new Set<Permission>();
    const roleLevel = ROLE_HIERARCHY[role] || 0;

    // Inherit permissions from lower-level roles
    Object.entries(ROLE_HIERARCHY).forEach(([inheritRole, level]) => {
      if (level < roleLevel) {
        const rolePermissions = ROLE_PERMISSIONS[inheritRole as UserRole] || [];
        rolePermissions.forEach(permission => permissions.add(permission));
      }
    });

    return Array.from(permissions);
  }

  private static checkCustomRules(
    user: AuthUser,
    permission: Permission,
    context?: any
  ): boolean {
    const applicableRules = this.rules.filter(rule => 
      rule.role === user.role && rule.permissions.includes(permission)
    );

    // If no custom rules apply, return false
    if (applicableRules.length === 0) {
      return false;
    }

    // Check if any rule allows access
    return applicableRules.some(rule => 
      !rule.conditions || rule.conditions(user, context)
    );
  }

  private static setupCustomRules(): void {
    // Add age-based content access rules
    this.addRule({
      role: UserRole.STUDENT,
      permissions: [Permission.VIEW_ANALYTICS],
      conditions: (user, context) => {
        // Students can only view their own analytics
        return context?.userId === user.id;
      }
    });

    // Add parent supervision rules
    this.addRule({
      role: UserRole.PARENT,
      permissions: [Permission.VIEW_USER_ANALYTICS],
      conditions: (user, context) => {
        // Parents can view analytics of their children
        return context?.parentId === user.id;
      }
    });

    // Add educator class management rules
    this.addRule({
      role: UserRole.EDUCATOR,
      permissions: [Permission.MANAGE_USERS],
      conditions: (user, context) => {
        // Educators can manage users in their classes
        return context?.classId && user.permissions.includes(`class:${context.classId}` as Permission);
      }
    });
  }

  private static getEndpointRules(): EndpointRule[] {
    return [
      // Public endpoints (no authentication required)
      {
        method: 'GET',
        pattern: '/api/health',
        permissions: [],
        roles: [],
        requireAll: false
      },
      {
        method: 'POST',
        pattern: '/api/auth/login',
        permissions: [],
        roles: [],
        requireAll: false
      },
      {
        method: 'POST',
        pattern: '/api/auth/register',
        permissions: [],
        roles: [],
        requireAll: false
      },

      // Learning paths
      {
        method: 'GET',
        pattern: '/api/v1/learning-paths',
        permissions: [Permission.CREATE_LEARNING_PATH],
        roles: [],
        requireAll: false
      },
      {
        method: 'POST',
        pattern: '/api/v1/learning-paths',
        permissions: [Permission.CREATE_LEARNING_PATH],
        roles: [],
        requireAll: true
      },
      {
        method: 'PUT',
        pattern: '/api/v1/learning-paths/*',
        permissions: [Permission.CREATE_LEARNING_PATH],
        roles: [],
        requireAll: true,
        condition: (user, context) => {
          // Users can only edit their own learning paths
          return context?.ownerId === user.id;
        }
      },

      // Study groups
      {
        method: 'GET',
        pattern: '/api/v1/collaboration/study-groups',
        permissions: [Permission.JOIN_STUDY_GROUP],
        roles: [],
        requireAll: false
      },
      {
        method: 'POST',
        pattern: '/api/v1/collaboration/study-groups',
        permissions: [Permission.CREATE_STUDY_GROUP],
        roles: [],
        requireAll: true
      },

      // Content management
      {
        method: 'POST',
        pattern: '/api/v1/content',
        permissions: [Permission.CREATE_CONTENT],
        roles: [UserRole.EDUCATOR, UserRole.MODERATOR, UserRole.ADMIN],
        requireAll: true
      },
      {
        method: 'DELETE',
        pattern: '/api/v1/content/*',
        permissions: [Permission.DELETE_CONTENT],
        roles: [UserRole.MODERATOR, UserRole.ADMIN],
        requireAll: true
      },

      // User management
      {
        method: 'GET',
        pattern: '/api/v1/users',
        permissions: [Permission.MANAGE_USERS],
        roles: [UserRole.ADMIN, UserRole.MODERATOR],
        requireAll: false
      },
      {
        method: 'PUT',
        pattern: '/api/v1/users/*',
        permissions: [Permission.MANAGE_USERS],
        roles: [UserRole.ADMIN],
        requireAll: true
      },

      // Analytics
      {
        method: 'GET',
        pattern: '/api/v1/analytics/*',
        permissions: [Permission.VIEW_ANALYTICS],
        roles: [],
        requireAll: true
      },
      {
        method: 'GET',
        pattern: '/api/v1/analytics/users/*',
        permissions: [Permission.VIEW_USER_ANALYTICS],
        roles: [UserRole.EDUCATOR, UserRole.PARENT, UserRole.ADMIN],
        requireAll: true
      }
    ];
  }

  private static matchesEndpoint(endpoint: string, pattern: string): boolean {
    // Convert pattern to regex (simple wildcard matching)
    const regexPattern = pattern
      .replace(/\*/g, '[^/]+')
      .replace(/\//g, '\\/');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(endpoint);
  }
}

interface EndpointRule {
  method: string;
  pattern: string;
  permissions: Permission[];
  roles: UserRole[];
  requireAll: boolean;
  condition?: (user: AuthUser, context?: any) => boolean;
}

// Initialize authorization system
AuthorizationManager.initialize();