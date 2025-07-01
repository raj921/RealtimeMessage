const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const {
  sendMessage,
  getMessages,
  deleteMessage,
  markAsRead,
  getConversations,
  getConversationById,
  createGroupConversation,
  updateGroupConversation,
  addParticipantsToGroup,
  removeParticipantFromGroup,
  leaveGroup,
  deleteConversation
} = require('../controllers/messageController');
const auth = require('../middleware/auth');

// @route   POST /api/messages
// @desc    Send a new message
// @access  Private
router.post(
  '/',
  [
    auth,
    [
      check('conversationId', 'Conversation ID is required').not().isEmpty(),
      check('recipientId', 'Recipient ID is required').if(
        (value, { req }) => !req.body.conversationId
      ),
      check('content', 'Message content is required').not().isEmpty()
    ]
  ],
  sendMessage
);

// @route   GET /api/messages/conversations
// @desc    Get all conversations for the current user
// @access  Private
router.get('/conversations', auth, getConversations);

// @route   GET /api/messages/conversations/:conversationId
// @desc    Get a specific conversation by ID
// @access  Private
router.get('/conversations/:conversationId', auth, getConversationById);

// @route   GET /api/messages/:conversationId
// @desc    Get messages in a conversation
// @access  Private
router.get(
  '/:conversationId',
  [auth, [check('conversationId', 'Conversation ID is required').not().isEmpty()]],
  getMessages
);

// @route   DELETE /api/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete(
  '/:messageId',
  [auth, [check('messageId', 'Message ID is required').not().isEmpty()]],
  deleteMessage
);

// @route   PUT /api/messages/:messageId/read
// @desc    Mark a message as read
// @access  Private
router.put(
  '/:messageId/read',
  [auth, [check('messageId', 'Message ID is required').not().isEmpty()]],
  markAsRead
);

// @route   POST /api/messages/conversations/group
// @desc    Create a new group conversation
// @access  Private
router.post(
  '/conversations/group',
  [
    auth,
    [
      check('name', 'Group name is required').not().isEmpty(),
      check('participants', 'At least one participant is required').isArray({ min: 1 })
    ]
  ],
  createGroupConversation
);

// @route   PUT /api/messages/conversations/group/:conversationId
// @desc    Update a group conversation
// @access  Private
router.put(
  '/conversations/group/:conversationId',
  [auth, [check('conversationId', 'Conversation ID is required').not().isEmpty()]],
  updateGroupConversation
);

// @route   POST /api/messages/conversations/group/:conversationId/participants
// @desc    Add participants to a group conversation
// @access  Private
router.post(
  '/conversations/group/:conversationId/participants',
  [
    auth,
    [
      check('conversationId', 'Conversation ID is required').not().isEmpty(),
      check('participants', 'At least one participant is required')
        .isArray({ min: 1 })
    ]
  ],
  addParticipantsToGroup
);

// @route   DELETE /api/messages/conversations/group/:conversationId/participants/:userId
// @desc    Remove a participant from a group conversation
// @access  Private
router.delete(
  '/conversations/group/:conversationId/participants/:userId',
  [
    auth,
    [
      check('conversationId', 'Conversation ID is required').not().isEmpty(),
      check('userId', 'User ID is required').not().isEmpty()
    ]
  ],
  removeParticipantFromGroup
);

// @route   POST /api/messages/conversations/group/:conversationId/leave
// @desc    Leave a group conversation
// @access  Private
router.post(
  '/conversations/group/:conversationId/leave',
  [auth, [check('conversationId', 'Conversation ID is required').not().isEmpty()]],
  leaveGroup
);

// @route   DELETE /api/messages/conversations/:conversationId
// @desc    Delete a conversation
// @access  Private
router.delete(
  '/conversations/:conversationId',
  [auth, [check('conversationId', 'Conversation ID is required').not().isEmpty()]],
  deleteConversation
);

module.exports = router;
