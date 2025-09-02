import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { UnauthorizedError } from './errorHandler.js';

export const authMiddleware = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Add user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };
    
    next();
    
  } catch (error) {
    logger.warn('Authentication failed:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token expired');
    } else {
      throw error;
    }
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    
    if (!roles.includes(req.user.role)) {
      throw new UnauthorizedError('Insufficient permissions');
    }
    
    next();
  };
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    
    if (!req.user.permissions.includes(permission)) {
      throw new UnauthorizedError('Insufficient permissions');
    }
    
    next();
  };
};

// Mock authentication for development
export const mockAuthMiddleware = (req, res, next) => {
  // In development, create a mock user
  req.user = {
    id: 'mock-user-id',
    email: 'admin@bp.com',
    role: 'admin',
    permissions: ['read', 'write', 'delete', 'admin']
  };
  
  next();
}; 