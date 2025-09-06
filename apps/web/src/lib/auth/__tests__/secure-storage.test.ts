import { SecureStorage, TokenStorage } from '../secure-storage';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
});

describe('SecureStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    document.cookie = '';
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      const testData = { test: 'value' };
      
      SecureStorage.set('test-key', testData);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        expect.stringContaining('"value":{"test":"value"}')
      );

      // Mock the stored value for retrieval
      const storedValue = JSON.stringify({
        value: testData,
        timestamp: Date.now(),
        expiresAt: undefined
      });
      localStorageMock.getItem.mockReturnValue(storedValue);

      const retrieved = SecureStorage.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should handle expiration', () => {
      const testData = { test: 'value' };
      const pastExpiry = Date.now() - 1000;
      
      const expiredValue = JSON.stringify({
        value: testData,
        timestamp: Date.now() - 2000,
        expiresAt: pastExpiry
      });
      localStorageMock.getItem.mockReturnValue(expiredValue);

      const retrieved = SecureStorage.get('test-key');
      expect(retrieved).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should handle encryption option', () => {
      const testData = { sensitive: 'data' };
      
      SecureStorage.set('encrypted-key', testData, { encrypt: true });
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const [key, value] = localStorageMock.setItem.mock.calls[0];
      expect(key).toBe('encrypted-key');
      expect(value).not.toContain('sensitive');
    });
  });

  describe('remove', () => {
    it('should remove data from localStorage', () => {
      SecureStorage.remove('test-key');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired data', () => {
      const testData = { test: 'value' };
      const validValue = JSON.stringify({
        value: testData,
        timestamp: Date.now(),
        expiresAt: Date.now() + 10000
      });
      localStorageMock.getItem.mockReturnValue(validValue);

      expect(SecureStorage.has('test-key')).toBe(true);
    });

    it('should return false for expired data', () => {
      const testData = { test: 'value' };
      const expiredValue = JSON.stringify({
        value: testData,
        timestamp: Date.now() - 2000,
        expiresAt: Date.now() - 1000
      });
      localStorageMock.getItem.mockReturnValue(expiredValue);

      expect(SecureStorage.has('test-key')).toBe(false);
    });

    it('should return false for non-existent data', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(SecureStorage.has('non-existent')).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all auth-related data', () => {
      SecureStorage.clearAll();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lusilearn_access_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lusilearn_refresh_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lusilearn_user_data');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lusilearn_auth_state');
    });
  });
});

describe('TokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('setTokens', () => {
    it('should store access and refresh tokens with expiration', () => {
      const accessToken = 'access-token-123';
      const refreshToken = 'refresh-token-456';
      const expiresIn = 3600; // 1 hour

      TokenStorage.setTokens(accessToken, refreshToken, expiresIn);

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
      
      // Check that tokens were stored
      const setItemCalls = localStorageMock.setItem.mock.calls;
      const accessTokenCall = setItemCalls.find(call => call[0] === 'lusilearn_access_token');
      const refreshTokenCall = setItemCalls.find(call => call[0] === 'lusilearn_refresh_token');
      
      expect(accessTokenCall).toBeDefined();
      expect(refreshTokenCall).toBeDefined();
    });

    it('should handle remember me option', () => {
      const accessToken = 'access-token-123';
      const refreshToken = 'refresh-token-456';
      const expiresIn = 3600;

      TokenStorage.setTokens(accessToken, refreshToken, expiresIn, true);

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAccessToken', () => {
    it('should retrieve access token', () => {
      const token = 'access-token-123';
      const tokenData = JSON.stringify({
        value: token,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000
      });
      
      localStorageMock.getItem.mockReturnValue(tokenData);

      const retrieved = TokenStorage.getAccessToken();
      expect(retrieved).toBe(token);
    });

    it('should return null for expired token', () => {
      const token = 'access-token-123';
      const expiredTokenData = JSON.stringify({
        value: token,
        timestamp: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000
      });
      
      localStorageMock.getItem.mockReturnValue(expiredTokenData);

      const retrieved = TokenStorage.getAccessToken();
      expect(retrieved).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('should retrieve refresh token', () => {
      const token = 'refresh-token-456';
      const tokenData = JSON.stringify({
        value: token,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000
      });
      
      localStorageMock.getItem.mockReturnValue(tokenData);

      const retrieved = TokenStorage.getRefreshToken();
      expect(retrieved).toBe(token);
    });
  });

  describe('clearTokens', () => {
    it('should clear all stored tokens', () => {
      TokenStorage.clearTokens();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lusilearn_access_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lusilearn_refresh_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('lusilearn_user_data');
    });
  });

  describe('hasValidTokens', () => {
    it('should return true for valid tokens', () => {
      const token = 'access-token-123';
      const tokenData = JSON.stringify({
        value: token,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000
      });
      
      localStorageMock.getItem.mockReturnValue(tokenData);

      expect(TokenStorage.hasValidTokens()).toBe(true);
    });

    it('should return false for expired tokens', () => {
      const token = 'access-token-123';
      const expiredTokenData = JSON.stringify({
        value: token,
        timestamp: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000
      });
      
      localStorageMock.getItem.mockReturnValue(expiredTokenData);

      expect(TokenStorage.hasValidTokens()).toBe(false);
    });

    it('should return false for missing tokens', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(TokenStorage.hasValidTokens()).toBe(false);
    });
  });
});