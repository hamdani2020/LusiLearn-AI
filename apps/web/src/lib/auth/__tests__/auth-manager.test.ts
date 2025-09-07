import { AuthManager } from '../auth-manager';
import { TokenStorage } from '../secure-storage';
import { apiClient } from '../../api-client';
import { UserRole, Permission } from '../types';

// Mock dependencies
jest.mock('../secure-storage');
jest.mock('../../api-client');

const mockTokenStorage = {
  setTokens: jest.fn().mockResolvedValue(undefined),
  getAccessToken: jest.fn().mockResolvedValue(null),
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setUserData: jest.fn().mockResolvedValue(undefined),
  getUserData: jest.fn().mockResolvedValue(null),
  clearTokens: jest.fn(),
  hasValidTokens: jest.fn().mockResolvedValue(false),
  getTokenExpirationTime: jest.fn().mockReturnValue(null)
};

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock TokenStorage
(TokenStorage as any) = mockTokenStorage;

describe('AuthManager', () => {
  let authManager: AuthManager;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.STUDENT,
    permissions: [Permission.CREATE_LEARNING_PATH, Permission.JOIN_STUDY_GROUP],
    lastLoginAt: new Date().toISOString(),
    emailVerified: true
  };

  const mockTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    expiresIn: 3600
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    authManager = new AuthManager({
      refreshThreshold: 5,
      sessionTimeout: 30,
      maxRetries: 3
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('login', () => {
    it('should login successfully and store tokens', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockApiClient.post.mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          ...mockTokens
        }
      });

      const result = await authManager.login(credentials);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login', credentials);
      expect(mockTokenStorage.setTokens).toHaveBeenCalledWith(
        mockTokens.accessToken,
        mockTokens.refreshToken,
        mockTokens.expiresIn,
        false
      );
      expect(mockTokenStorage.setUserData).toHaveBeenCalledWith(mockUser);
      expect(mockApiClient.setAuthToken).toHaveBeenCalledWith(mockTokens.accessToken);
      expect(result).toEqual(mockUser);
    });

    it('should handle login failure', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      mockApiClient.post.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      });

      await expect(authManager.login(credentials)).rejects.toMatchObject({
        code: 'LOGIN_FAILED',
        message: 'Invalid credentials'
      });
      expect(mockTokenStorage.setTokens).not.toHaveBeenCalled();
    });

    it('should handle remember me option', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true
      };

      mockApiClient.post.mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          ...mockTokens
        }
      });

      await authManager.login(credentials);

      expect(mockTokenStorage.setTokens).toHaveBeenCalledWith(
        mockTokens.accessToken,
        mockTokens.refreshToken,
        mockTokens.expiresIn,
        true
      );
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const registerData = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        acceptTerms: true
      };

      mockApiClient.post.mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          ...mockTokens
        }
      });

      const result = await authManager.register(registerData);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/register', registerData);
      expect(result).toEqual(mockUser);
    });

    it('should handle registration failure', async () => {
      const registerData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
        acceptTerms: true
      };

      mockApiClient.post.mockResolvedValue({
        success: false,
        error: 'Email already exists'
      });

      await expect(authManager.register(registerData)).rejects.toMatchObject({
        code: 'REGISTRATION_FAILED',
        message: 'Email already exists'
      });
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockTokenStorage.getRefreshToken.mockResolvedValue('refresh-token-456');
      mockApiClient.post.mockResolvedValue({ success: true });

      await authManager.logout();

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/logout', {
        refreshToken: 'refresh-token-456'
      });
      expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
      expect(mockApiClient.clearAuthToken).toHaveBeenCalled();
    });

    it('should clear tokens even if server logout fails', async () => {
      mockTokenStorage.getRefreshToken.mockResolvedValue('refresh-token-456');
      mockApiClient.post.mockRejectedValue(new Error('Server error'));

      await authManager.logout();

      expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
      expect(mockApiClient.clearAuthToken).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      };

      mockTokenStorage.getRefreshToken.mockResolvedValue('refresh-token-456');
      mockApiClient.post.mockResolvedValue({
        success: true,
        data: newTokens
      });

      const result = await authManager.refreshToken();

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/refresh', {
        refreshToken: 'refresh-token-456'
      });
      expect(mockTokenStorage.setTokens).toHaveBeenCalledWith(
        newTokens.accessToken,
        newTokens.refreshToken,
        newTokens.expiresIn,
        true
      );
      expect(mockApiClient.setAuthToken).toHaveBeenCalledWith(newTokens.accessToken);
      expect(result).toBe(newTokens.accessToken);
    });

    it('should handle refresh failure and logout user', async () => {
      mockTokenStorage.getRefreshToken.mockResolvedValue('refresh-token-456');
      mockApiClient.post.mockResolvedValue({
        success: false,
        error: 'Invalid refresh token'
      });

      await expect(authManager.refreshToken()).rejects.toMatchObject({
        code: 'TOKEN_REFRESH_FAILED'
      });
      expect(mockTokenStorage.clearTokens).toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous refresh attempts', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      };

      mockTokenStorage.getRefreshToken.mockResolvedValue('refresh-token-456');
      mockApiClient.post.mockResolvedValue({
        success: true,
        data: newTokens
      });

      // Start multiple refresh attempts
      const promise1 = authManager.refreshToken();
      const promise2 = authManager.refreshToken();
      const promise3 = authManager.refreshToken();

      const results = await Promise.all([promise1, promise2, promise3]);

      // Should only make one API call
      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
      expect(results).toEqual([
        newTokens.accessToken,
        newTokens.accessToken,
        newTokens.accessToken
      ]);
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user and valid tokens exist', async () => {
      // Simulate a successful login to set cached data
      mockApiClient.post.mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          ...mockTokens
        }
      });

      await authManager.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(authManager.isAuthenticated()).toBe(true);
    });

    it('should return false when no user data exists', () => {
      // Clear any cached data
      authManager['cachedUser'] = null;
      authManager['cachedAccessToken'] = null;

      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('should return false when no valid tokens exist', () => {
      // Set user but no token
      authManager['cachedUser'] = mockUser;
      authManager['cachedAccessToken'] = null;

      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe('checkPermission', () => {
    beforeEach(() => {
      // Set cached user data
      authManager['cachedUser'] = mockUser;
    });

    it('should return true for user with permission', () => {
      const result = authManager.checkPermission(Permission.CREATE_LEARNING_PATH);
      expect(result).toBe(true);
    });

    it('should return false for user without permission', () => {
      const result = authManager.checkPermission(Permission.MANAGE_USERS);
      expect(result).toBe(false);
    });

    it('should return false when no user is logged in', () => {
      authManager['cachedUser'] = null;
      const result = authManager.checkPermission(Permission.CREATE_LEARNING_PATH);
      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    beforeEach(() => {
      // Set cached user data
      authManager['cachedUser'] = mockUser;
    });

    it('should return true for matching role', () => {
      const result = authManager.hasRole(UserRole.STUDENT);
      expect(result).toBe(true);
    });

    it('should return false for non-matching role', () => {
      const result = authManager.hasRole(UserRole.ADMIN);
      expect(result).toBe(false);
    });

    it('should return false when no user is logged in', () => {
      authManager['cachedUser'] = null;
      const result = authManager.hasRole(UserRole.STUDENT);
      expect(result).toBe(false);
    });
  });

  describe('updateUser', () => {
    it('should update user data', async () => {
      // Set cached user data
      authManager['cachedUser'] = mockUser;

      const updates = { name: 'Updated Name' };
      await authManager.updateUser(updates);

      expect(mockTokenStorage.setUserData).toHaveBeenCalledWith({
        ...mockUser,
        ...updates
      });
    });

    it('should not update when no user is logged in', async () => {
      authManager['cachedUser'] = null;

      const updates = { name: 'Updated Name' };
      await authManager.updateUser(updates);

      expect(mockTokenStorage.setUserData).not.toHaveBeenCalled();
    });
  });

  describe('token expiration', () => {
    it('should detect expired tokens', () => {
      const pastTime = Date.now() - 10000; // 10 seconds ago
      mockTokenStorage.getTokenExpirationTime.mockReturnValue(pastTime);

      expect(authManager.isTokenExpired()).toBe(true);
    });

    it('should detect tokens about to expire', () => {
      const soonTime = Date.now() + (2 * 60 * 1000); // 2 minutes from now (less than 5 minute threshold)
      mockTokenStorage.getTokenExpirationTime.mockReturnValue(soonTime);

      expect(authManager.isTokenExpired()).toBe(true);
    });

    it('should detect valid tokens', () => {
      const futureTime = Date.now() + (10 * 60 * 1000); // 10 minutes from now
      mockTokenStorage.getTokenExpirationTime.mockReturnValue(futureTime);

      expect(authManager.isTokenExpired()).toBe(false);
    });

    it('should calculate time until expiry', () => {
      const futureTime = Date.now() + (10 * 60 * 1000); // 10 minutes from now
      mockTokenStorage.getTokenExpirationTime.mockReturnValue(futureTime);

      const timeUntilExpiry = authManager.getTimeUntilExpiry();
      expect(timeUntilExpiry).toBeGreaterThan(9 * 60 * 1000); // Should be close to 10 minutes
      expect(timeUntilExpiry).toBeLessThanOrEqual(10 * 60 * 1000);
    });
  });

  describe('auth listeners', () => {
    it('should notify listeners of auth state changes', () => {
      const listener = jest.fn();
      const unsubscribe = authManager.addAuthListener(listener);

      // Simulate user login
      authManager['notifyListeners'](mockUser);
      expect(listener).toHaveBeenCalledWith(mockUser);

      // Simulate user logout
      authManager['notifyListeners'](null);
      expect(listener).toHaveBeenCalledWith(null);

      // Unsubscribe and verify no more calls
      unsubscribe();
      authManager['notifyListeners'](mockUser);
      expect(listener).toHaveBeenCalledTimes(2); // Should not be called again
    });
  });
});