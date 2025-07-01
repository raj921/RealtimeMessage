const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const { encryptMessage, decryptMessage } = require('./utils/crypto');

const configureSocket = (server) => {
  const io = socketio(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Socket.io middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded.user;
      next();
    } catch (err) {
      console.error('Socket authentication error:', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}`);

    // Join user's personal room
    socket.join(`user_${socket.user.id}`);

    // Handle new message
    socket.on('send_message', async (data) => {
      try {
        // Validate required fields
        if (!data.content || !data.recipientId || !data.conversationId) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }

        // Encrypt message content before saving
        const encryptedContent = encryptMessage(data.content);
        
        const message = new Message({
          conversationId: data.conversationId,
          sender: socket.user.id,
          recipient: data.recipientId,
          content: encryptedContent,
          isEncrypted: true,
          metadata: {
            timestamp: new Date(),
            ipAddress: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent']
          }
        });

        await message.save();

        // Create response object with decrypted content
        const messageResponse = {
          _id: message._id,
          conversationId: message.conversationId,
          sender: message.sender,
          recipient: message.recipient,
          content: data.content, // Send original content (decrypted)
          isEncrypted: message.isEncrypted,
          read: message.read,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          metadata: message.metadata
        };

        // Emit to recipient's room
        io.to(`user_${data.recipientId}`).emit('receive_message', messageResponse);
        
        // Emit back to sender for confirmation
        socket.emit('message_sent', messageResponse);

      } catch (err) {
        console.error('Error sending message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      socket.to(`user_${data.recipientId}`).emit('user_typing', {
        userId: socket.user.id,
        isTyping: data.isTyping
      });
    });

    // Handle message read receipt
    socket.on('message_read', async (messageId) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.recipient.toString() === socket.user.id) {
          message.read = true;
          await message.save();
          
          // Notify sender that message was read
          io.to(`user_${message.sender}`).emit('message_read', messageId);
        }
      } catch (err) {
        console.error('Error updating read status:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });

  return io;
};

module.exports = configureSocket;
