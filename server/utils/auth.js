const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { hashData } = require('./crypto');

// Generate JWT token
const generateJwtToken = (user) => {
  return jwt.sign(
    { 
      user: { 
        id: user._id, 
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      } 
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE || '15m',
      jwtid: uuidv4(),
      issuer: 'healthcare-messaging-api',
      audience: 'healthcare-messaging-client'
    }
  );
};

// Generate refresh token
const generateRefreshToken = (user) => {
  const refreshToken = jwt.sign(
    { user: { id: user._id } },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
      jwtid: uuidv4(),
      issuer: 'healthcare-messaging-api',
      audience: 'healthcare-messaging-client'
    }
  );
  
  // Return both the token and its hashed version for storage
  return {
    token: refreshToken,
    hashedToken: hashData(refreshToken)
  };
};

// Generate both access and refresh tokens
const generateTokens = (user) => {
  const accessToken = generateJwtToken(user);
  const { token: refreshToken, hashedToken } = generateRefreshToken(user);
  
  return {
    accessToken,
    refreshToken,
    hashedRefreshToken: hashedToken
  };
};

// Verify JWT token
const verifyToken = (token, isRefresh = false) => {
  try {
    const secret = isRefresh ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
    return jwt.verify(token, secret, {
      issuer: 'healthcare-messaging-api',
      audience: 'healthcare-messaging-client'
    });
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid or expired token');
  }
};

// Extract token from request headers
const getTokenFromHeader = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    return req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};

// Generate password reset token
const generateResetToken = () => {
  const resetToken = crypto.randomBytes(20).toString('hex');
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  const resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return { resetToken, resetPasswordToken, resetPasswordExpire };
};

// Generate email verification token
const generateEmailVerificationToken = () => {
  const verificationToken = crypto.randomBytes(20).toString('hex');
  const emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
    
  const emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return { verificationToken, emailVerificationToken, emailVerificationExpire };
};

// Check if token is expired
const isTokenExpired = (exp) => {
  return Date.now() >= exp * 1000;
};

// Get token expiration date
const getTokenExpiration = (token) => {
  const decoded = jwt.decode(token);
  return decoded ? new Date(decoded.exp * 1000) : null;
};

// Generate API key
const generateApiKey = () => {
  return `api_${uuidv4().replace(/-/g, '')}_${Date.now()}`;
};

// Generate OTP (One-Time Password)
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  
  return otp;
};

// Generate secure random string
const generateSecureRandomString = (length = 32) => {
  return require('crypto').randomBytes(length).toString('hex');
};

module.exports = {
  generateJwtToken,
  generateRefreshToken,
  generateTokens,
  verifyToken,
  getTokenFromHeader,
  generateResetToken,
  generateEmailVerificationToken,
  isTokenExpired,
  getTokenExpiration,
  generateApiKey,
  generateOTP,
  generateSecureRandomString
};
