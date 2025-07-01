const mongoose = require('mongoose');
const { Schema } = mongoose;

const ParticipantSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hasUnread: {
    type: Boolean,
    default: false
  },
  lastRead: {
    type: Date,
    default: Date.now
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isMuted: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
});

const MessageSchema = new Schema({
  messageId: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  readBy: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  reactions: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
});

const ConversationSchema = new Schema({
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    validate: [arrayLimit, 'A conversation must have at least 2 participants']
  }],
  isGroup: {
    type: Boolean,
    default: false
  },
  groupInfo: {
    name: String,
    description: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    admins: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    avatar: String,
    settings: {
      onlyAdminsCanPost: {
        type: Boolean,
        default: false
      },
      onlyAdminsCanEdit: {
        type: Boolean,
        default: false
      },
      onlyAdminsCanAddMembers: {
        type: Boolean,
        default: false
      },
      allowMemberInvites: {
        type: Boolean,
        default: true
      },
      requireApproval: {
        type: Boolean,
        default: false
      }
    }
  },
  lastMessage: {
    type: MessageSchema,
    default: null
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isMuted: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    deletedAt: {
      type: Date
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    customFields: {}
  },
  participantDetails: [ParticipantSchema],
  messageHistory: [MessageSchema],
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Validate participant array length
function arrayLimit(val) {
  return val.length >= 2;
}

// Indexes for better query performance
ConversationSchema.index({ participants: 1, 'metadata.updatedAt': -1 });
ConversationSchema.index({ 'lastMessage.timestamp': -1 });
ConversationSchema.index({ 'participantDetails.user': 1, 'metadata.updatedAt': -1 });

// Virtual for message count
ConversationSchema.virtual('messageCount').get(function() {
  return this.messageHistory.length;
});

// Virtual for unread message count for a specific user
ConversationSchema.methods.getUnreadCount = function(userId) {
  const participant = this.participantDetails.find(
    p => p.user && p.user.toString() === userId.toString()
  );
  
  if (!participant) return 0;
  
  return this.messageHistory.filter(msg => 
    msg.timestamp > participant.lastRead && 
    msg.sender.toString() !== userId.toString()
  ).length;
};

// Update last message and increment unread count for other participants
ConversationSchema.methods.addMessage = function(message) {
  this.lastMessage = {
    messageId: message._id,
    sender: message.sender,
    content: message.content,
    timestamp: message.createdAt,
    isEdited: false,
    isDeleted: false
  };
  
  // Update last activity
  this.metadata.lastActivity = new Date();
  this.metadata.updatedAt = new Date();
  
  // Add to message history (keep only last 100 messages)
  this.messageHistory.push({
    messageId: message._id,
    sender: message.sender,
    content: message.content,
    timestamp: message.createdAt,
    isEdited: false,
    isDeleted: false,
    readBy: [{
      userId: message.sender,
      readAt: new Date()
    }]
  });
  
  // Keep only last 100 messages
  if (this.messageHistory.length > 100) {
    this.messageHistory = this.messageHistory.slice(-100);
  }
  
  // Update participant details
  this.participantDetails.forEach(participant => {
    if (participant.user.toString() !== message.sender.toString()) {
      participant.hasUnread = true;
      this.unreadCount += 1;
    } else {
      participant.lastRead = new Date();
    }
  });
  
  return this.save();
};

// Mark messages as read for a participant
ConversationSchema.methods.markAsRead = function(userId) {
  const participant = this.participantDetails.find(
    p => p.user && p.user.toString() === userId.toString()
  );
  
  if (participant) {
    participant.hasUnread = false;
    participant.lastRead = new Date();
    
    // Update unread count
    this.unreadCount = this.participantDetails.reduce((count, p) => 
      p.hasUnread ? count + 1 : count, 0
    );
    
    return this.save();
  }
  
  return this;
};

// Check if a user is a participant in the conversation
ConversationSchema.methods.isParticipant = function(userId) {
  return this.participants.some(participant => 
    participant._id ? 
    participant._id.toString() === userId.toString() : 
    participant.toString() === userId.toString()
  );
};

// Check if a user is an admin in a group conversation
ConversationSchema.methods.isAdmin = function(userId) {
  if (!this.isGroup) return false;
  return this.groupInfo.admins.some(admin => 
    admin._id ? 
    admin._id.toString() === userId.toString() : 
    admin.toString() === userId.toString()
  );
};

// Add a participant to a group conversation
ConversationSchema.methods.addParticipant = async function(userId, addedBy) {
  if (!this.isGroup) {
    throw new Error('Cannot add participants to a direct conversation');
  }
  
  if (this.isParticipant(userId)) {
    return this;
  }
  
  this.participants.push(userId);
  this.participantDetails.push({
    user: userId,
    hasUnread: false,
    lastRead: new Date(),
    isMuted: false,
    isPinned: false
  });
  
  // Add system message
  const addedUser = await mongoose.model('User').findById(userId);
  const addedByName = addedBy ? 
    (await mongoose.model('User').findById(addedBy))?.fullName || 'System' : 
    'System';
    
  this.messageHistory.push({
    messageId: new mongoose.Types.ObjectId(),
    sender: addedBy || this.groupInfo.createdBy,
    content: `${addedByName} added ${addedUser?.fullName || 'a user'} to the group`,
    timestamp: new Date(),
    isSystem: true
  });
  
  this.metadata.updatedAt = new Date();
  return this.save();
};

// Remove a participant from a group conversation
ConversationSchema.methods.removeParticipant = async function(userId, removedBy) {
  if (!this.isGroup) {
    throw new Error('Cannot remove participants from a direct conversation');
  }
  
  if (!this.isParticipant(userId)) {
    return this;
  }
  
  // Remove from participants
  this.participants = this.participants.filter(p => 
    p._id ? 
    p._id.toString() !== userId.toString() : 
    p.toString() !== userId.toString()
  );
  
  // Remove from participant details
  const removedUser = await mongoose.model('User').findById(userId);
  const removedByName = removedBy ? 
    (await mongoose.model('User').findById(removedBy))?.fullName || 'System' : 
    'System';
    
  this.participantDetails = this.participantDetails.filter(p => 
    p.user.toString() !== userId.toString()
  );
  
  // Add system message
  this.messageHistory.push({
    messageId: new mongoose.Types.ObjectId(),
    sender: removedBy || this.groupInfo.createdBy,
    content: `${removedByName} removed ${removedUser?.fullName || 'a user'} from the group`,
    timestamp: new Date(),
    isSystem: true
  });
  
  this.metadata.updatedAt = new Date();
  return this.save();
};

// Pre-save hook to update timestamps and handle participant details
ConversationSchema.pre('save', function(next) {
  if (this.isNew) {
    // Initialize participant details if not provided
    if (this.participantDetails.length === 0 && this.participants.length > 0) {
      this.participantDetails = this.participants.map(userId => ({
        user: userId,
        hasUnread: false,
        lastRead: new Date(),
        isMuted: false,
        isPinned: false
      }));
    }
    
    // Set createdBy if not provided
    if (!this.metadata.createdBy && this.participants.length > 0) {
      this.metadata.createdBy = this.participants[0];
    }
    
    // Set updatedAt
    this.metadata.updatedAt = new Date();
  } else {
    // Update timestamps
    this.metadata.updatedAt = new Date();
  }
  
  next();
});

// Static method to find or create a direct conversation
ConversationSchema.statics.findOrCreateDirect = async function(user1Id, user2Id) {
  // Check if a direct conversation already exists between these users
  let conversation = await this.findOne({
    isGroup: false,
    participants: {
      $all: [
        { $elemMatch: { $eq: user1Id } },
        { $elemMatch: { $eq: user2Id } }
      ],
      $size: 2
    }
  });
  
  // If no conversation exists, create a new one
  if (!conversation) {
    conversation = new this({
      participants: [user1Id, user2Id],
      isGroup: false,
      metadata: {
        createdBy: user1Id
      },
      participantDetails: [
        { user: user1Id, hasUnread: false, lastRead: new Date() },
        { user: user2Id, hasUnread: false, lastRead: new Date() }
      ]
    });
    
    await conversation.save();
  }
  
  return conversation;
};

// Static method to create a group conversation
ConversationSchema.statics.createGroup = async function(creatorId, name, participants, options = {}) {
  // Ensure creator is included in participants
  const allParticipants = [...new Set([creatorId, ...participants])];
  
  const group = new this({
    participants: allParticipants,
    isGroup: true,
    groupInfo: {
      name,
      description: options.description || '',
      createdBy: creatorId,
      admins: [creatorId],
      avatar: options.avatar,
      settings: {
        onlyAdminsCanPost: options.onlyAdminsCanPost || false,
        onlyAdminsCanEdit: options.onlyAdminsCanEdit || false,
        onlyAdminsCanAddMembers: options.onlyAdminsCanAddMembers || false,
        allowMemberInvites: options.allowMemberInvites !== false, // true by default
        requireApproval: options.requireApproval || false
      }
    },
    participantDetails: allParticipants.map(userId => ({
      user: userId,
      hasUnread: false,
      lastRead: new Date(),
      isMuted: false,
      isPinned: false
    })),
    metadata: {
      createdBy: creatorId
    },
    tags: options.tags || []
  });
  
  await group.save();
  return group;
};

const Conversation = mongoose.model('Conversation', ConversationSchema);

module.exports = Conversation;
