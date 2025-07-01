const mongoose = require('mongoose');
const { Schema } = mongoose;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { hashData } = require('../utils/crypto');

const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  firstName: {
    type: String,
    required: [true, 'Please add a first name'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Please add a last name'],
    trim: true
  },
  role: {
    type: String,
    enum: ['doctor', 'nurse', 'patient', 'admin'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  refreshTokens: [{
    token: String,
    expires: Date,
    created: { type: Date, default: Date.now }
  }],
  profile: {
    avatar: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer not to say']
    },
    specialization: String, // For doctors
    licenseNumber: String,  // For healthcare providers
    department: String,     // For staff
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String
    }
  },
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sound: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  lastLogin: {
    type: Date
  },
  loginHistory: [{
    ipAddress: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['success', 'failed'] }
  }],
  accountVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationExpire: Date,
  passwordResetToken: String,
  passwordResetExpire: Date,
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: String,
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  accountLockedUntil: Date,
  termsAccepted: {
    type: Boolean,
    default: false
  },
  termsAcceptedAt: Date,
  privacyPolicyAccepted: {
    type: Boolean,
    default: false
  },
  privacyPolicyAcceptedAt: Date,
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  passwordHistory: [{
    password: String,
    changedAt: Date
  }],
  securityQuestions: [{
    question: String,
    answer: String
  }],
  activityLog: [{
    action: String,
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    status: String
  }],
  metadata: {
    timezone: String,
    lastActive: Date,
    deviceInfo: {},
    appVersion: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Encrypt password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Add to password history
    if (this.isModified('password')) {
      this.passwordHistory.unshift({
        password: this.password,
        changedAt: new Date()
      });
      
      // Keep only last 5 passwords
      if (this.passwordHistory.length > 5) {
        this.passwordHistory = this.passwordHistory.slice(0, 5);
      }
      
      this.lastPasswordChange = new Date();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Add method to compare password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { user: { id: this._id, role: this.role } },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
};

// Generate refresh token
UserSchema.methods.getRefreshToken = function() {
  const refreshToken = jwt.sign(
    { user: { id: this._id } },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
  
  // Store hashed refresh token in database
  const hashedToken = hashData(refreshToken);
  
  // Add to refresh tokens array
  this.refreshTokens = this.refreshTokens.concat({
    token: hashedToken,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  return refreshToken;
};

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual for user's initials
UserSchema.virtual('initials').get(function() {
  return `${this.firstName[0]}${this.lastName[0]}`.toUpperCase();
});

// Check if account is locked
UserSchema.methods.isAccountLocked = function() {
  return this.accountLocked && this.accountLockedUntil > Date.now();
};

// Check if password needs to be changed
UserSchema.methods.isPasswordExpired = function() {
  const passwordAge = Date.now() - new Date(this.lastPasswordChange).getTime();
  const maxPasswordAge = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
  return passwordAge > maxPasswordAge;
};

// Check if user has role
UserSchema.methods.hasRole = function(role) {
  return this.role === role;
};

// Check if user has any of the given roles
UserSchema.methods.hasAnyRole = function(roles) {
  return roles.includes(this.role);
};

// Add activity log entry
UserSchema.methods.addActivity = function(activity) {
  this.activityLog.unshift({
    action: activity.action,
    ipAddress: activity.ipAddress,
    userAgent: activity.userAgent,
    status: activity.status || 'success'
  });
  
  // Keep only last 100 activity logs
  if (this.activityLog.length > 100) {
    this.activityLog = this.activityLog.slice(0, 100);
  }
  
  return this.save();
};

// Static method to find user by credentials
UserSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email }).select('+password');
  
  if (!user) {
    throw new Error('Unable to login');
  }
  
  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    throw new Error('Unable to login');
  }
  
  return user;
};

// Create and export the model
const User = mongoose.model('User', UserSchema);

module.exports = User;
