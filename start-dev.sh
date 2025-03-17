#!/bin/bash

# Start development environment for Notion clone

# Functions
start_backend() {
  echo "🚀 Starting PHP backend server..."
  cd backend || exit
  php -S localhost:8000 -t public &
  BACKEND_PID=$!
  echo "✅ Backend server started on http://localhost:8000"

  echo "🔌 Starting WebSocket server..."
  php bin/websocket-server.php &
  WEBSOCKET_PID=$!
  echo "✅ WebSocket server started on ws://localhost:8080"

  cd ..
}

start_frontend() {
  echo "🚀 Starting React frontend server..."
  cd frontend || exit
  npm run dev &
  FRONTEND_PID=$!
  echo "✅ Frontend server started on http://localhost:3000"
  cd ..
}

cleanup() {
  echo "🛑 Stopping all servers..."
  kill $BACKEND_PID $WEBSOCKET_PID $FRONTEND_PID 2>/dev/null
  exit 0
}

# Set up trap to catch Ctrl+C
trap cleanup INT TERM

# Check dependencies
echo "🔍 Checking dependencies..."

if ! command -v php &> /dev/null; then
    echo "❌ PHP is not installed. Please install PHP 8.0 or higher."
    exit 1
fi

if ! command -v composer &> /dev/null; then
    echo "❌ Composer is not installed. Please install Composer."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm."
    exit 1
fi

# Check if .env files exist, if not, create from examples
if [ ! -f "./backend/.env" ]; then
    echo "⚠️ Backend .env file not found. Creating from example..."
    cp "./backend/.env.example" "./backend/.env"
    echo "✅ Created backend .env file. You might want to update it with your settings."
fi

if [ ! -f "./frontend/.env" ]; then
    echo "⚠️ Frontend .env file not found. Creating from example..."
    cp "./frontend/.env.example" "./frontend/.env"
    echo "✅ Created frontend .env file."
fi

# Install dependencies if needed
echo "📦 Checking backend dependencies..."
if [ ! -d "./backend/vendor" ]; then
    echo "Installing backend dependencies..."
    cd backend && composer install && cd ..
fi

echo "📦 Checking frontend dependencies..."
if [ ! -d "./frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Start servers
start_backend
start_frontend

echo ""
echo "📝 Development servers are running:"
echo "- Backend: http://localhost:8000"
echo "- WebSocket: ws://localhost:8080"
echo "- Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers."

# Keep script running
wait
