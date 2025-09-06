import { DataEncryption } from './data-encryption';

/**
 * Secure local storage with encryption, expiration, and data integrity
 */

export interface SecureStorageItem {
  value: any;
  encrypted: boolean;
  timestamp: number;
  expiresAt?: number;
  checksum: string;
  version: string;
}

export interface SecureStorageOptions {
  encrypt?: boolean;
  expiresIn?: number; // milliseconds
  compress?: boolean;
  namespace?: string;
}

export class SecureLocalStorage {
  private static readonly VERSION = '1.0.0';
  private static readonly DEFAULT_NAMESPACE = 'lusilearn';
  private static readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  private static cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize secure storage with cleanup timer
   */
  static initialize(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Start cleanup timer
    this.startCleanupTimer();

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.stopCleanupTimer();
    });

    // Initial cleanup
    this.cleanup();
  }

  /**
   * Store data securely
   */
  static async set(
    key: string,
    value: any,
    options: SecureStorageOptions = {}
  ): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('SecureLocalStorage is not available in server-side environment');
    }

    const {
      encrypt = false,
      expiresIn,
      compress = false,
      namespace = this.DEFAULT_NAMESPACE
    } = options;

    try {
      // Check storage quota
      await this.checkStorageQuota();

      const namespacedKey = this.getNamespacedKey(key, namespace);
      const timestamp = Date.now();
      const expiresAt = expiresIn ? timestamp + expiresIn : undefined;

      let serializedValue = JSON.stringify(value);

      // Compress if requested
      if (compress) {
        serializedValue = await this.compress(serializedValue);
      }

      // Encrypt if requested
      let encryptedValue = serializedValue;
      let isEncrypted = false;

      if (encrypt) {
        const encrypted = await DataEncryption.encrypt(serializedValue);
        encryptedValue = JSON.stringify(encrypted);
        isEncrypted = true;
      }

      // Create checksum for integrity
      const checksum = await DataEncryption.hash(encryptedValue + timestamp);

      const storageItem: SecureStorageItem = {
        value: isEncrypted ? JSON.parse(encryptedValue) : value,
        encrypted: isEncrypted,
        timestamp,
        expiresAt,
        checksum,
        version: this.VERSION
      };

      const itemString = JSON.stringify(storageItem);

      // Check item size
      if (itemString.length > this.MAX_STORAGE_SIZE / 10) {
        throw new Error('Item too large for storage');
      }

      localStorage.setItem(namespacedKey, itemString);
    } catch (error) {
      console.error('Failed to store data securely:', error);
      throw new Error('Failed to store data');
    }
  }

  /**
   * Retrieve data securely
   */
  static async get<T>(
    key: string,
    options: { namespace?: string } = {}
  ): Promise<T | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    const { namespace = this.DEFAULT_NAMESPACE } = options;

    try {
      const namespacedKey = this.getNamespacedKey(key, namespace);
      const itemString = localStorage.getItem(namespacedKey);

      if (!itemString) {
        return null;
      }

      const storageItem: SecureStorageItem = JSON.parse(itemString);

      // Check version compatibility
      if (storageItem.version !== this.VERSION) {
        console.warn(`Storage version mismatch for key ${key}`);
        this.remove(key, { namespace });
        return null;
      }

      // Check expiration
      if (storageItem.expiresAt && Date.now() > storageItem.expiresAt) {
        this.remove(key, { namespace });
        return null;
      }

      // Verify integrity
      const expectedChecksum = await DataEncryption.hash(
        JSON.stringify(storageItem.value) + storageItem.timestamp
      );

      if (storageItem.checksum !== expectedChecksum) {
        console.warn(`Data integrity check failed for key ${key}`);
        this.remove(key, { namespace });
        return null;
      }

      // Decrypt if needed
      if (storageItem.encrypted) {
        const decrypted = await DataEncryption.decrypt(storageItem.value);
        return JSON.parse(decrypted);
      }

      return storageItem.value;
    } catch (error) {
      console.error('Failed to retrieve data securely:', error);
      return null;
    }
  }

  /**
   * Remove data
   */
  static remove(key: string, options: { namespace?: string } = {}): void {
    if (typeof window === 'undefined') {
      return;
    }

    const { namespace = this.DEFAULT_NAMESPACE } = options;
    const namespacedKey = this.getNamespacedKey(key, namespace);
    localStorage.removeItem(namespacedKey);
  }

  /**
   * Check if key exists and is not expired
   */
  static async has(key: string, options: { namespace?: string } = {}): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== null;
  }

  /**
   * Clear all data in namespace
   */
  static clear(namespace: string = this.DEFAULT_NAMESPACE): void {
    if (typeof window === 'undefined') {
      return;
    }

    const prefix = `${namespace}:`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Get all keys in namespace
   */
  static getKeys(namespace: string = this.DEFAULT_NAMESPACE): string[] {
    if (typeof window === 'undefined') {
      return [];
    }

    const prefix = `${namespace}:`;
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }

    return keys;
  }

  /**
   * Get storage usage statistics
   */
  static getStorageStats(namespace?: string): {
    totalSize: number;
    itemCount: number;
    expiredCount: number;
    encryptedCount: number;
  } {
    if (typeof window === 'undefined') {
      return { totalSize: 0, itemCount: 0, expiredCount: 0, encryptedCount: 0 };
    }

    let totalSize = 0;
    let itemCount = 0;
    let expiredCount = 0;
    let encryptedCount = 0;

    const prefix = namespace ? `${namespace}:` : this.DEFAULT_NAMESPACE + ':';

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
          itemCount++;

          try {
            const storageItem: SecureStorageItem = JSON.parse(value);
            
            if (storageItem.expiresAt && Date.now() > storageItem.expiresAt) {
              expiredCount++;
            }

            if (storageItem.encrypted) {
              encryptedCount++;
            }
          } catch {
            // Invalid item, count as expired
            expiredCount++;
          }
        }
      }
    }

    return { totalSize, itemCount, expiredCount, encryptedCount };
  }

  /**
   * Clean up expired items
   */
  static cleanup(namespace?: string): number {
    if (typeof window === 'undefined') {
      return 0;
    }

    const prefix = namespace ? `${namespace}:` : this.DEFAULT_NAMESPACE + ':';
    const keysToRemove: string[] = [];
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const storageItem: SecureStorageItem = JSON.parse(value);
            
            // Remove expired items
            if (storageItem.expiresAt && now > storageItem.expiresAt) {
              keysToRemove.push(key);
            }
            
            // Remove items with old versions
            else if (storageItem.version !== this.VERSION) {
              keysToRemove.push(key);
            }
          } catch {
            // Remove invalid items
            keysToRemove.push(key);
          }
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    return keysToRemove.length;
  }

  /**
   * Export data for backup
   */
  static async exportData(namespace: string = this.DEFAULT_NAMESPACE): Promise<Record<string, any>> {
    const keys = this.getKeys(namespace);
    const data: Record<string, any> = {};

    for (const key of keys) {
      const value = await this.get(key, { namespace });
      if (value !== null) {
        data[key] = value;
      }
    }

    return data;
  }

  /**
   * Import data from backup
   */
  static async importData(
    data: Record<string, any>,
    options: SecureStorageOptions & { namespace?: string } = {}
  ): Promise<void> {
    const { namespace = this.DEFAULT_NAMESPACE, ...storageOptions } = options;

    for (const [key, value] of Object.entries(data)) {
      await this.set(key, value, { ...storageOptions, namespace });
    }
  }

  /**
   * Private helper methods
   */
  private static getNamespacedKey(key: string, namespace: string): string {
    return `${namespace}:${key}`;
  }

  private static async checkStorageQuota(): Promise<void> {
    if (!navigator.storage?.estimate) {
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;

      if (quota > 0 && used / quota > 0.9) {
        console.warn('Storage quota nearly exceeded, cleaning up...');
        this.cleanup();
      }
    } catch (error) {
      console.warn('Failed to check storage quota:', error);
    }
  }

  private static async compress(data: string): Promise<string> {
    // Simple compression using base64 encoding
    // In production, consider using a proper compression library
    return btoa(encodeURIComponent(data));
  }

  private static async decompress(data: string): Promise<string> {
    try {
      return decodeURIComponent(atob(data));
    } catch {
      return data; // Return as-is if decompression fails
    }
  }

  private static startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private static stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  SecureLocalStorage.initialize();
}