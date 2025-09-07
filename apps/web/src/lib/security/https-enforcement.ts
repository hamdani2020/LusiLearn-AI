/**
 * HTTPS enforcement and secure communication utilities
 */

export interface SecurityHeaders {
  'Strict-Transport-Security'?: string;
  'Content-Security-Policy'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Referrer-Policy'?: string;
}

export interface SecureRequestOptions {
  enforceHttps?: boolean;
  validateCertificate?: boolean;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export class HttpsEnforcement {
  private static readonly SECURITY_HEADERS: SecurityHeaders = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self' https:; object-src 'none'; frame-src 'none';",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };

  /**
   * Check if current connection is secure
   */
  static isSecureConnection(): boolean {
    if (typeof window === 'undefined') {
      return true; // Assume secure in server-side rendering
    }

    return window.location.protocol === 'https:' || 
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
  }

  /**
   * Enforce HTTPS redirect
   */
  static enforceHttps(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (!this.isSecureConnection() && window.location.hostname !== 'localhost') {
      const httpsUrl = window.location.href.replace('http://', 'https://');
      window.location.replace(httpsUrl);
    }
  }

  /**
   * Validate URL is HTTPS
   */
  static validateHttpsUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:' || 
             urlObj.hostname === 'localhost' ||
             urlObj.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }

  /**
   * Create secure fetch wrapper
   */
  static async secureFetch(
    url: string, 
    options: RequestInit & SecureRequestOptions = {}
  ): Promise<Response> {
    const {
      enforceHttps = true,
      validateCertificate = true,
      timeout = 30000,
      retries = 3,
      headers = {},
      ...fetchOptions
    } = options;

    // Validate HTTPS if enforced
    if (enforceHttps && !this.validateHttpsUrl(url)) {
      throw new Error('HTTPS is required for secure communication');
    }

    // Add security headers
    const secureHeaders = {
      ...this.getSecurityHeaders(),
      ...headers
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.fetchWithRetry(url, {
        ...fetchOptions,
        headers: secureHeaders,
        signal: controller.signal
      }, retries);

      clearTimeout(timeoutId);

      // Validate response security
      this.validateResponseSecurity(response);

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Fetch with retry logic
   */
  private static async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number
  ): Promise<Response> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return response;
        }

        // Retry on server errors (5xx) or network errors
        if (response.ok || attempt === retries) {
          return response;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Get security headers for requests
   */
  private static getSecurityHeaders(): Record<string, string> {
    return {
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
  }

  /**
   * Validate response security
   */
  private static validateResponseSecurity(response: Response): void {
    // Check for security headers in response
    const securityHeaders = [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options'
    ];

    const missingHeaders = securityHeaders.filter(header => 
      !response.headers.has(header)
    );

    if (missingHeaders.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn('Missing security headers:', missingHeaders);
    }

    // Validate content type
    const contentType = response.headers.get('content-type');
    if (contentType && !this.isValidContentType(contentType)) {
      console.warn('Potentially unsafe content type:', contentType);
    }
  }

  /**
   * Check if content type is safe
   */
  private static isValidContentType(contentType: string): boolean {
    const safeTypes = [
      'application/json',
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'image/',
      'font/',
      'audio/',
      'video/'
    ];

    return safeTypes.some(type => contentType.toLowerCase().startsWith(type));
  }

  /**
   * Create Content Security Policy
   */
  static createCSP(options: {
    allowInlineScripts?: boolean;
    allowInlineStyles?: boolean;
    allowEval?: boolean;
    additionalSources?: {
      script?: string[];
      style?: string[];
      img?: string[];
      connect?: string[];
    };
  } = {}): string {
    const {
      allowInlineScripts = false,
      allowInlineStyles = false,
      allowEval = false,
      additionalSources = {}
    } = options;

    const directives: Record<string, string[]> = {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'", 'https:'],
      'media-src': ["'self'", 'https:'],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    };

    // Add inline script support if needed
    if (allowInlineScripts) {
      directives['script-src'].push("'unsafe-inline'");
    }

    // Add eval support if needed (not recommended)
    if (allowEval) {
      directives['script-src'].push("'unsafe-eval'");
    }

    // Add inline style support if needed
    if (allowInlineStyles) {
      directives['style-src'].push("'unsafe-inline'");
    }

    // Add additional sources
    Object.entries(additionalSources).forEach(([directive, sources]) => {
      const directiveKey = `${directive}-src`;
      if (directives[directiveKey]) {
        directives[directiveKey].push(...sources);
      }
    });

    // Build CSP string
    return Object.entries(directives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  /**
   * Set security headers for the application
   */
  static setSecurityHeaders(): void {
    if (typeof document === 'undefined') {
      return;
    }

    // Create meta tags for security headers
    const headers = [
      { name: 'X-Content-Type-Options', content: 'nosniff' },
      { name: 'X-Frame-Options', content: 'DENY' },
      { name: 'X-XSS-Protection', content: '1; mode=block' },
      { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' }
    ];

    headers.forEach(({ name, content }) => {
      let meta = document.querySelector(`meta[http-equiv="${name}"]`) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.httpEquiv = name;
        document.head.appendChild(meta);
      }
      
      meta.content = content;
    });

    // Set CSP meta tag
    let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]') as HTMLMetaElement;
    
    if (!cspMeta) {
      cspMeta = document.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      document.head.appendChild(cspMeta);
    }
    
    cspMeta.content = this.createCSP({
      allowInlineScripts: process.env.NODE_ENV === 'development',
      allowInlineStyles: true,
      additionalSources: {
        script: ['https://cdn.jsdelivr.net'],
        style: ['https://fonts.googleapis.com'],
        img: ['https://images.unsplash.com', 'https://via.placeholder.com'],
        connect: [process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000']
      }
    });
  }
}

/**
 * Secure cookie management
 */
export class SecureCookies {
  /**
   * Set a secure cookie
   */
  static set(
    name: string,
    value: string,
    options: {
      expires?: Date;
      maxAge?: number;
      domain?: string;
      path?: string;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
    } = {}
  ): void {
    if (typeof document === 'undefined') {
      return;
    }

    const {
      expires,
      maxAge,
      domain,
      path = '/',
      secure = HttpsEnforcement.isSecureConnection(),
      httpOnly = false,
      sameSite = 'strict'
    } = options;

    let cookieString = `${name}=${encodeURIComponent(value)}; Path=${path}`;

    if (expires) {
      cookieString += `; Expires=${expires.toUTCString()}`;
    }

    if (maxAge !== undefined) {
      cookieString += `; Max-Age=${maxAge}`;
    }

    if (domain) {
      cookieString += `; Domain=${domain}`;
    }

    if (secure) {
      cookieString += '; Secure';
    }

    if (httpOnly) {
      cookieString += '; HttpOnly';
    }

    cookieString += `; SameSite=${sameSite}`;

    document.cookie = cookieString;
  }

  /**
   * Get a cookie value
   */
  static get(name: string): string | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const cookies = document.cookie.split(';');
    
    for (const cookie of cookies) {
      const [cookieName, cookieValue] = cookie.trim().split('=');
      if (cookieName === name) {
        return decodeURIComponent(cookieValue);
      }
    }

    return null;
  }

  /**
   * Remove a cookie
   */
  static remove(name: string, options: { domain?: string; path?: string } = {}): void {
    this.set(name, '', {
      ...options,
      expires: new Date(0)
    });
  }

  /**
   * Check if cookies are enabled
   */
  static isEnabled(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }

    try {
      const testCookie = 'test_cookie';
      this.set(testCookie, 'test');
      const enabled = this.get(testCookie) === 'test';
      this.remove(testCookie);
      return enabled;
    } catch {
      return false;
    }
  }
}