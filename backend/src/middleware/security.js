const { logger } = require('../utils/logger');

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Remove sensitive headers that might leak server information
  res.removeHeader('X-Powered-By');
  
  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  next();
};

// Request validation middleware
const validateRequest = (req, res, next) => {
  // Check for suspicious patterns in request
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload=/gi,
    /onerror=/gi,
    /onclick=/gi,
    /%3Cscript/gi,
    /%3C\/script%3E/gi,
    /\.\.\//g,
    /\.\.\\+/g,
    /__proto__/gi,
    /constructor/gi,
    /prototype/gi
  ];

  const requestString = JSON.stringify({
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    headers: req.headers
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      logger.warn('Suspicious request detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        pattern: pattern.source,
        userId: req.user?._id
      });

      return res.status(400).json({
        error: 'Invalid request format',
        code: 'SUSPICIOUS_REQUEST'
      });
    }
  }

  next();
};

// File upload security middleware
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB default
  const files = req.files || [req.file];

  for (const file of files) {
    if (!file) continue;

    // Check file size
    if (file.size > maxFileSize) {
      return res.status(413).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize: maxFileSize
      });
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'File type not allowed',
        code: 'INVALID_FILE_TYPE',
        allowedTypes: allowedMimeTypes
      });
    }

    // Check for executable extensions
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
      '.sh', '.ps1', '.php', '.asp', '.jsp', '.py', '.rb', '.pl'
    ];

    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (dangerousExtensions.includes(fileExtension)) {
      return res.status(400).json({
        error: 'Executable files are not allowed',
        code: 'EXECUTABLE_FILE_BLOCKED'
      });
    }

    // Basic file content validation
    if (file.buffer) {
      // Check for executable signatures
      const executableSignatures = [
        'MZ', // DOS/Windows executable
        '\x7fELF', // Linux executable
        '\xca\xfe\xba\xbe', // Java class file
        '#!/bin/', // Shell script
        '#!/usr/', // Shell script
        '<?php', // PHP script
        '<script' // JavaScript
      ];

      const fileHeader = file.buffer.toString('ascii', 0, 20);
      for (const signature of executableSignatures) {
        if (fileHeader.includes(signature)) {
          return res.status(400).json({
            error: 'File contains executable content',
            code: 'EXECUTABLE_CONTENT_DETECTED'
          });
        }
      }
    }
  }

  next();
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      code: 'API_KEY_REQUIRED'
    });
  }

  // In production, validate against database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key used', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      apiKey: apiKey.substring(0, 8) + '...' // Log partial key for security
    });

    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  next();
};

// Request timeout middleware
const requestTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          url: req.originalUrl,
          method: req.method,
          ip: req.ip,
          timeout
        });

        res.status(408).json({
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT'
        });
      }
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    res.on('close', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// IP whitelist middleware
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip;
    
    if (allowedIPs.length === 0) {
      return next(); // No restriction if no IPs specified
    }

    const isAllowed = allowedIPs.some(allowedIP => {
      if (allowedIP.includes('/')) {
        // CIDR notation support (basic implementation)
        const [network, prefixLength] = allowedIP.split('/');
        // For production, use a proper CIDR library
        return clientIP.startsWith(network.substring(0, network.lastIndexOf('.')));
      }
      return clientIP === allowedIP;
    });

    if (!isAllowed) {
      logger.warn('IP not in whitelist', {
        ip: clientIP,
        allowedIPs,
        url: req.originalUrl
      });

      return res.status(403).json({
        error: 'Access denied from this IP address',
        code: 'IP_NOT_ALLOWED'
      });
    }

    next();
  };
};

// Content-Length validation
const validateContentLength = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxContentLength = 50 * 1024 * 1024; // 50MB

  if (contentLength > maxContentLength) {
    return res.status(413).json({
      error: 'Request entity too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  next();
};

// CORS validation middleware
const validateCORS = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  if (origin && !allowedOrigins.includes(origin)) {
    logger.warn('CORS violation detected', {
      origin,
      allowedOrigins,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(403).json({
      error: 'CORS policy violation',
      code: 'CORS_VIOLATION'
    });
  }

  next();
};

// Combined security middleware
const securityMiddleware = [
  securityHeaders,
  validateRequest,
  validateContentLength,
  validateCORS,
  requestTimeout(30000)
];

module.exports = {
  securityHeaders,
  validateRequest,
  validateFileUpload,
  validateApiKey,
  requestTimeout,
  ipWhitelist,
  validateContentLength,
  validateCORS,
  securityMiddleware: (req, res, next) => {
    // Apply all security middleware in sequence
    let index = 0;
    
    const runMiddleware = (err) => {
      if (err || index >= securityMiddleware.length) {
        return next(err);
      }
      
      const middleware = securityMiddleware[index++];
      middleware(req, res, runMiddleware);
    };
    
    runMiddleware();
  }
};