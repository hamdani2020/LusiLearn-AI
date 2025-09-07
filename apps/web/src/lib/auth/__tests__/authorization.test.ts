import { AuthorizationManager, ROLE_PERMISSIONS, ROLE_HIERARCHY } from '../authorization';
import { UserRole, Permission, AuthUser } from '../types';

describe('AuthorizationManager', () => {
  const mockStudent: AuthUser = {
    id: 'student-1',
    email: 'student@example.com',
    name: 'Test Student',
    role: UserRole.STUDENT,
    permissions: [Permission.CREATE_LEARNING_PATH, Permission.JOIN_STUDY_GROUP],
    lastLoginAt: new Date().toISOString(),
    emailVerified: true
  };

  const mockEducator: AuthUser = {
    id: 'educator-1',
    email: 'educator@example.com',
    name: 'Test Educator',
    role: UserRole.EDUCATOR,
    permissions: [
      Permission.CREATE_CONTENT,
      Permission.EDIT_CONTENT,
      Permission.CREATE_LEARNING_PATH,
      Permission.CREATE_STUDY_GROUP,
      Permission.MODERATE_STUDY_GROUP
    ],
    lastLoginAt: new Date().toISOString(),
    emailVerified: true
  };

  const mockAdmin: AuthUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    permissions: Object.values(Permission),
    lastLoginAt: new Date().toISOString(),
    emailVerified: true
  };

  beforeEach(() => {
    // Reset authorization manager
    AuthorizationManager.initialize();
  });

  describe('hasPermission', () => {
    it('should return true for user with explicit permission', () => {
      const result = AuthorizationManager.hasPermission(
        mockStudent,
        Permission.CREATE_LEARNING_PATH
      );
      expect(result).toBe(true);
    });

    it('should return false for user without permission', () => {
      const result = AuthorizationManager.hasPermission(
        mockStudent,
        Permission.MANAGE_USERS
      );
      expect(result).toBe(false);
    });

    it('should return false for null user', () => {
      const result = AuthorizationManager.hasPermission(
        null,
        Permission.CREATE_LEARNING_PATH
      );
      expect(result).toBe(false);
    });

    it('should check role-based permissions', () => {
      const result = AuthorizationManager.hasPermission(
        mockEducator,
        Permission.VIEW_ANALYTICS
      );
      expect(result).toBe(true);
    });

    it('should check inherited permissions from role hierarchy', () => {
      // Admin should have all permissions including lower-level ones
      const result = AuthorizationManager.hasPermission(
        mockAdmin,
        Permission.CREATE_LEARNING_PATH
      );
      expect(result).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the specified permissions', () => {
      const result = AuthorizationManager.hasAnyPermission(
        mockStudent,
        [Permission.MANAGE_USERS, Permission.CREATE_LEARNING_PATH]
      );
      expect(result).toBe(true);
    });

    it('should return false if user has none of the specified permissions', () => {
      const result = AuthorizationManager.hasAnyPermission(
        mockStudent,
        [Permission.MANAGE_USERS, Permission.DELETE_CONTENT]
      );
      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all specified permissions', () => {
      const result = AuthorizationManager.hasAllPermissions(
        mockStudent,
        [Permission.CREATE_LEARNING_PATH, Permission.JOIN_STUDY_GROUP]
      );
      expect(result).toBe(true);
    });

    it('should return false if user is missing any permission', () => {
      const result = AuthorizationManager.hasAllPermissions(
        mockStudent,
        [Permission.CREATE_LEARNING_PATH, Permission.MANAGE_USERS]
      );
      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      const result = AuthorizationManager.hasRole(mockStudent, UserRole.STUDENT);
      expect(result).toBe(true);
    });

    it('should return false for non-matching role', () => {
      const result = AuthorizationManager.hasRole(mockStudent, UserRole.ADMIN);
      expect(result).toBe(false);
    });

    it('should return false for null user', () => {
      const result = AuthorizationManager.hasRole(null, UserRole.STUDENT);
      expect(result).toBe(false);
    });
  });

  describe('hasRoleOrHigher', () => {
    it('should return true for exact role match', () => {
      const result = AuthorizationManager.hasRoleOrHigher(
        mockEducator,
        UserRole.EDUCATOR
      );
      expect(result).toBe(true);
    });

    it('should return true for higher role', () => {
      const result = AuthorizationManager.hasRoleOrHigher(
        mockAdmin,
        UserRole.STUDENT
      );
      expect(result).toBe(true);
    });

    it('should return false for lower role', () => {
      const result = AuthorizationManager.hasRoleOrHigher(
        mockStudent,
        UserRole.ADMIN
      );
      expect(result).toBe(false);
    });

    it('should return false for null user', () => {
      const result = AuthorizationManager.hasRoleOrHigher(null, UserRole.STUDENT);
      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for user', () => {
      const permissions = AuthorizationManager.getUserPermissions(mockEducator);
      
      // Should include explicit permissions
      expect(permissions).toContain(Permission.CREATE_CONTENT);
      expect(permissions).toContain(Permission.EDIT_CONTENT);
      
      // Should include role-based permissions
      expect(permissions).toContain(Permission.VIEW_ANALYTICS);
      
      // Should include inherited permissions from lower roles
      expect(permissions).toContain(Permission.CREATE_LEARNING_PATH);
    });

    it('should not contain duplicate permissions', () => {
      const permissions = AuthorizationManager.getUserPermissions(mockEducator);
      const uniquePermissions = [...new Set(permissions)];
      
      expect(permissions.length).toBe(uniquePermissions.length);
    });
  });

  describe('canAccessEndpoint', () => {
    it('should allow access to public endpoints', () => {
      const result = AuthorizationManager.canAccessEndpoint(
        null,
        'GET',
        '/api/health'
      );
      expect(result).toBe(true);
    });

    it('should deny access to protected endpoints for unauthenticated users', () => {
      const result = AuthorizationManager.canAccessEndpoint(
        null,
        'GET',
        '/api/v1/learning-paths'
      );
      expect(result).toBe(false);
    });

    it('should allow access when user has required permissions', () => {
      const result = AuthorizationManager.canAccessEndpoint(
        mockStudent,
        'GET',
        '/api/v1/learning-paths'
      );
      expect(result).toBe(true);
    });

    it('should deny access when user lacks required permissions', () => {
      const result = AuthorizationManager.canAccessEndpoint(
        mockStudent,
        'DELETE',
        '/api/v1/content/123'
      );
      expect(result).toBe(false);
    });

    it('should allow access for admin users', () => {
      const result = AuthorizationManager.canAccessEndpoint(
        mockAdmin,
        'DELETE',
        '/api/v1/content/123'
      );
      expect(result).toBe(true);
    });
  });

  describe('canAccessResource', () => {
    it('should allow resource access with proper permissions', () => {
      const result = AuthorizationManager.canAccessResource(
        mockEducator,
        'content',
        'create'
      );
      expect(result).toBe(false); // No specific resource rules defined in test
    });

    it('should deny resource access without permissions', () => {
      const result = AuthorizationManager.canAccessResource(
        mockStudent,
        'users',
        'manage'
      );
      expect(result).toBe(false);
    });
  });

  describe('role hierarchy', () => {
    it('should have correct role hierarchy levels', () => {
      expect(ROLE_HIERARCHY[UserRole.STUDENT]).toBeLessThan(
        ROLE_HIERARCHY[UserRole.EDUCATOR]
      );
      expect(ROLE_HIERARCHY[UserRole.EDUCATOR]).toBeLessThan(
        ROLE_HIERARCHY[UserRole.MODERATOR]
      );
      expect(ROLE_HIERARCHY[UserRole.MODERATOR]).toBeLessThan(
        ROLE_HIERARCHY[UserRole.ADMIN]
      );
    });
  });

  describe('role permissions', () => {
    it('should have defined permissions for each role', () => {
      Object.values(UserRole).forEach(role => {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
        expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      });
    });

    it('should have admin with all permissions', () => {
      const adminPermissions = ROLE_PERMISSIONS[UserRole.ADMIN];
      const allPermissions = Object.values(Permission);
      
      expect(adminPermissions.length).toBe(allPermissions.length);
      allPermissions.forEach(permission => {
        expect(adminPermissions).toContain(permission);
      });
    });

    it('should have students with basic permissions only', () => {
      const studentPermissions = ROLE_PERMISSIONS[UserRole.STUDENT];
      
      expect(studentPermissions).toContain(Permission.CREATE_LEARNING_PATH);
      expect(studentPermissions).toContain(Permission.JOIN_STUDY_GROUP);
      expect(studentPermissions).not.toContain(Permission.MANAGE_USERS);
      expect(studentPermissions).not.toContain(Permission.DELETE_CONTENT);
    });
  });

  describe('custom rules', () => {
    it('should allow adding custom authorization rules', () => {
      const customRule = {
        role: UserRole.STUDENT,
        permissions: [Permission.VIEW_ANALYTICS],
        conditions: (user: AuthUser, context: any) => {
          return context?.userId === user.id;
        }
      };

      AuthorizationManager.addRule(customRule);

      // Should allow access with proper context
      const result1 = AuthorizationManager.hasPermission(
        mockStudent,
        Permission.VIEW_ANALYTICS,
        { userId: mockStudent.id }
      );
      expect(result1).toBe(true);

      // Should deny access with wrong context
      const result2 = AuthorizationManager.hasPermission(
        mockStudent,
        Permission.VIEW_ANALYTICS,
        { userId: 'other-user' }
      );
      expect(result2).toBe(false);
    });
  });
});