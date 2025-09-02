import { RateLimitError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

// Simple in-memory rate limiter
const rateLimitStore = new Map();

export const rateLimiter = (req, res, next) => {
  const clientId = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100; // Max requests per window
  
  // Get client's rate limit info
  const clientInfo = rateLimitStore.get(clientId) || {
    requests: 0,
    resetTime: now + windowMs
  };
  
  // Reset if window has passed
  if (now > clientInfo.resetTime) {
    clientInfo.requests = 0;
    clientInfo.resetTime = now + windowMs;
  }
  
  // Check if limit exceeded
  if (clientInfo.requests >= maxRequests) {
    logger.warn(`Rate limit exceeded for client: ${clientId}`);
    throw new RateLimitError('Rate limit exceeded. Please try again later.');
  }
  
  // Increment request count
  clientInfo.requests++;
  rateLimitStore.set(clientId, clientInfo);
  
  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': maxRequests,
    'X-RateLimit-Remaining': maxRequests - clientInfo.requests,
    'X-RateLimit-Reset': clientInfo.resetTime
  });
  
  next();
};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, info] of rateLimitStore.entries()) {
    if (now > info.resetTime) {
      rateLimitStore.delete(clientId);
    }
  }
}, 60 * 1000); // Clean up every minute 