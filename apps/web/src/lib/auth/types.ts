export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  profilePicture?: string;
  lastLoginAt: string;
  emailVerified: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  acceptTerms: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: number;
}

export interface AuthConfig {
  tokenStorageKey: string;
  refreshTokenStorageKey: string;
  userStorageKey: string;
  refreshThreshold: number; // Minutes before expiry to refresh
  maxRetries: number;
  sessionTimeout: number; // Minutes of inactivity before logout
  rememberMeDuration: number; // Days to remember user
  secureStorage: boolean;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string>;
  updateUser: (updates: Partial<AuthUser>) => void;
  clearError: () => void;
  checkPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  isTokenExpired: () => boolean;
  getTimeUntilExpiry: () => number;
}

export enum UserRole {
  STUDENT = 'student',
  EDUCATOR = 'educator',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  PARENT = 'parent'
}

export enum Permission {
  // Content permissions
  CREATE_CONTENT = 'create_content',
  EDIT_CONTENT = 'edit_content',
  DELETE_CONTENT = 'delete_content',
  MODERATE_CONTENT = 'moderate_content',
  
  // User management
  MANAGE_USERS = 'manage_users',
  VIEW_USER_ANALYTICS = 'view_user_analytics',
  
  // Learning paths
  CREATE_LEARNING_PATH = 'create_learning_path',
  SHARE_LEARNING_PATH = 'share_learning_path',
  
  // Collaboration
  CREATE_STUDY_GROUP = 'create_study_group',
  JOIN_STUDY_GROUP = 'join_study_group',
  MODERATE_STUDY_GROUP = 'moderate_study_group',
  
  // Analytics
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_DATA = 'export_data',
  
  // Administration
  MANAGE_PLATFORM = 'manage_platform',
  VIEW_SYSTEM_LOGS = 'view_system_logs'
}

export interface AuthError {
  code: string;
  message: string;
  details?: any;
}

export interface SecureStorageOptions {
  encrypt?: boolean;
  expiresAt?: number;
  domain?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}