// Data encryption utilities
export {
  DataEncryption,
  SecureFormData,
  SecureTransmission
} from './data-encryption';

export type {
  EncryptionResult,
  DecryptionOptions
} from './data-encryption';

// HTTPS enforcement and secure communication
export {
  HttpsEnforcement,
  SecureCookies
} from './https-enforcement';

export type {
  SecurityHeaders,
  SecureRequestOptions
} from './https-enforcement';

// Secure local storage
export {
  SecureLocalStorage
} from './secure-local-storage';

export type {
  SecureStorageItem,
  SecureStorageOptions
} from './secure-local-storage';

// Import classes for security utilities
import { DataEncryption, SecureFormData, SecureTransmission } from './data-encryption';
import { HttpsEnforcement, SecureCookies } from './https-enforcement';
import { SecureLocalStorage } from './secure-local-storage';

// Security utilities
export const security = {
  // Data encryption
  encrypt: DataEncryption.encrypt.bind(DataEncryption),
  decrypt: DataEncryption.decrypt.bind(DataEncryption),
  hash: DataEncryption.hash.bind(DataEncryption),
  verifyHash: DataEncryption.verifyHash.bind(DataEncryption),
  generatePassword: DataEncryption.generateSecurePassword.bind(DataEncryption),

  // Form data security
  encryptFormData: SecureFormData.encryptSensitiveFields.bind(SecureFormData),
  decryptFormData: SecureFormData.decryptSensitiveFields.bind(SecureFormData),
  sanitizeForLogging: SecureFormData.sanitizeForLogging.bind(SecureFormData),

  // Secure transmission
  prepareTransmission: SecureTransmission.prepareForTransmission.bind(SecureTransmission),
  verifyTransmission: SecureTransmission.verifyTransmission.bind(SecureTransmission),

  // HTTPS enforcement
  isSecure: HttpsEnforcement.isSecureConnection.bind(HttpsEnforcement),
  enforceHttps: HttpsEnforcement.enforceHttps.bind(HttpsEnforcement),
  secureFetch: HttpsEnforcement.secureFetch.bind(HttpsEnforcement),
  setSecurityHeaders: HttpsEnforcement.setSecurityHeaders.bind(HttpsEnforcement),

  // Secure cookies
  setCookie: SecureCookies.set.bind(SecureCookies),
  getCookie: SecureCookies.get.bind(SecureCookies),
  removeCookie: SecureCookies.remove.bind(SecureCookies),
  areCookiesEnabled: SecureCookies.isEnabled.bind(SecureCookies),

  // Secure storage
  setSecure: SecureLocalStorage.set.bind(SecureLocalStorage),
  getSecure: SecureLocalStorage.get.bind(SecureLocalStorage),
  removeSecure: SecureLocalStorage.remove.bind(SecureLocalStorage),
  hasSecure: SecureLocalStorage.has.bind(SecureLocalStorage),
  clearSecure: SecureLocalStorage.clear.bind(SecureLocalStorage),
  getStorageStats: SecureLocalStorage.getStorageStats.bind(SecureLocalStorage),
  cleanupStorage: SecureLocalStorage.cleanup.bind(SecureLocalStorage),
  exportData: SecureLocalStorage.exportData.bind(SecureLocalStorage),
  importData: SecureLocalStorage.importData.bind(SecureLocalStorage)
};