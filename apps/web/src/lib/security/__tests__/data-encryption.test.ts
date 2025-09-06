import { DataEncryption, SecureFormData, SecureTransmission } from '../data-encryption';

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    digest: jest.fn(),
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    deriveBits: jest.fn()
  },
  getRandomValues: jest.fn()
};

// Mock TextEncoder/TextDecoder
global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4]))
}));

global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn().mockReturnValue('decoded text')
}));

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

describe('DataEncryption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock crypto.getRandomValues
    mockCrypto.getRandomValues.mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    });
  });

  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const testData = 'sensitive information';
      const mockEncryptedBuffer = new ArrayBuffer(32);
      const mockSalt = new Uint8Array(16);
      const mockIv = new Uint8Array(12);

      mockCrypto.subtle.importKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncryptedBuffer);

      const result = await DataEncryption.encrypt(testData);

      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('salt');
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
    });

    it('should handle encryption failure', async () => {
      const testData = 'sensitive information';
      
      mockCrypto.subtle.importKey.mockRejectedValue(new Error('Encryption failed'));

      await expect(DataEncryption.encrypt(testData)).rejects.toThrow('Failed to encrypt data');
    });

    it('should throw error when Web Crypto API is not available', async () => {
      const originalCrypto = global.crypto;
      global.crypto = { subtle: null } as any;

      await expect(DataEncryption.encrypt('test')).rejects.toThrow('Web Crypto API not available');

      global.crypto = originalCrypto;
    });
  });

  describe('decrypt', () => {
    it('should decrypt data successfully', async () => {
      const testData = 'decrypted information';
      const mockDecryptedBuffer = new TextEncoder().encode(testData);
      
      const decryptionOptions = {
        encryptedData: 'encrypted-data-base64',
        iv: 'iv-base64',
        salt: 'salt-base64'
      };

      mockCrypto.subtle.importKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.decrypt.mockResolvedValue(mockDecryptedBuffer);

      const result = await DataEncryption.decrypt(decryptionOptions);

      expect(result).toBe(testData);
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should handle decryption failure', async () => {
      const decryptionOptions = {
        encryptedData: 'encrypted-data-base64',
        iv: 'iv-base64',
        salt: 'salt-base64'
      };

      mockCrypto.subtle.importKey.mockRejectedValue(new Error('Decryption failed'));

      await expect(DataEncryption.decrypt(decryptionOptions)).rejects.toThrow('Failed to decrypt data');
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password of specified length', () => {
      const length = 16;
      const password = DataEncryption.generateSecurePassword(length);

      expect(password).toHaveLength(length);
      expect(typeof password).toBe('string');
    });

    it('should generate different passwords on multiple calls', () => {
      const password1 = DataEncryption.generateSecurePassword();
      const password2 = DataEncryption.generateSecurePassword();

      expect(password1).not.toBe(password2);
    });
  });

  describe('hash', () => {
    it('should hash data successfully', async () => {
      const testData = 'data to hash';
      const mockHashBuffer = new ArrayBuffer(32);

      mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);

      const result = await DataEncryption.hash(testData);

      expect(typeof result).toBe('string');
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
    });
  });

  describe('verifyHash', () => {
    it('should verify hash successfully', async () => {
      const testData = 'data to verify';
      const testHash = 'expected-hash';

      // Mock hash function to return the expected hash
      jest.spyOn(DataEncryption, 'hash').mockResolvedValue(testHash);

      const result = await DataEncryption.verifyHash(testData, testHash);

      expect(result).toBe(true);
    });

    it('should return false for invalid hash', async () => {
      const testData = 'data to verify';
      const testHash = 'expected-hash';
      const wrongHash = 'wrong-hash';

      jest.spyOn(DataEncryption, 'hash').mockResolvedValue(wrongHash);

      const result = await DataEncryption.verifyHash(testData, testHash);

      expect(result).toBe(false);
    });
  });
});

describe('SecureFormData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('encryptSensitiveFields', () => {
    it('should encrypt sensitive fields', async () => {
      const formData = {
        username: 'testuser',
        password: 'secretpassword',
        email: 'test@example.com',
        apiKey: 'secret-api-key'
      };

      jest.spyOn(DataEncryption, 'encrypt').mockResolvedValue({
        encryptedData: 'encrypted-data',
        iv: 'iv-data',
        salt: 'salt-data'
      });

      const result = await SecureFormData.encryptSensitiveFields(formData);

      expect(result.username).toBe('testuser'); // Not sensitive
      expect(result.email).toBe('test@example.com'); // Not sensitive
      expect(result.password).toEqual({
        encrypted: true,
        encryptedData: 'encrypted-data',
        iv: 'iv-data',
        salt: 'salt-data'
      });
      expect(result.apiKey).toEqual({
        encrypted: true,
        encryptedData: 'encrypted-data',
        iv: 'iv-data',
        salt: 'salt-data'
      });
    });

    it('should handle encryption errors gracefully', async () => {
      const formData = {
        password: 'secretpassword'
      };

      jest.spyOn(DataEncryption, 'encrypt').mockRejectedValue(new Error('Encryption failed'));

      const result = await SecureFormData.encryptSensitiveFields(formData);

      expect(result.password).toBe('secretpassword'); // Should keep original value
    });
  });

  describe('decryptSensitiveFields', () => {
    it('should decrypt encrypted fields', async () => {
      const formData = {
        username: 'testuser',
        password: {
          encrypted: true,
          encryptedData: 'encrypted-data',
          iv: 'iv-data',
          salt: 'salt-data'
        }
      };

      jest.spyOn(DataEncryption, 'decrypt').mockResolvedValue('decryptedpassword');

      const result = await SecureFormData.decryptSensitiveFields(formData);

      expect(result.username).toBe('testuser');
      expect(result.password).toBe('decryptedpassword');
    });

    it('should handle decryption errors gracefully', async () => {
      const formData = {
        password: {
          encrypted: true,
          encryptedData: 'encrypted-data',
          iv: 'iv-data',
          salt: 'salt-data'
        }
      };

      jest.spyOn(DataEncryption, 'decrypt').mockRejectedValue(new Error('Decryption failed'));

      const result = await SecureFormData.decryptSensitiveFields(formData);

      expect(result).not.toHaveProperty('password'); // Should be removed
    });
  });

  describe('sanitizeForLogging', () => {
    it('should redact sensitive fields', () => {
      const formData = {
        username: 'testuser',
        password: 'secretpassword',
        email: 'test@example.com',
        creditCard: '1234-5678-9012-3456'
      };

      const result = SecureFormData.sanitizeForLogging(formData);

      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('[REDACTED]');
      expect(result.creditCard).toBe('[REDACTED]');
    });
  });
});

describe('SecureTransmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('prepareForTransmission', () => {
    it('should prepare data with checksum and timestamp', async () => {
      const testData = { message: 'test data' };
      const mockHash = 'mock-checksum';

      jest.spyOn(DataEncryption, 'hash').mockResolvedValue(mockHash);

      const result = await SecureTransmission.prepareForTransmission(testData);

      expect(result).toEqual({
        data: testData,
        checksum: mockHash,
        timestamp: 1000000
      });
    });
  });

  describe('verifyTransmission', () => {
    it('should verify valid transmission', async () => {
      const payload = {
        data: { message: 'test data' },
        checksum: 'valid-checksum',
        timestamp: 1000000
      };

      jest.spyOn(DataEncryption, 'hash').mockResolvedValue('valid-checksum');

      const result = await SecureTransmission.verifyTransmission(payload);

      expect(result).toBe(true);
    });

    it('should reject expired transmission', async () => {
      const payload = {
        data: { message: 'test data' },
        checksum: 'valid-checksum',
        timestamp: 1000000 - (6 * 60 * 1000) // 6 minutes ago
      };

      const result = await SecureTransmission.verifyTransmission(payload);

      expect(result).toBe(false);
    });

    it('should reject transmission with invalid checksum', async () => {
      const payload = {
        data: { message: 'test data' },
        checksum: 'invalid-checksum',
        timestamp: 1000000
      };

      jest.spyOn(DataEncryption, 'hash').mockResolvedValue('valid-checksum');

      const result = await SecureTransmission.verifyTransmission(payload);

      expect(result).toBe(false);
    });
  });
});