const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema({
  conversationId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Conversation'
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isEncrypted: {
    type: Boolean,
    default: true
  },
  read: {
    type: Boolean,
    default: false
  },
  metadata: {
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }
}, { timestamps: true });

// Add text index for search functionality
MessageSchema.index({ content: 'text' });

// Add method to sanitize message data before sending to client
MessageSchema.methods.toJSON = function() {
  const message = this.toObject();
  delete message.__v;
  return message;
};

module.exports = mongoose.model('Message', MessageSchema);
