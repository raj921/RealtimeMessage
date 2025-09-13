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

router.get('/conversations', auth, getConversations);


router.get(
  '/:conversationId',
  [auth, [check('conversationId', 'Conversation ID is required').not().isEmpty()]],
  getMessages
);


router.delete(
  '/:messageId',
  [auth, [check('messageId', 'Message ID is required').not().isEmpty()]],
  deleteMessage
);


router.put(
  '/:messageId/read',
  [auth, [check('messageId', 'Message ID is required').not().isEmpty()]],
  markAsRead
);

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

router.put(
  '/conversations/group/:conversationId',
  [auth, [check('conversationId', 'Conversation ID is required').not().isEmpty()]],
  updateGroupConversation
);


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


router.post(
  '/conversations/group/:conversationId/leave',
  [auth, [check('conversationId', 'Conversation ID is required').not().isEmpty()]],
  leaveGroup
);


router.delete(
  '/conversations/:conversationId',
  [auth, [check('conversationId', 'Conversation ID is required').not().isEmpty()]],
  deleteConversation
);

module.exports = router;
