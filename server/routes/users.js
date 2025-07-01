const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');

// Import user controller functions
const userController = require('../controllers/userController');

// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, userController.getMyProfile);

// @route   PUT /api/users/me
// @desc    Update current user profile
// @access  Private
router.put(
  '/me',
  [
    auth,
    [
      check('firstName', 'First name is required').not().isEmpty(),
      check('lastName', 'Last name is required').not().isEmpty(),
      check('email', 'Please include a valid email').isEmail(),
      check('phoneNumber', 'Please include a valid phone number').optional().isMobilePhone(),
      check('dateOfBirth', 'Please include a valid date of birth').optional().isDate(),
    ],
  ],
  userController.updateProfile
);

// @route   GET /api/users/search
// @desc    Search users by name or email
// @access  Private
router.get('/search', auth, userController.searchUsers);

// @route   GET /api/users/online
// @desc    Get list of online users
// @access  Private
router.get('/online', auth, userController.getOnlineUsers);

// @route   PUT /api/users/status
// @desc    Update user status
// @access  Private
router.put(
  '/status',
  [
    auth,
    [
      check('status', 'Status is required')
        .not()
        .isEmpty()
        .isIn(['online', 'away', 'busy', 'offline']),
    ],
  ],
  userController.updateStatus
);

// @route   PUT /api/users/notifications
// @desc    Update notification preferences
// @access  Private
router.put(
  '/notifications',
  [
    auth,
    [
      check('notificationsEnabled', 'Notifications enabled must be a boolean')
        .isBoolean(),
    ],
  ],
  userController.updateNotificationPreferences
);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, userController.getUserById);

module.exports = router;
