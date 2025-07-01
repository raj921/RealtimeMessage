const User = require('../models/User');
const { validationResult } = require('express-validator');
const { encryptMessage, decryptMessage } = require('../utils/crypto');

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 * @access  Private
 */
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -__v -createdAt -updatedAt')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Decrypt sensitive fields
    if (user.profile?.phone) {
      try {
        user.profile.phone = decryptMessage(user.profile.phone);
      } catch (error) {
        console.error('Error decrypting phone:', error);
        user.profile.phone = '[Encrypted]';
      }
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Update current user profile
 * @route   PUT /api/users/me
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    dateOfBirth,
    avatar,
    status,
    notificationsEnabled,
    isOnline
  } = req.body;

  try {
    // Build profile object
    const profileFields = {};
    if (firstName) profileFields.firstName = firstName;
    if (lastName) profileFields.lastName = lastName;
    if (email) profileFields.email = email.toLowerCase();
    if (phoneNumber) profileFields.phoneNumber = phoneNumber;
    if (dateOfBirth) profileFields.dateOfBirth = dateOfBirth;
    if (avatar) profileFields.avatar = avatar;
    if (status) profileFields.status = status;
    if (typeof notificationsEnabled === 'boolean') {
      profileFields.notificationsEnabled = notificationsEnabled;
    }
    if (typeof isOnline === 'boolean') {
      profileFields.isOnline = isOnline;
      if (isOnline) {
        profileFields.lastActive = new Date();
      }
    }

    let user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
    }

    // Update user
    user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: profileFields },
      { new: true, runValidators: true }
    ).select('-password -__v');

    // Fields are already in plain text format for the response

    // Emit user update event
    const io = req.app.get('io');
    io.emit('user_updated', user);

    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Search users by name or email
 * @route   GET /api/users/search
 * @access  Private
 */
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const limit = parseInt(req.query.limit) || 10;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Search for users by name or email (case-insensitive)
    const users = await User.find({
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.user.id } // Exclude current user
    })
      .select('-password -__v -createdAt -updatedAt')
      .limit(limit);

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Get list of online users
 * @route   GET /api/users/online
 * @access  Private
 */
exports.getOnlineUsers = async (req, res) => {
  try {
    const onlineUsers = await User.find({
      isOnline: true,
      _id: { $ne: req.user.id } // Exclude current user
    })
      .select('-password -__v -createdAt -updatedAt')
      .sort({ lastActive: -1 });

    res.json(onlineUsers);
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Update user status
 * @route   PUT /api/users/status
 * @access  Private
 */
exports.updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        status,
        isOnline: status !== 'offline',
        lastActive: new Date()
      },
      { new: true }
    ).select('-password -__v');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Emit status update event
    const io = req.app.get('io');
    io.emit('user_status_updated', {
      userId: user._id,
      status: user.status,
      isOnline: user.isOnline,
      lastActive: user.lastActive
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Update notification preferences
 * @route   PUT /api/users/notifications
 * @access  Private
 */
exports.updateNotificationPreferences = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { notificationsEnabled } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { notificationsEnabled },
      { new: true }
    ).select('-password -__v');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -__v -createdAt -updatedAt')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only allow access to certain fields for non-admin users
    if (req.user.role !== 'admin' && req.user.id !== user._id.toString()) {
      return res.status(200).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        isOnline: user.isOnline,
        role: user.role
      });
    }

    // For admin or self, return all fields (except sensitive ones already excluded)

    res.json(user);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
