/**
 * Data encryption utilities for secure handling of sensitive information
 * Uses Web Crypto API for client-side encryption
 */

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
}

export interface DecryptionOptions {
  encryptedData: string;
  iv: string;
  salt: string;
  password?: string;
}

export class DataEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly SALT_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  /**
   * Generate a cryptographic key from password and salt
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt sensitive data using AES-GCM
   */
  static async encrypt(data: string, password?: string): Promise<EncryptionResult> {
    if (!crypto.subtle) {
      throw new Error('Web Crypto API not available');
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Use provided password or generate one from environment
      const encryptionPassword = password || this.getDefaultPassword();
      
      // Derive encryption key
      const key = await this.deriveKey(encryptionPassword, salt);

      // Encrypt the data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
          tagLength: this.TAG_LENGTH * 8
        },
        key,
        dataBuffer
      );

      return {
        encryptedData: this.arrayBufferToBase64(encryptedBuffer),
        iv: this.arrayBufferToBase64(iv),
        salt: this.arrayBufferToBase64(salt)
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  static async decrypt(options: DecryptionOptions): Promise<string> {
    if (!crypto.subtle) {
      throw new Error('Web Crypto API not available');
    }

    try {
      const { encryptedData, iv, salt, password } = options;

      // Convert base64 strings back to ArrayBuffers
      const encryptedBuffer = this.base64ToArrayBuffer(encryptedData);
      const ivBuffer = this.base64ToArrayBuffer(iv);
      const saltBuffer = this.base64ToArrayBuffer(salt);

      // Use provided password or default
      const decryptionPassword = password || this.getDefaultPassword();
      
      // Derive decryption key
      const key = await this.deriveKey(decryptionPassword, new Uint8Array(saltBuffer));

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: new Uint8Array(ivBuffer),
          tagLength: this.TAG_LENGTH * 8
        },
        key,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));
    
    return Array.from(randomValues)
      .map(value => charset[value % charset.length])
      .join('');
  }

  /**
   * Hash data using SHA-256
   */
  static async hash(data: string): Promise<string> {
    if (!crypto.subtle) {
      throw new Error('Web Crypto API not available');
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    
    return this.arrayBufferToBase64(hashBuffer);
  }

  /**
   * Verify data against hash
   */
  static async verifyHash(data: string, hash: string): Promise<boolean> {
    try {
      const computedHash = await this.hash(data);
      return computedHash === hash;
    } catch {
      return false;
    }
  }

  /**
   * Get default encryption password from environment or generate one
   */
  private static getDefaultPassword(): string {
    // In production, this should come from a secure environment variable
    // For development, we'll use a default value
    return process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'lusilearn-default-encryption-key-2024';
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Utility class for handling sensitive form data
 */
export class SecureFormData {
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'confirmpassword',
    'currentpassword',
    'newpassword',
    'ssn',
    'creditcard',
    'bankaccount',
    'apikey',
    'token',
    'secret'
  ];

  /**
   * Encrypt sensitive fields in form data
   */
  static async encryptSensitiveFields(formData: Record<string, any>): Promise<Record<string, any>> {
    const encryptedData = { ...formData };

    for (const [key, value] of Object.entries(formData)) {
      if (this.isSensitiveField(key) && typeof value === 'string' && value.length > 0) {
        try {
          const encrypted = await DataEncryption.encrypt(value);
          encryptedData[key] = {
            encrypted: true,
            ...encrypted
          };
        } catch (error) {
          console.error(`Failed to encrypt field ${key}:`, error);
          // Keep original value if encryption fails
        }
      }
    }

    return encryptedData;
  }

  /**
   * Decrypt sensitive fields in form data
   */
  static async decryptSensitiveFields(formData: Record<string, any>): Promise<Record<string, any>> {
    const decryptedData = { ...formData };

    for (const [key, value] of Object.entries(formData)) {
      if (typeof value === 'object' && value?.encrypted === true) {
        try {
          const decrypted = await DataEncryption.decrypt({
            encryptedData: value.encryptedData,
            iv: value.iv,
            salt: value.salt
          });
          decryptedData[key] = decrypted;
        } catch (error) {
          console.error(`Failed to decrypt field ${key}:`, error);
          // Remove field if decryption fails
          delete decryptedData[key];
        }
      }
    }

    return decryptedData;
  }

  /**
   * Check if a field name indicates sensitive data
   */
  private static isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.SENSITIVE_FIELDS.some(sensitiveField => 
      lowerFieldName.includes(sensitiveField.toLowerCase())
    );
  }

  /**
   * Sanitize form data for logging (remove sensitive fields)
   */
  static sanitizeForLogging(formData: Record<string, any>): Record<string, any> {
    const sanitized = { ...formData };

    for (const key of Object.keys(sanitized)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

/**
 * Utility for secure data transmission
 */
export class SecureTransmission {
  /**
   * Prepare data for secure transmission
   */
  static async prepareForTransmission(data: any): Promise<{
    data: any;
    checksum: string;
    timestamp: number;
  }> {
    const timestamp = Date.now();
    const serializedData = JSON.stringify(data);
    const checksum = await DataEncryption.hash(serializedData + timestamp);

    return {
      data,
      checksum,
      timestamp
    };
  }

  /**
   * Verify received data integrity
   */
  static async verifyTransmission(payload: {
    data: any;
    checksum: string;
    timestamp: number;
  }): Promise<boolean> {
    try {
      const { data, checksum, timestamp } = payload;
      
      // Check timestamp (reject data older than 5 minutes)
      const maxAge = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - timestamp > maxAge) {
        console.warn('Data transmission expired');
        return false;
      }

      // Verify checksum
      const serializedData = JSON.stringify(data);
      const expectedChecksum = await DataEncryption.hash(serializedData + timestamp);
      
      return checksum === expectedChecksum;
    } catch (error) {
      console.error('Transmission verification failed:', error);
      return false;
    }
  }
}