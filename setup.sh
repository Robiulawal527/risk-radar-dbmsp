#!/bin/bash

# Risk Radar - Quick Start Script
# This script sets up the development environment

echo "🚀 Risk Radar - Development Setup"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "📦 Installing dependencies..."

# Check if pnpm is available
if command -v pnpm &> /dev/null; then
    echo "Using pnpm..."
    pnpm install
elif command -v npm &> /dev/null; then
    echo "Using npm..."
    npm install
else
    echo "❌ Error: Neither pnpm nor npm found. Please install Node.js."
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Available commands:"
echo "  • npm run dev      - Start development server"
echo "  • npm run build    - Build for production"
echo "  • npm run preview  - Preview production build"
echo ""
echo "📚 Documentation:"
echo "  • README.md                  - Main documentation"
echo "  • QUICK_START_GUIDE.md       - Quick start guide"
echo "  • PRODUCTION_READY.md        - Production deployment"
echo ""
echo "🔐 Demo Credentials:"
echo "  Admin:  admin@riskradar.bd  / admin123"
echo "  Police: police@riskradar.bd / police123"
echo "  User:   user@riskradar.bd   / user123"
echo ""
echo "To start the development server, run:"
echo "  npm run dev"
echo ""
