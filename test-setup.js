#!/usr/bin/env node

/**
 * Test Setup Script for Healthcare Messaging Application
 * This script validates that all critical components are properly configured
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}🔍 ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bold}${colors.blue}\n=== ${msg} ===${colors.reset}`)
};

async function validateEnvironment() {
  log.header('Environment Validation');
  
  const requiredEnvVars = [
    'MONGO_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];
  
  const optionalEnvVars = [
    'ENCRYPTION_KEY',
    'NODE_ENV',
    'PORT',
    'CLIENT_URL'
  ];
  
  let isValid = true;
  
  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      log.success(`${envVar} is set`);
    } else {
      log.error(`${envVar} is missing - REQUIRED`);
      isValid = false;
    }
  }
  
  // Check optional environment variables
  for (const envVar of optionalEnvVars) {
    if (process.env[envVar]) {
      log.success(`${envVar} is set`);
    } else {
      log.warning(`${envVar} is not set - will use default`);
    }
  }
  
  return isValid;
}

async function validateDatabase() {
  log.header('Database Connection Test');
  
  try {
    if (!process.env.MONGO_URI) {
      log.error('MONGO_URI not set, skipping database test');
      return false;
    }
    
    log.info(`Connecting to: ${process.env.MONGO_URI.replace(/\/\/.*@/, '//***:***@')}`);
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // 5 second timeout
    });
    
    log.success('Database connection successful');
    
    // Test basic operations
    const collections = await mongoose.connection.db.listCollections().toArray();
    log.info(`Found ${collections.length} collections in database`);
    
    await mongoose.disconnect();
    log.success('Database disconnection successful');
    
    return true;
  } catch (error) {
    log.error(`Database connection failed: ${error.message}`);
    return false;
  }
}

function validateFiles() {
  log.header('File Structure Validation');
  
  const criticalFiles = [
    // Server files
    'server/index.js',
    'server/models/User.js',
    'server/models/Message.js',
    'server/models/Conversation.js',
    'server/controllers/authController.js',
    'server/controllers/messageController.js',
    'server/controllers/userController.js',
    'server/routes/auth.js',
    'server/routes/messages.js',
    'server/routes/users.js',
    'server/middleware/auth.js',
    'server/middleware/errorMiddleware.js',
    'server/utils/auth.js',
    'server/utils/crypto.js',
    'server/config/db.js',
    'server/socket.js',
    
    // Client files
    'client/src/App.tsx',
    'client/src/contexts/AuthContext.tsx',
    'client/src/services/api.ts',
    'client/src/types/index.ts',
    'client/package.json',
    
    // Root files
    'package.json',
    '.env.example'
  ];
  
  let allFilesExist = true;
  
  for (const file of criticalFiles) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      log.success(`${file} exists`);
    } else {
      log.error(`${file} is missing`);
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

function validatePackageJson() {
  log.header('Package.json Validation');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const clientPackageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'client/package.json'), 'utf8'));
    
    // Check server dependencies
    const serverDeps = [
      'express',
      'mongoose',
      'jsonwebtoken',
      'bcryptjs',
      'socket.io',
      'helmet',
      'cors',
      'express-validator',
      'dotenv'
    ];
    
    for (const dep of serverDeps) {
      if (packageJson.dependencies[dep]) {
        log.success(`Server dependency ${dep} found`);
      } else {
        log.error(`Server dependency ${dep} missing`);
      }
    }
    
    // Check client dependencies
    const clientDeps = [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      'axios',
      'socket.io-client',
      'formik',
      'yup'
    ];
    
    for (const dep of clientDeps) {
      if (clientPackageJson.dependencies[dep]) {
        log.success(`Client dependency ${dep} found`);
      } else {
        log.error(`Client dependency ${dep} missing`);
      }
    }
    
    return true;
  } catch (error) {
    log.error(`Package.json validation failed: ${error.message}`);
    return false;
  }
}

function validateSecurityConfig() {
  log.header('Security Configuration Check');
  
  let isSecure = true;
  
  // Check JWT secret strength
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      log.warning('JWT_SECRET should be at least 32 characters long');
    } else {
      log.success('JWT_SECRET length is adequate');
    }
  }
  
  // Check if refresh secret is different from JWT secret
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    log.error('JWT_REFRESH_SECRET should be different from JWT_SECRET');
    isSecure = false;
  } else if (process.env.JWT_REFRESH_SECRET) {
    log.success('JWT_REFRESH_SECRET is different from JWT_SECRET');
  }
  
  // Check encryption key
  if (!process.env.ENCRYPTION_KEY) {
    log.warning('ENCRYPTION_KEY not set - will use temporary key (not recommended for production)');
  } else {
    log.success('ENCRYPTION_KEY is configured');
  }
  
  // Check NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    log.info('Running in production mode - ensure all security measures are in place');
  } else {
    log.info('Running in development mode');
  }
  
  return isSecure;
}

async function main() {
  console.log(`${colors.bold}${colors.blue}Healthcare Messaging Application - Setup Validation${colors.reset}\n`);
  
  const results = {
    environment: await validateEnvironment(),
    files: validateFiles(),
    packages: validatePackageJson(),
    database: await validateDatabase(),
    security: validateSecurityConfig()
  };
  
  log.header('Validation Summary');
  
  const allPassed = Object.values(results).every(Boolean);
  
  for (const [test, passed] of Object.entries(results)) {
    if (passed) {
      log.success(`${test.charAt(0).toUpperCase() + test.slice(1)} validation passed`);
    } else {
      log.error(`${test.charAt(0).toUpperCase() + test.slice(1)} validation failed`);
    }
  }
  
  if (allPassed) {
    log.success(`\n${colors.bold}🎉 All validations passed! Your application is ready to run.${colors.reset}`);
    console.log(`\n${colors.green}Next steps:${colors.reset}`);
    console.log('1. Run "npm run dev" to start both server and client');
    console.log('2. Open http://localhost:3000 in your browser');
    console.log('3. Register a new account or login with existing credentials');
  } else {
    log.error(`\n${colors.bold}❌ Some validations failed. Please fix the issues above before running the application.${colors.reset}`);
    process.exit(1);
  }
}

// Run validation
main().catch(error => {
  log.error(`Validation script failed: ${error.message}`);
  process.exit(1);
});