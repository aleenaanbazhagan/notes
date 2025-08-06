const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');

const userSchema = new mongoose.Schema({
  // Basic user information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  
  // Role-based access control
  role: {
    type: String,
    enum: ['user', 'admin', 'security_analyst', 'manager', 'super_admin'],
    default: 'user'
  },
  permissions: [{
    resource: String,
    actions: [String]
  }],
  
  // Security settings
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  mfaSecret: {
    type: String,
    select: false // Don't include in queries by default
  },
  backupCodes: [{
    code: String,
    used: { type: Boolean, default: false }
  }],
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockUntil: Date,
  
  // Security tracking
  loginAttempts: {
    type: Number,
    default: 0
  },
  lastLogin: Date,
  lastLoginIP: String,
  lastLoginUserAgent: String,
  passwordChangedAt: Date,
  failedLoginAttempts: [{
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Risk assessment
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  riskFactors: [{
    factor: String,
    score: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Behavioral analytics
  behaviorProfile: {
    normalWorkingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' }
    },
    commonIPAddresses: [String],
    commonUserAgents: [String],
    averageSessionDuration: { type: Number, default: 0 },
    typicalDataAccess: [String],
    accessPatterns: [{
      resource: String,
      frequency: Number,
      lastAccess: Date
    }]
  },
  
  // Data access tracking
  dataClassificationAccess: {
    public: { type: Boolean, default: true },
    internal: { type: Boolean, default: false },
    confidential: { type: Boolean, default: false },
    restricted: { type: Boolean, default: false }
  },
  
  // Session management
  activeSessions: [{
    sessionId: String,
    ip: String,
    userAgent: String,
    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
  }],
  
  // Compliance and audit
  lastSecurityTraining: Date,
  complianceStatus: {
    type: String,
    enum: ['compliant', 'non_compliant', 'pending'],
    default: 'pending'
  },
  
  // Metadata
  department: String,
  jobTitle: String,
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ riskScore: -1 });
userSchema.index({ lastLogin: -1 });

// Virtual for account lock status
userSchema.virtual('isAccountLocked').get(function() {
  return !!(this.isLocked && this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(parseInt(process.env.HASH_SALT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = new Date();
  }
  
  // Update timestamp
  this.updatedAt = new Date();
  
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateMFASecret = function() {
  const secret = speakeasy.generateSecret({
    name: `${process.env.MFA_ISSUER || 'InsiderThreatPrevention'}:${this.email}`,
    issuer: process.env.MFA_ISSUER || 'InsiderThreatPrevention',
    length: 32
  });
  
  this.mfaSecret = secret.base32;
  return secret;
};

userSchema.methods.verifyMFAToken = function(token) {
  return speakeasy.totp.verify({
    secret: this.mfaSecret,
    encoding: 'base32',
    token: token,
    window: parseInt(process.env.MFA_WINDOW) || 1
  });
};

userSchema.methods.generateBackupCodes = function() {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    codes.push({
      code: Math.random().toString(36).substring(2, 10).toUpperCase(),
      used: false
    });
  }
  this.backupCodes = codes;
  return codes.map(c => c.code);
};

userSchema.methods.useBackupCode = function(code) {
  const backupCode = this.backupCodes.find(bc => bc.code === code && !bc.used);
  if (backupCode) {
    backupCode.used = true;
    return true;
  }
  return false;
};

userSchema.methods.incrementLoginAttempts = function() {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { loginAttempts: 1, lockUntil: 1, isLocked: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      isLocked: true,
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1, isLocked: 1 }
  });
};

userSchema.methods.updateRiskScore = function(factors) {
  let totalScore = 0;
  const now = new Date();
  
  // Add new risk factors
  factors.forEach(factor => {
    this.riskFactors.push({
      factor: factor.factor,
      score: factor.score,
      timestamp: now
    });
    totalScore += factor.score;
  });
  
  // Calculate risk score based on recent factors (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentFactors = this.riskFactors.filter(rf => rf.timestamp > thirtyDaysAgo);
  
  const avgScore = recentFactors.length > 0 
    ? recentFactors.reduce((sum, rf) => sum + rf.score, 0) / recentFactors.length
    : 0;
  
  this.riskScore = Math.min(Math.max(avgScore, 0), 100);
  
  return this.save();
};

userSchema.methods.hasPermission = function(resource, action) {
  // Super admin has all permissions
  if (this.role === 'super_admin') return true;
  
  // Check specific permissions
  const permission = this.permissions.find(p => p.resource === resource);
  if (permission && permission.actions.includes(action)) return true;
  
  // Check role-based permissions
  const rolePermissions = {
    admin: ['users:read', 'users:write', 'audit:read', 'security:read'],
    security_analyst: ['audit:read', 'security:read', 'security:write', 'analytics:read'],
    manager: ['users:read', 'audit:read', 'reports:read'],
    user: ['profile:read', 'profile:write', 'data:read']
  };
  
  const rolePerms = rolePermissions[this.role] || [];
  return rolePerms.includes(`${resource}:${action}`);
};

userSchema.methods.addActiveSession = function(sessionId, ip, userAgent) {
  // Remove old inactive sessions
  this.activeSessions = this.activeSessions.filter(s => s.isActive);
  
  // Add new session
  this.activeSessions.push({
    sessionId,
    ip,
    userAgent,
    createdAt: new Date(),
    lastActivity: new Date(),
    isActive: true
  });
  
  return this.save();
};

userSchema.methods.removeActiveSession = function(sessionId) {
  this.activeSessions = this.activeSessions.filter(s => s.sessionId !== sessionId);
  return this.save();
};

userSchema.methods.updateSessionActivity = function(sessionId) {
  const session = this.activeSessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.lastActivity = new Date();
    return this.save();
  }
  return Promise.resolve();
};

// Static methods
userSchema.statics.findByCredentials = async function(login, password) {
  // Find user by username or email
  const user = await this.findOne({
    $or: [
      { username: login },
      { email: login }
    ]
  }).select('+password +mfaSecret');
  
  if (!user || !(await user.comparePassword(password))) {
    return null;
  }
  
  return user;
};

userSchema.statics.getHighRiskUsers = function(threshold = 70) {
  return this.find({
    riskScore: { $gte: threshold },
    isActive: true
  }).sort({ riskScore: -1 });
};

userSchema.statics.getUsersByRole = function(role) {
  return this.find({ role, isActive: true });
};

module.exports = mongoose.model('User', userSchema);