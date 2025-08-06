const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger, securityLogger } = require('../utils/logger');

// JWT token verification
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      securityLogger.accessDenied(null, req.path, req.method, req.ip);
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user and check if still active
      const user = await User.findById(decoded.userId).select('+mfaSecret');
      
      if (!user || !user.isActive) {
        securityLogger.accessDenied(decoded.userId, req.path, req.method, req.ip);
        return res.status(401).json({
          error: 'Access denied. User not found or inactive.',
          code: 'USER_INACTIVE'
        });
      }
      
      // Check if account is locked
      if (user.isAccountLocked) {
        securityLogger.accessDenied(user._id, req.path, req.method, req.ip);
        return res.status(423).json({
          error: 'Account is temporarily locked due to multiple failed login attempts.',
          code: 'ACCOUNT_LOCKED',
          lockUntil: user.lockUntil
        });
      }
      
      // Check if password was changed after token was issued
      if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
        securityLogger.accessDenied(user._id, req.path, req.method, req.ip);
        return res.status(401).json({
          error: 'Password was changed. Please log in again.',
          code: 'PASSWORD_CHANGED'
        });
      }
      
      // Update session activity
      if (decoded.sessionId) {
        await user.updateSessionActivity(decoded.sessionId);
      }
      
      // Attach user to request
      req.user = user;
      req.sessionId = decoded.sessionId;
      
      // Log data access for audit trail
      securityLogger.dataAccess(
        user._id,
        'api_endpoint',
        req.path,
        req.method,
        req.ip
      );
      
      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token', {
        error: jwtError.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    
    return res.status(500).json({
      error: 'Authentication error occurred.',
      code: 'AUTH_ERROR'
    });
  }
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const userRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!userRoles.includes(req.user.role)) {
      securityLogger.accessDenied(
        req.user._id,
        req.path,
        req.method,
        req.ip
      );
      
      return res.status(403).json({
        error: 'Insufficient permissions.',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: userRoles,
        current: req.user.role
      });
    }
    
    next();
  };
};

// Permission-based access control
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!req.user.hasPermission(resource, action)) {
      securityLogger.accessDenied(
        req.user._id,
        `${resource}:${action}`,
        req.method,
        req.ip
      );
      
      return res.status(403).json({
        error: 'Insufficient permissions.',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: `${resource}:${action}`
      });
    }
    
    next();
  };
};

// Multi-factor authentication check
const requireMFA = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required.',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Check if MFA is required but not completed
  if (req.user.mfaEnabled && !req.user.mfaVerified) {
    return res.status(403).json({
      error: 'Multi-factor authentication required.',
      code: 'MFA_REQUIRED'
    });
  }
  
  next();
};

// Rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create user request history
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }
    
    const requests = userRequests.get(userId);
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    userRequests.set(userId, recentRequests);
    
    // Check if user has exceeded the limit
    if (recentRequests.length >= maxRequests) {
      securityLogger.securityPolicyViolation(
        userId,
        'rate_limit',
        `Exceeded ${maxRequests} requests in ${windowMs}ms`,
        req.ip
      );
      
      return res.status(429).json({
        error: 'Too many requests. Please slow down.',
        code: 'USER_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
      });
    }
    
    // Add current request timestamp
    recentRequests.push(now);
    
    next();
  };
};

// Check for suspicious activity
const detectSuspiciousActivity = (req, res, next) => {
  if (!req.user) {
    return next();
  }
  
  const user = req.user;
  const currentIP = req.ip;
  const currentUserAgent = req.get('User-Agent');
  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  
  const riskFactors = [];
  
  // Check for unusual IP address
  if (!user.behaviorProfile.commonIPAddresses.includes(currentIP)) {
    riskFactors.push({
      factor: 'unusual_ip_address',
      score: 15
    });
  }
  
  // Check for unusual user agent
  if (!user.behaviorProfile.commonUserAgents.includes(currentUserAgent)) {
    riskFactors.push({
      factor: 'unusual_user_agent',
      score: 10
    });
  }
  
  // Check for access outside normal working hours
  const workStart = parseInt(user.behaviorProfile.normalWorkingHours.start.split(':')[0]);
  const workEnd = parseInt(user.behaviorProfile.normalWorkingHours.end.split(':')[0]);
  
  if (currentHour < workStart || currentHour > workEnd) {
    riskFactors.push({
      factor: 'outside_working_hours',
      score: 20
    });
  }
  
  // Check for rapid successive requests (potential automation)
  const lastActivity = user.activeSessions.find(s => s.sessionId === req.sessionId)?.lastActivity;
  if (lastActivity && (currentTime - lastActivity) < 1000) { // Less than 1 second
    riskFactors.push({
      factor: 'rapid_requests',
      score: 25
    });
  }
  
  // Update risk score if suspicious activity detected
  if (riskFactors.length > 0) {
    user.updateRiskScore(riskFactors).catch(error => {
      logger.error('Failed to update risk score', { error: error.message, userId: user._id });
    });
    
    // Log anomaly
    const totalRisk = riskFactors.reduce((sum, rf) => sum + rf.score, 0);
    securityLogger.anomalyDetected(
      user._id,
      'behavioral_anomaly',
      totalRisk,
      riskFactors,
      currentIP
    );
    
    // Block high-risk activities
    if (totalRisk > 50) {
      return res.status(403).json({
        error: 'Suspicious activity detected. Access temporarily restricted.',
        code: 'SUSPICIOUS_ACTIVITY',
        riskScore: totalRisk
      });
    }
  }
  
  next();
};

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without authentication
  }
  
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user && user.isActive && !user.isAccountLocked) {
      req.user = user;
      req.sessionId = decoded.sessionId;
    }
  } catch (error) {
    // Ignore token errors for optional auth
    logger.debug('Optional auth failed', { error: error.message });
  }
  
  next();
};

module.exports = {
  verifyToken,
  requireRole,
  requirePermission,
  requireMFA,
  userRateLimit,
  detectSuspiciousActivity,
  optionalAuth
};