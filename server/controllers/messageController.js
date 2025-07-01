const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { decryptMessage, encryptMessage } = require('../utils/crypto');
const { validationResult } = require('express-validator');

// @desc    Get all messages in a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;
    const userId = req.user.id;

    // Verify user is part of the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Not authorized to view these messages' });
    }

    // Build query
    const query = { conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Get messages with pagination
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1) // Get one extra to check if there are more
      .populate('sender', 'firstName lastName email')
      .populate('recipient', 'firstName lastName email');

    // Check if there are more messages to load
    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove the extra message we got
    }

    // Decrypt message content
    const decryptedMessages = messages.map(message => {
      try {
        return {
          ...message.toObject(),
          content: message.isEncrypted ? decryptMessage(message.content) : message.content
        };
      } catch (error) {
        console.error('Error decrypting message:', error);
        return {
          ...message.toObject(),
          content: '[Message decryption failed]'
        };
      }
    });

    res.json({
      messages: decryptedMessages.reverse(), // Return in chronological order
      hasMore
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, recipientId, content } = req.body;
    const senderId = req.user.id;

    // Verify conversation exists and user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: { $all: [senderId, recipientId] }
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Not authorized to send message in this conversation' });
    }

    // Create and save message
    const message = new Message({
      conversationId,
      sender: senderId,
      recipient: recipientId,
      content, // Will be encrypted by pre-save hook
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    await message.save();

    // Populate sender and recipient details
    await message.populate('sender', 'firstName lastName email');
    await message.populate('recipient', 'firstName lastName email');

    // Update conversation last message timestamp
    conversation.updatedAt = new Date();
    await conversation.save();

    // Emit socket event
    req.app.get('io').to(`user_${recipientId}`).emit('new_message', {
      ...message.toObject(),
      content // Send decrypted content via socket
    });

    res.status(201).json({
      success: true,
      message: {
        ...message.toObject(),
        content // Send decrypted content in response
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:messageId/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findOneAndUpdate(
      { _id: messageId, recipient: userId },
      { read: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Notify sender that message was read
    req.app.get('io').to(`user_${message.sender}`).emit('message_read', messageId);

    res.json({ success: true, message });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to update message status' });
  }
};

// @desc    Delete a conversation
// @route   DELETE /api/messages/conversations/:conversationId
// @access  Private
exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Find the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      $or: [
        { 'participants': userId },
        { 'createdBy': userId }
      ]
    });

    if (!conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found or you do not have permission to delete it' 
      });
    }

    // For group conversations, check if the user is an admin
    if (conversation.isGroup && !conversation.admins.includes(userId)) {
      return res.status(403).json({ 
        error: 'Only group admins can delete the conversation' 
      });
    }

    // Delete all messages in the conversation
    await Message.deleteMany({ conversationId });
    
    // Delete the conversation
    await Conversation.findByIdAndDelete(conversationId);

    // Notify all participants that the conversation was deleted
    const io = req.app.get('io');
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== userId) {
        io.to(`user_${participantId}`).emit('conversation_deleted', {
          conversationId: conversation._id,
          deletedBy: userId
        });
      }
    });

    res.json({
      success: true,
      message: 'Conversation and all associated messages have been deleted'
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};

// @desc    Leave a group conversation
// @route   POST /api/messages/conversations/group/:conversationId/leave
// @access  Private
exports.leaveGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Find the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Group conversation not found or you are not a participant' });
    }

    // Check if the user is the only admin
    const isLastAdmin = 
      conversation.admins.length === 1 && 
      conversation.admins[0].toString() === userId;

    if (isLastAdmin) {
      return res.status(400).json({ 
        error: 'You are the only admin. Please assign another admin before leaving or delete the group.' 
      });
    }

    // Remove the user from participants and admins
    conversation.participants = conversation.participants.filter(
      id => id.toString() !== userId
    );
    
    conversation.admins = conversation.admins.filter(
      id => id.toString() !== userId
    );

    // If no participants left, delete the conversation
    if (conversation.participants.length === 0) {
      await Conversation.findByIdAndDelete(conversationId);
      
      // Notify any remaining participants (shouldn't happen due to previous check)
      const io = req.app.get('io');
      io.to(`user_${userId}`).emit('group_deleted', {
        conversationId: conversation._id
      });

      return res.json({ 
        success: true, 
        message: 'You have left the group. The group has been deleted as it has no remaining members.' 
      });
    }

    // Update the conversation
    conversation.updatedAt = new Date();
    await conversation.save();

    // Populate the updated conversation
    await conversation.populate('participants', 'firstName lastName email avatar');
    await conversation.populate('admins', 'firstName lastName email');

    // Notify remaining participants
    const io = req.app.get('io');
    conversation.participants.forEach(participant => {
      io.to(`user_${participant._id}`).emit('participant_left', {
        conversationId: conversation._id,
        userId,
        updatedConversation: conversation
      });
    });

    // Notify the user who left
    io.to(`user_${userId}`).emit('left_group', {
      conversationId: conversation._id,
      name: conversation.name
    });

    res.json({
      success: true,
      message: 'You have left the group',
      conversation
    });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
};

// @desc    Remove a participant from a group conversation
// @route   DELETE /api/messages/conversations/group/:conversationId/participants/:userId
// @access  Private
exports.removeParticipantFromGroup = async (req, res) => {
  try {
    const { conversationId, userId: participantId } = req.params;
    const currentUserId = req.user.id;

    // Find the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      participants: { $in: [currentUserId] } // Current user must be a participant
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found or access denied' });
    }

    // Check if the participant is in the conversation
    if (!conversation.participants.includes(participantId)) {
      return res.status(400).json({ error: 'User is not a participant in this group' });
    }

    // Check if the current user is an admin (only admins can remove participants)
    if (!conversation.admins.includes(currentUserId)) {
      return res.status(403).json({ error: 'Only group admins can remove participants' });
    }

    // Prevent removing yourself if you're the only admin
    if (
      participantId === currentUserId && 
      conversation.admins.length === 1 && 
      conversation.admins[0].toString() === currentUserId
    ) {
      return res.status(400).json({ 
        error: 'You are the only admin. Please assign another admin before leaving or delete the group.' 
      });
    }

    // Remove the participant from the conversation
    conversation.participants = conversation.participants.filter(
      id => id.toString() !== participantId
    );

    // Remove from admins if they were an admin
    conversation.admins = conversation.admins.filter(
      id => id.toString() !== participantId
    );

    // If no participants left, delete the conversation
    if (conversation.participants.length === 0) {
      await Conversation.findByIdAndDelete(conversationId);
      
      // Notify the removed user that the group was deleted
      const io = req.app.get('io');
      io.to(`user_${participantId}`).emit('group_deleted', {
        conversationId: conversation._id
      });

      return res.json({ 
        success: true, 
        message: 'Last participant removed. Group has been deleted.' 
      });
    }

    // Update the conversation
    conversation.updatedAt = new Date();
    await conversation.save();

    // Populate the updated conversation
    await conversation.populate('participants', 'firstName lastName email avatar');
    await conversation.populate('admins', 'firstName lastName email');

    // Notify all remaining participants
    const io = req.app.get('io');
    conversation.participants.forEach(participant => {
      io.to(`user_${participant._id}`).emit('participant_removed', {
        conversationId: conversation._id,
        participantId,
        updatedConversation: conversation
      });
    });

    // Notify the removed user
    io.to(`user_${participantId}`).emit('removed_from_group', {
      conversationId: conversation._id,
      name: conversation.name
    });

    res.json({
      success: true,
      message: 'Participant removed from group',
      conversation
    });
  } catch (error) {
    console.error('Error removing participant from group:', error);
    res.status(500).json({ error: 'Failed to remove participant from group' });
  }
};

// @desc    Add participants to a group conversation
// @route   POST /api/messages/conversations/group/:conversationId/participants
// @access  Private
exports.addParticipantsToGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { participants } = req.body;
    const userId = req.user.id;

    // Find the conversation and verify the user is an admin
    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      admins: userId
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Not authorized to add participants to this group' });
    }

    // Filter out participants who are already in the group
    const newParticipants = participants.filter(
      pId => !conversation.participants.includes(pId)
    );

    if (newParticipants.length === 0) {
      return res.status(400).json({ error: 'All specified users are already in the group' });
    }

    // Add new participants to the group
    conversation.participants = [...new Set([...conversation.participants, ...newParticipants])];
    conversation.updatedAt = new Date();
    
    await conversation.save();

    // Populate the updated conversation
    await conversation.populate('participants', 'firstName lastName email avatar');
    await conversation.populate('admins', 'firstName lastName email');

    // Notify all participants about the new members
    const io = req.app.get('io');
    
    // Notify existing participants about the new members
    conversation.participants.forEach(participant => {
      if (participant._id.toString() !== userId) {
        io.to(`user_${participant._id}`).emit('group_updated', {
          ...conversation.toObject(),
          newParticipants: newParticipants
        });
      }
    });

    // Notify new participants that they've been added to the group
    newParticipants.forEach(participantId => {
      io.to(`user_${participantId}`).emit('added_to_group', {
        conversationId: conversation._id,
        name: conversation.name,
        participants: conversation.participants
      });
    });

    res.json({
      success: true,
      message: 'Participants added successfully',
      conversation
    });
  } catch (error) {
    console.error('Error adding participants to group:', error);
    res.status(500).json({ error: 'Failed to add participants to group' });
  }
};

// @desc    Update a group conversation
// @route   PUT /api/messages/conversations/group/:conversationId
// @access  Private
exports.updateGroupConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { name, participants, addAdmins, removeAdmins } = req.body;
    const userId = req.user.id;

    // Find the conversation and verify the user is an admin
    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      admins: userId
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Not authorized to update this group' });
    }

    // Update name if provided
    if (name) {
      conversation.name = name;
    }

    // Add participants if provided
    if (participants && Array.isArray(participants)) {
      const newParticipants = participants.filter(
        pId => !conversation.participants.includes(pId)
      );
      conversation.participants = [...new Set([...conversation.participants, ...newParticipants])];
      
      // Notify new participants
      const io = req.app.get('io');
      newParticipants.forEach(participantId => {
        io.to(`user_${participantId}`).emit('added_to_group', {
          conversationId: conversation._id,
          name: conversation.name
        });
      });
    }

    // Update admins if provided
    if (addAdmins && Array.isArray(addAdmins)) {
      // Only add users who are participants in the conversation
      const validNewAdmins = addAdmins.filter(id => 
        conversation.participants.includes(id) && 
        !conversation.admins.includes(id)
      );
      conversation.admins = [...new Set([...conversation.admins, ...validNewAdmins])];
    }

    if (removeAdmins && Array.isArray(removeAdmins)) {
      // Don't allow removing yourself as admin if you're the only one left
      const remainingAdmins = conversation.admins.filter(
        id => !removeAdmins.includes(id.toString()) || id.toString() === userId
      );
      
      if (remainingAdmins.length === 0) {
        return res.status(400).json({ error: 'A group must have at least one admin' });
      }
      
      conversation.admins = remainingAdmins;
    }

    conversation.updatedAt = new Date();
    await conversation.save();

    // Populate the updated conversation
    await conversation.populate('participants', 'firstName lastName email avatar');
    await conversation.populate('admins', 'firstName lastName email');

    // Notify all participants about the update
    const io = req.app.get('io');
    conversation.participants.forEach(participant => {
      io.to(`user_${participant._id}`).emit('group_updated', conversation);
    });

    res.json(conversation);
  } catch (error) {
    console.error('Error updating group conversation:', error);
    res.status(500).json({ error: 'Failed to update group conversation' });
  }
};

// @desc    Create a new group conversation
// @route   POST /api/messages/conversations/group
// @access  Private
exports.createGroupConversation = async (req, res) => {
  try {
    const { name, participants } = req.body;
    const creatorId = req.user.id;

    // Ensure the creator is included in the participants
    const allParticipants = [...new Set([...participants, creatorId.toString()])];

    // Create the group conversation
    const groupConversation = new Conversation({
      name,
      participants: allParticipants,
      isGroup: true,
      createdBy: creatorId,
      admins: [creatorId]
    });

    await groupConversation.save();

    // Populate the participants and creator details
    await groupConversation.populate('participants', 'firstName lastName email avatar');
    await groupConversation.populate('createdBy', 'firstName lastName email');
    await groupConversation.populate('admins', 'firstName lastName email');

    // Notify all participants about the new group
    const io = req.app.get('io');
    allParticipants.forEach(participantId => {
      if (participantId !== creatorId) {
        io.to(`user_${participantId}`).emit('new_conversation', groupConversation);
      }
    });

    res.status(201).json(groupConversation);
  } catch (error) {
    console.error('Error creating group conversation:', error);
    res.status(500).json({ error: 'Failed to create group conversation' });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:messageId
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Only allow sender to delete message
    const message = await Message.findOneAndDelete({
      _id: messageId,
      sender: userId
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Notify recipient that message was deleted
    req.app.get('io').to(`user_${message.recipient}`).emit('message_deleted', messageId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

// @desc    Get all conversations for the current user
// @route   GET /api/messages/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all conversations where the current user is a participant
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'firstName lastName email avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    // Format the response
    const formattedConversations = conversations.map(conv => ({
      _id: conv._id,
      name: conv.name || conv.participants
        .filter(p => p._id.toString() !== userId)
        .map(p => `${p.firstName} ${p.lastName}`)
        .join(', '),
      participants: conv.participants,
      isGroup: conv.isGroup,
      lastMessage: conv.lastMessage ? {
        ...conv.lastMessage.toObject(),
        content: decryptMessage(conv.lastMessage.content)
      } : null,
      unreadCount: conv.unreadCount ? conv.unreadCount.get(userId) || 0 : 0,
      updatedAt: conv.updatedAt
    }));

    res.json(formattedConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get a specific conversation by ID
// @route   GET /api/messages/conversations/:conversationId
// @access  Private
exports.getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Find the conversation and verify the user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    })
    .populate('participants', 'firstName lastName email avatar')
    .populate('lastMessage');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Format the response
    const formattedConversation = {
      _id: conversation._id,
      name: conversation.name || conversation.participants
        .filter(p => p._id.toString() !== userId)
        .map(p => `${p.firstName} ${p.lastName}`)
        .join(', '),
      participants: conversation.participants,
      isGroup: conversation.isGroup,
      lastMessage: conversation.lastMessage ? {
        ...conversation.lastMessage.toObject(),
        content: decryptMessage(conversation.lastMessage.content)
      } : null,
      unreadCount: conversation.unreadCount ? conversation.unreadCount.get(userId) || 0 : 0,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    };

    res.json(formattedConversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
