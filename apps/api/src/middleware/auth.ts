import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      message: 'Please provide a valid access token'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (error: any) {
    logger.warn('Invalid token attempt:', { token: token.substring(0, 20) + '...', error: error.message });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Access token has expired, please refresh'
      });
    }
    
    return res.status(403).json({
      error: 'Invalid token',
      message: 'The provided token is invalid'
    });
  }
};

export const generateTokens = (userId: string, email: string, role?: string) => {
  const payload = { userId, email, role };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m' // Short-lived access token
  });
  
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '7d' // Longer-lived refresh token
  });
  
  return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch (error: any) {
    logger.warn('Invalid refresh token:', error.message);
    return null;
  }
};

// Role-based access control middleware
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    const userRole = req.user.role || 'user';
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Required role: ${roles.join(' or ')}, current role: ${userRole}`
      });
    }

    next();
  };
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error: any) {
    // Silently ignore invalid tokens for optional auth
    logger.debug('Optional auth failed:', error.message);
  }

  next();
};