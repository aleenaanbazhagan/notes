const { logger, securityLogger } = require('../utils/logger');

const auditLogger = (req, res, next) => {
  // Store original response methods
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;
  
  // Track request start time
  const startTime = Date.now();
  
  // Capture request data
  const requestData = {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    timestamp: new Date().toISOString(),
    userId: req.user?._id,
    sessionId: req.sessionId,
    headers: {
      'content-type': req.get('Content-Type'),
      'content-length': req.get('Content-Length'),
      'accept': req.get('Accept'),
      'accept-encoding': req.get('Accept-Encoding'),
      'accept-language': req.get('Accept-Language')
    }
  };

  // Capture sensitive operations
  const sensitiveOperations = [
    'login', 'logout', 'register', 'password', 'mfa', 'admin', 'delete', 'update', 'create'
  ];
  
  const isSensitiveOperation = sensitiveOperations.some(op => 
    req.path.toLowerCase().includes(op) || req.originalUrl.toLowerCase().includes(op)
  );

  // Don't log request body for sensitive operations to avoid logging passwords
  if (!isSensitiveOperation && req.body && Object.keys(req.body).length > 0) {
    requestData.body = req.body;
  }

  // Response data container
  let responseData = {
    statusCode: null,
    responseTime: null,
    responseSize: null
  };

  // Override res.status to capture status code
  res.status = function(code) {
    responseData.statusCode = code;
    return originalStatus.call(this, code);
  };

  // Override res.send to capture response
  res.send = function(data) {
    responseData.statusCode = responseData.statusCode || res.statusCode;
    responseData.responseTime = Date.now() - startTime;
    responseData.responseSize = Buffer.byteLength(data || '', 'utf8');
    
    // Log the audit entry
    logAuditEntry(requestData, responseData, data);
    
    return originalSend.call(this, data);
  };

  // Override res.json to capture JSON responses
  res.json = function(data) {
    responseData.statusCode = responseData.statusCode || res.statusCode;
    responseData.responseTime = Date.now() - startTime;
    responseData.responseSize = Buffer.byteLength(JSON.stringify(data || {}), 'utf8');
    
    // Log the audit entry
    logAuditEntry(requestData, responseData, data);
    
    return originalJson.call(this, data);
  };

  function logAuditEntry(request, response, responseBody) {
    const auditEntry = {
      type: 'audit',
      category: 'api_access',
      event: 'http_request',
      request: {
        method: request.method,
        url: request.url,
        path: request.path,
        query: request.query,
        ip: request.ip,
        userAgent: request.userAgent,
        referer: request.referer,
        headers: request.headers,
        timestamp: request.timestamp,
        userId: request.userId,
        sessionId: request.sessionId
      },
      response: {
        statusCode: response.statusCode,
        responseTime: response.responseTime,
        responseSize: response.responseSize,
        timestamp: new Date().toISOString()
      }
    };

    // Add request body for non-sensitive operations
    if (request.body) {
      auditEntry.request.body = request.body;
    }

    // Determine log level based on status code and operation
    let logLevel = 'info';
    let logMessage = `${request.method} ${request.path}`;

    if (response.statusCode >= 500) {
      logLevel = 'error';
      logMessage = `Server error: ${logMessage}`;
    } else if (response.statusCode >= 400) {
      logLevel = 'warn';
      logMessage = `Client error: ${logMessage}`;
      
      // Log security events for authentication/authorization failures
      if (response.statusCode === 401 || response.statusCode === 403) {
        securityLogger.accessDenied(
          request.userId,
          request.path,
          request.method,
          request.ip
        );
      }
    } else if (isSensitiveOperation) {
      logLevel = 'warn';
      logMessage = `Sensitive operation: ${logMessage}`;
    }

    // Log based on determined level
    logger[logLevel](logMessage, auditEntry);

    // Additional logging for specific scenarios
    if (request.userId) {
      // Track data access for compliance
      securityLogger.dataAccess(
        request.userId,
        'api_endpoint',
        request.path,
        request.method,
        request.ip
      );

      // Log high-risk activities
      if (isHighRiskActivity(request, response)) {
        securityLogger.anomalyDetected(
          request.userId,
          'high_risk_activity',
          calculateRiskScore(request, response),
          {
            operation: `${request.method} ${request.path}`,
            statusCode: response.statusCode,
            responseTime: response.responseTime,
            unusual_factors: getUnusualFactors(request, response)
          },
          request.ip
        );
      }
    }

    // Log failed operations for security monitoring
    if (response.statusCode >= 400) {
      const errorDetails = {
        operation: `${request.method} ${request.path}`,
        statusCode: response.statusCode,
        userId: request.userId,
        ip: request.ip,
        userAgent: request.userAgent,
        timestamp: new Date().toISOString()
      };

      // Try to extract error message from response
      if (responseBody && typeof responseBody === 'object' && responseBody.error) {
        errorDetails.errorMessage = responseBody.error;
        errorDetails.errorCode = responseBody.code;
      }

      logger.warn('Operation failed', errorDetails);
    }

    // Performance monitoring
    if (response.responseTime > 5000) { // Log slow requests (>5 seconds)
      logger.warn('Slow request detected', {
        method: request.method,
        path: request.path,
        responseTime: response.responseTime,
        userId: request.userId,
        ip: request.ip
      });
    }
  }

  function isHighRiskActivity(request, response) {
    const highRiskPaths = [
      '/admin', '/users/delete', '/users/role', '/security/config',
      '/data/export', '/audit/delete', '/mfa/disable'
    ];
    
    const isHighRiskPath = highRiskPaths.some(path => 
      request.path.includes(path)
    );
    
    const isHighRiskMethod = ['DELETE', 'PUT', 'PATCH'].includes(request.method);
    const isOffHours = isOutsideBusinessHours();
    const hasMultipleFailures = response.statusCode >= 400;
    
    return isHighRiskPath || (isHighRiskMethod && isOffHours) || hasMultipleFailures;
  }

  function calculateRiskScore(request, response) {
    let score = 0;
    
    // Base score for different operations
    if (request.method === 'DELETE') score += 30;
    else if (request.method === 'PUT' || request.method === 'PATCH') score += 20;
    else if (request.method === 'POST') score += 10;
    
    // Status code penalties
    if (response.statusCode >= 500) score += 25;
    else if (response.statusCode >= 400) score += 15;
    
    // Time-based risk
    if (isOutsideBusinessHours()) score += 20;
    if (isWeekend()) score += 10;
    
    // Performance-based risk
    if (response.responseTime > 10000) score += 15;
    
    return Math.min(score, 100);
  }

  function getUnusualFactors(request, response) {
    const factors = [];
    
    if (isOutsideBusinessHours()) factors.push('outside_business_hours');
    if (isWeekend()) factors.push('weekend_access');
    if (response.responseTime > 10000) factors.push('slow_response');
    if (response.statusCode >= 400) factors.push('error_response');
    if (request.method === 'DELETE') factors.push('delete_operation');
    
    return factors;
  }

  function isOutsideBusinessHours() {
    const now = new Date();
    const hour = now.getHours();
    return hour < 8 || hour > 18; // Outside 8 AM - 6 PM
  }

  function isWeekend() {
    const now = new Date();
    const day = now.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  next();
};

module.exports = auditLogger;