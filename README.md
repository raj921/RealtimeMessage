# Healthcare Messaging Application

A secure, real-time messaging platform designed for healthcare professionals with end-to-end encryption, role-based access control, and HIPAA-compliant features.

## 🚀 Features

- **Real-time Messaging**: Instant messaging with Socket.io
- **End-to-End Encryption**: All messages are encrypted for security
- **Role-based Access Control**: Different permissions for doctors, nurses, patients, and admins
- **Group Conversations**: Create and manage group chats
- **File Sharing**: Secure file upload and sharing
- **User Status**: Online/offline indicators and typing notifications
- **Message History**: Paginated message history with search
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Theme**: User preference theme switching

## 🏗️ Architecture

### Backend (Node.js + Express)
- **Authentication**: JWT with refresh tokens
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io for real-time communication
- **Security**: Helmet, CORS, input validation, rate limiting
- **Encryption**: AES-256-GCM for message encryption

### Frontend (React + TypeScript)
- **UI Framework**: Material-UI (MUI)
- **State Management**: React Context API
- **Routing**: React Router v6
- **Forms**: Formik + Yup validation
- **HTTP Client**: Axios with interceptors
- **Real-time**: Socket.io-client

## 📋 Prerequisites

- Node.js 16+ 
- MongoDB 4.4+
- npm or yarn package manager

## 🛠️ Installation

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd healthcare-messaging
   ```

2. **Run the setup script**
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

### Manual Setup

1. **Install dependencies**
   ```bash
   npm run install-all
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   cp client/.env.example client/.env
   ```

3. **Edit .env files with your configurations**
   - Set `MONGO_URI` to your MongoDB connection string
   - Set `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ characters each)
   - Set `ENCRYPTION_KEY` (64 hex characters)
   - Configure other variables as needed

4. **Validate setup**
   ```bash
   npm run validate
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

#### Server (.env)
```env
# Database
MONGO_URI=mongodb://localhost:27017/healthcare_messaging

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_here_32_chars_min
JWT_REFRESH_SECRET=different_refresh_secret_here
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# Encryption
ENCRYPTION_KEY=your_64_character_hex_encryption_key_here

# Server
NODE_ENV=development
PORT=5002
CLIENT_URL=http://localhost:3000
```

#### Client (client/.env)
```env
REACT_APP_API_URL=http://localhost:5002/api
REACT_APP_SOCKET_URL=http://localhost:5002
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### User Endpoints
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `GET /api/users/search` - Search users
- `GET /api/users/online` - Get online users
- `PUT /api/users/status` - Update user status

### Message Endpoints
- `POST /api/messages` - Send message
- `GET /api/messages/:conversationId` - Get messages
- `DELETE /api/messages/:messageId` - Delete message
- `PUT /api/messages/:messageId/read` - Mark as read

### Conversation Endpoints
- `GET /api/messages/conversations` - Get conversations
- `POST /api/messages/conversations/group` - Create group
- `PUT /api/messages/conversations/group/:id` - Update group
- `POST /api/messages/conversations/group/:id/participants` - Add participants
- `DELETE /api/messages/conversations/:id` - Delete conversation

## 🔐 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Access and refresh token system
- **Message Encryption**: AES-256-GCM encryption
- **Input Validation**: Express-validator for all inputs
- **Rate Limiting**: Protection against brute force attacks
- **CORS**: Configured for specific origins
- **Helmet**: Security headers protection
- **SQL Injection Prevention**: MongoDB with parameterized queries

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
# Build client
cd client && npm run build && cd ..

# Start server
NODE_ENV=production npm start
```

### Docker (Optional)
```bash
# Build and run with Docker Compose
docker-compose up --build
```

## 🧪 Testing

### Validate Setup
```bash
npm run validate
```

### Run Tests
```bash
# Server tests
npm run test:server

# Client tests
cd client && npm test
```

## 📱 Usage

1. **Registration**: Create account with role selection
2. **Login**: Authenticate with email/password
3. **Dashboard**: View conversations and online users
4. **Messaging**: Send/receive real-time messages
5. **Groups**: Create and manage group conversations
6. **Profile**: Update personal information and preferences

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MongoDB is running
   - Verify MONGO_URI in .env file
   - Check network connectivity

2. **Authentication Errors**
   - Verify JWT secrets are set
   - Check token expiration settings
   - Clear browser localStorage

3. **Socket Connection Issues**
   - Check server is running on correct port
   - Verify REACT_APP_SOCKET_URL
   - Check firewall settings

4. **Message Encryption Errors**
   - Ensure ENCRYPTION_KEY is set
   - Verify key is 64 hex characters
   - Check crypto module is available

### Debug Mode
```bash
DEBUG=* npm run server
```

## 🔄 All Bugs Fixed

✅ **Authentication Issues**: Double password hashing, login validation
✅ **Database Connection**: MongoDB connection validation and error handling
✅ **Socket Authentication**: Token validation and error handling
✅ **Message Encryption**: Error handling for decryption failures
✅ **Input Validation**: Comprehensive validation for all endpoints
✅ **API Endpoints**: Fixed route handlers and controller functions
✅ **Client Integration**: Fixed API URLs and socket connections
✅ **Security Headers**: Enhanced CORS and Helmet configuration
✅ **Environment Config**: Proper environment variable handling
✅ **Error Handling**: Standardized error responses across the app

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support, email support@healthcare-messaging.com or create an issue in the repository.

## 🙏 Acknowledgments

- Material-UI for the beautiful React components
- Socket.io for real-time communication
- MongoDB for the robust database
- Express.js for the web framework
- All contributors and healthcare professionals who inspired this project

---

**Note**: This application is designed for educational and development purposes. For production use in healthcare environments, ensure compliance with relevant regulations like HIPAA, GDPR, etc.# RealtimeMessage
