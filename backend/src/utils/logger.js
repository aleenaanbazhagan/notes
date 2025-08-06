const winston = require('winston');
const MongoDB = require('winston-mongodb').MongoDB;
require('dotenv').config();

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(logColors);

// Create logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
  ),
  defaultMeta: {
    service: 'insider-threat-api',
    version: '1.0.0'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      )
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/app.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // File transport for error logs only
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // File transport for security events
    new winston.transports.File({
      filename: 'logs/security.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          if (meta.type === 'security' || meta.category === 'security') {
            return JSON.stringify({ timestamp, level, message, ...meta });
          }
          return false;
        })
      )
    })
  ]
};

// Add MongoDB transport if enabled and URI is provided
if (process.env.MONGODB_URI && process.env.ENABLE_AUDIT_LOGGING === 'true') {
  loggerConfig.transports.push(
    new MongoDB({
      db: process.env.MONGODB_URI,
      collection: 'audit_logs',
      level: 'info',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  );
}

const logger = winston.createLogger(loggerConfig);

// Security-specific logging functions
const securityLogger = {
  // Authentication events
  loginAttempt: (userId, ip, userAgent, success = false) => {
    logger.info('Login attempt', {
      type: 'security',
      category: 'authentication',
      event: 'login_attempt',
      userId,
      ip,
      userAgent,
      success,
      timestamp: new Date().toISOString()
    });
  },

  loginSuccess: (userId, ip, userAgent) => {
    logger.info('Successful login', {
      type: 'security',
      category: 'authentication',
      event: 'login_success',
      userId,
      ip,
      userAgent,
      timestamp: new Date().toISOString()
    });
  },

  loginFailure: (userId, ip, userAgent, reason) => {
    logger.warn('Failed login attempt', {
      type: 'security',
      category: 'authentication',
      event: 'login_failure',
      userId,
      ip,
      userAgent,
      reason,
      timestamp: new Date().toISOString()
    });
  },

  logout: (userId, ip) => {
    logger.info('User logout', {
      type: 'security',
      category: 'authentication',
      event: 'logout',
      userId,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  // Access control events
  accessDenied: (userId, resource, action, ip) => {
    logger.warn('Access denied', {
      type: 'security',
      category: 'access_control',
      event: 'access_denied',
      userId,
      resource,
      action,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  privilegeEscalation: (userId, fromRole, toRole, ip) => {
    logger.warn('Privilege escalation attempt', {
      type: 'security',
      category: 'access_control',
      event: 'privilege_escalation',
      userId,
      fromRole,
      toRole,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  // Data access events
  dataAccess: (userId, dataType, dataId, action, ip) => {
    logger.info('Data access', {
      type: 'security',
      category: 'data_access',
      event: 'data_access',
      userId,
      dataType,
      dataId,
      action,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  sensitiveDataAccess: (userId, dataType, dataId, classification, ip) => {
    logger.warn('Sensitive data access', {
      type: 'security',
      category: 'data_access',
      event: 'sensitive_data_access',
      userId,
      dataType,
      dataId,
      classification,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  // Anomaly detection
  anomalyDetected: (userId, anomalyType, score, details, ip) => {
    logger.warn('Anomaly detected', {
      type: 'security',
      category: 'anomaly_detection',
      event: 'anomaly_detected',
      userId,
      anomalyType,
      score,
      details,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  // System events
  configurationChange: (userId, setting, oldValue, newValue, ip) => {
    logger.warn('Configuration change', {
      type: 'security',
      category: 'system',
      event: 'configuration_change',
      userId,
      setting,
      oldValue,
      newValue,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  securityPolicyViolation: (userId, policy, violation, ip) => {
    logger.error('Security policy violation', {
      type: 'security',
      category: 'policy',
      event: 'policy_violation',
      userId,
      policy,
      violation,
      ip,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  logger,
  securityLogger
};