const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

const User = require('../models/User');
const { logger, securityLogger } = require('../utils/logger');
const { verifyToken, requireMFA } = require('../middleware/auth');

const router = express.Router();

// Generate session ID
const generateSessionId = () => crypto.randomBytes(32).toString('hex');

// Validation middleware
const validateRegistration = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
  body('firstName')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Last name is required and must be less than 50 characters')
];

const validateLogin = [
  body('login')
    .notEmpty()
    .withMessage('Username or email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Register new user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, department, jobTitle } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      securityLogger.loginFailure(null, req.ip, req.get('User-Agent'), 'User already exists');
      return res.status(409).json({
        error: 'User with this email or username already exists',
        code: 'USER_EXISTS'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      department,
      jobTitle,
      behaviorProfile: {
        commonIPAddresses: [req.ip],
        commonUserAgents: [req.get('User-Agent')]
      }
    });

    await user.save();

    logger.info('New user registered', {
      userId: user._id,
      username: user.username,
      email: user.email,
      ip: req.ip
    });

    // Return user data without sensitive information
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt
    };

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse
    });

  } catch (error) {
    logger.error('Registration error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { login, password, mfaToken, backupCode } = req.body;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    // Find user by username or email
    const user = await User.findByCredentials(login, password);

    if (!user) {
      securityLogger.loginFailure(null, ip, userAgent, 'Invalid credentials');
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.isAccountLocked) {
      securityLogger.loginFailure(user._id, ip, userAgent, 'Account locked');
      return res.status(423).json({
        error: 'Account is temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED',
        lockUntil: user.lockUntil
      });
    }

    // Check if account is active
    if (!user.isActive) {
      securityLogger.loginFailure(user._id, ip, userAgent, 'Account inactive');
      return res.status(401).json({
        error: 'Account is inactive. Please contact administrator.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      let mfaValid = false;

      if (mfaToken) {
        mfaValid = user.verifyMFAToken(mfaToken);
      } else if (backupCode) {
        mfaValid = user.useBackupCode(backupCode);
        if (mfaValid) {
          await user.save(); // Save the used backup code
        }
      }

      if (!mfaValid) {
        // Increment failed attempts
        await user.incrementLoginAttempts();
        securityLogger.loginFailure(user._id, ip, userAgent, 'Invalid MFA token');
        
        return res.status(401).json({
          error: 'Invalid multi-factor authentication code',
          code: 'INVALID_MFA',
          mfaRequired: true
        });
      }
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Generate session ID and JWT
    const sessionId = generateSessionId();
    const token = jwt.sign(
      { 
        userId: user._id,
        sessionId,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { 
        userId: user._id,
        sessionId,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );

    // Update user login information
    user.lastLogin = new Date();
    user.lastLoginIP = ip;
    user.lastLoginUserAgent = userAgent;
    
    // Add to active sessions
    await user.addActiveSession(sessionId, ip, userAgent);

    // Update behavior profile
    if (!user.behaviorProfile.commonIPAddresses.includes(ip)) {
      user.behaviorProfile.commonIPAddresses.push(ip);
      if (user.behaviorProfile.commonIPAddresses.length > 10) {
        user.behaviorProfile.commonIPAddresses = user.behaviorProfile.commonIPAddresses.slice(-10);
      }
    }

    if (!user.behaviorProfile.commonUserAgents.includes(userAgent)) {
      user.behaviorProfile.commonUserAgents.push(userAgent);
      if (user.behaviorProfile.commonUserAgents.length > 5) {
        user.behaviorProfile.commonUserAgents = user.behaviorProfile.commonUserAgents.slice(-5);
      }
    }

    await user.save();

    securityLogger.loginSuccess(user._id, ip, userAgent);

    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive,
      isVerified: user.isVerified,
      mfaEnabled: user.mfaEnabled,
      riskScore: user.riskScore,
      lastLogin: user.lastLogin,
      complianceStatus: user.complianceStatus
    };

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: userResponse,
      sessionId
    });

  } catch (error) {
    logger.error('Login error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// Logout user
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const sessionId = req.sessionId;

    // Remove active session
    if (sessionId) {
      await user.removeActiveSession(sessionId);
    }

    securityLogger.logout(user._id, req.ip);

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      userId: req.user?._id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token is required',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    // Generate new tokens
    const newToken = jwt.sign(
      { 
        userId: user._id,
        sessionId: decoded.sessionId,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    const newRefreshToken = jwt.sign(
      { 
        userId: user._id,
        sessionId: decoded.sessionId,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    logger.error('Token refresh error', {
      error: error.message,
      ip: req.ip
    });

    res.status(401).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

// Setup MFA
router.post('/mfa/setup', verifyToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.mfaEnabled) {
      return res.status(400).json({
        error: 'MFA is already enabled',
        code: 'MFA_ALREADY_ENABLED'
      });
    }

    // Generate MFA secret
    const secret = user.generateMFASecret();
    await user.save();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    logger.info('MFA setup initiated', {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'MFA setup initiated',
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes: user.generateBackupCodes()
    });

  } catch (error) {
    logger.error('MFA setup error', {
      error: error.message,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'MFA setup failed',
      code: 'MFA_SETUP_ERROR'
    });
  }
});

// Verify and enable MFA
router.post('/mfa/verify', verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    const user = req.user;

    if (!token) {
      return res.status(400).json({
        error: 'MFA token is required',
        code: 'MFA_TOKEN_REQUIRED'
      });
    }

    if (user.mfaEnabled) {
      return res.status(400).json({
        error: 'MFA is already enabled',
        code: 'MFA_ALREADY_ENABLED'
      });
    }

    // Verify the token
    const isValid = user.verifyMFAToken(token);

    if (!isValid) {
      securityLogger.loginFailure(user._id, req.ip, req.get('User-Agent'), 'Invalid MFA verification token');
      return res.status(401).json({
        error: 'Invalid MFA token',
        code: 'INVALID_MFA_TOKEN'
      });
    }

    // Enable MFA
    user.mfaEnabled = true;
    const backupCodes = user.generateBackupCodes();
    await user.save();

    securityLogger.configurationChange(
      user._id,
      'mfa_enabled',
      false,
      true,
      req.ip
    );

    logger.info('MFA enabled', {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'MFA enabled successfully',
      backupCodes
    });

  } catch (error) {
    logger.error('MFA verification error', {
      error: error.message,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'MFA verification failed',
      code: 'MFA_VERIFICATION_ERROR'
    });
  }
});

// Disable MFA
router.post('/mfa/disable', verifyToken, requireMFA, async (req, res) => {
  try {
    const { password, token } = req.body;
    const user = req.user;

    if (!user.mfaEnabled) {
      return res.status(400).json({
        error: 'MFA is not enabled',
        code: 'MFA_NOT_ENABLED'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid password',
        code: 'INVALID_PASSWORD'
      });
    }

    // Verify MFA token
    const isMFAValid = user.verifyMFAToken(token);
    if (!isMFAValid) {
      return res.status(401).json({
        error: 'Invalid MFA token',
        code: 'INVALID_MFA_TOKEN'
      });
    }

    // Disable MFA
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.backupCodes = [];
    await user.save();

    securityLogger.configurationChange(
      user._id,
      'mfa_enabled',
      true,
      false,
      req.ip
    );

    logger.warn('MFA disabled', {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'MFA disabled successfully'
    });

  } catch (error) {
    logger.error('MFA disable error', {
      error: error.message,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'MFA disable failed',
      code: 'MFA_DISABLE_ERROR'
    });
  }
});

// Get current user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = req.user;

    const userProfile = {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive,
      isVerified: user.isVerified,
      mfaEnabled: user.mfaEnabled,
      riskScore: user.riskScore,
      lastLogin: user.lastLogin,
      lastLoginIP: user.lastLoginIP,
      complianceStatus: user.complianceStatus,
      department: user.department,
      jobTitle: user.jobTitle,
      dataClassificationAccess: user.dataClassificationAccess,
      activeSessions: user.activeSessions.filter(s => s.isActive).length,
      createdAt: user.createdAt
    };

    res.json({
      user: userProfile
    });

  } catch (error) {
    logger.error('Profile fetch error', {
      error: error.message,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to fetch profile',
      code: 'PROFILE_FETCH_ERROR'
    });
  }
});

// Change password
router.post('/change-password', verifyToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must meet security requirements')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      securityLogger.securityPolicyViolation(
        user._id,
        'password_change',
        'Invalid current password provided',
        req.ip
      );
      
      return res.status(401).json({
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    securityLogger.configurationChange(
      user._id,
      'password',
      'hidden',
      'hidden',
      req.ip
    );

    logger.info('Password changed', {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Password change error', {
      error: error.message,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Password change failed',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

module.exports = router;