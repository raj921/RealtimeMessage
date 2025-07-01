#!/bin/bash

# Real-Time Messaging Application Startup Script
echo "🚀 Starting Healthcare Messaging Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file. Please configure your environment variables before running the application."
    echo "📝 Edit the .env file with your MongoDB URI, JWT secrets, and other configurations."
    exit 1
fi

# Install server dependencies
echo "📦 Installing server dependencies..."
npm install

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client && npm install && cd ..

# Check if MongoDB is running (optional check)
echo "🔍 Checking MongoDB connection..."
if ! nc -z localhost 27017 2>/dev/null; then
    echo "⚠️  MongoDB doesn't appear to be running on localhost:27017"
    echo "   Please make sure MongoDB is installed and running, or update MONGO_URI in .env"
fi

echo "✅ Dependencies installed successfully!"
echo ""
echo "🎯 Available commands:"
echo "   npm run dev     - Start both server and client in development mode"
echo "   npm run server  - Start only the server"
echo "   npm run client  - Start only the client"
echo "   npm start       - Start the server in production mode"
echo ""
echo "🔧 Before starting:"
echo "   1. Configure your .env file with proper values"
echo "   2. Make sure MongoDB is running"
echo "   3. Update client/.env with your API URL if needed"
echo ""
echo "🚀 Run 'npm run dev' to start the application!"