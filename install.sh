#!/bin/bash

# Risk Radar - Automated Installation Script
# This script automates the setup process for Risk Radar application

set -e

echo "🚨 Risk Radar - Automated Installation"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run this script as root${NC}"
   exit 1
fi

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version must be 18 or higher"
        exit 1
    fi
    print_success "Node.js $(node -v) found"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
else
    print_success "npm $(npm -v) found"
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL not found in PATH"
    echo "Make sure PostgreSQL 14+ with PostGIS is installed"
else
    print_success "PostgreSQL found"
fi

echo ""
echo "Choose installation method:"
echo "1) Docker (Recommended - includes database)"
echo "2) Manual (Requires PostgreSQL to be set up)"
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        echo ""
        echo "🐳 Docker Installation"
        echo "====================="
        
        # Check Docker
        if ! command -v docker &> /dev/null; then
            print_error "Docker is not installed"
            echo "Please install Docker from https://docs.docker.com/get-docker/"
            exit 1
        fi
        
        # Check Docker Compose
        if ! command -v docker-compose &> /dev/null; then
            print_error "Docker Compose is not installed"
            exit 1
        fi
        
        print_success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') found"
        print_success "Docker Compose $(docker-compose --version | cut -d' ' -f4 | tr -d ',') found"
        
        # Copy environment file
        if [ ! -f server/.env ]; then
            echo ""
            echo "Setting up environment variables..."
            cp server/.env.example server/.env
            
            # Generate random JWT secret
            JWT_SECRET=$(openssl rand -base64 32)
            DB_PASSWORD=$(openssl rand -base64 16)
            
            # Update .env file
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" server/.env
                sed -i '' "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" server/.env
            else
                # Linux
                sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" server/.env
                sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" server/.env
            fi
            
            print_success "Environment file created with random secrets"
        else
            print_warning "server/.env already exists, skipping"
        fi
        
        # Copy frontend environment
        if [ ! -f .env ]; then
            cp .env.example .env
            print_success "Frontend environment file created"
        fi
        
        # Start Docker containers
        echo ""
        echo "Starting Docker containers..."
        docker-compose up -d
        
        # Wait for database to be ready
        echo "Waiting for database to be ready..."
        sleep 10
        
        # Check if containers are running
        if docker-compose ps | grep -q "Up"; then
            print_success "All containers are running!"
            echo ""
            echo "🎉 Installation Complete!"
            echo ""
            echo "Access your application:"
            echo "  Frontend:  http://localhost:3000"
            echo "  Backend:   http://localhost:5000"
            echo "  Database:  localhost:5432"
            echo ""
            echo "Default credentials:"
            echo "  Email:     admin@riskradar.bd"
            echo "  Password:  admin123"
            echo ""
            print_warning "IMPORTANT: Change the default password after first login!"
            echo ""
            echo "View logs with: docker-compose logs -f"
            echo "Stop with: docker-compose down"
        else
            print_error "Failed to start containers"
            echo "Check logs with: docker-compose logs"
            exit 1
        fi
        ;;
        
    2)
        echo ""
        echo "🔧 Manual Installation"
        echo "====================="
        
        # Database setup
        echo ""
        read -p "Have you set up PostgreSQL with PostGIS? (y/n): " db_setup
        if [ "$db_setup" != "y" ]; then
            echo ""
            echo "Please set up PostgreSQL first:"
            echo "1. Install PostgreSQL 14+ with PostGIS extension"
            echo "2. Create database and user"
            echo "3. Load schema from database/schema.sql"
            echo ""
            echo "See database/README.md for detailed instructions"
            exit 0
        fi
        
        # Environment setup
        echo ""
        echo "Setting up environment..."
        
        if [ ! -f server/.env ]; then
            cp server/.env.example server/.env
            
            # Prompt for database credentials
            read -p "Database host [localhost]: " db_host
            db_host=${db_host:-localhost}
            
            read -p "Database name [riskradar_db]: " db_name
            db_name=${db_name:-riskradar_db}
            
            read -p "Database user [riskradar_user]: " db_user
            db_user=${db_user:-riskradar_user}
            
            read -sp "Database password: " db_password
            echo ""
            
            # Generate JWT secret
            JWT_SECRET=$(openssl rand -base64 32)
            
            # Update .env
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|DB_HOST=.*|DB_HOST=${db_host}|" server/.env
                sed -i '' "s|DB_NAME=.*|DB_NAME=${db_name}|" server/.env
                sed -i '' "s|DB_USER=.*|DB_USER=${db_user}|" server/.env
                sed -i '' "s|DB_PASSWORD=.*|DB_PASSWORD=${db_password}|" server/.env
                sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" server/.env
            else
                sed -i "s|DB_HOST=.*|DB_HOST=${db_host}|" server/.env
                sed -i "s|DB_NAME=.*|DB_NAME=${db_name}|" server/.env
                sed -i "s|DB_USER=.*|DB_USER=${db_user}|" server/.env
                sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${db_password}|" server/.env
                sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" server/.env
            fi
            
            print_success "Backend environment configured"
        fi
        
        if [ ! -f .env ]; then
            cp .env.example .env
            print_success "Frontend environment configured"
        fi
        
        # Install backend dependencies
        echo ""
        echo "Installing backend dependencies..."
        cd server
        npm install
        cd ..
        print_success "Backend dependencies installed"
        
        # Install frontend dependencies
        echo ""
        echo "Installing frontend dependencies..."
        npm install
        print_success "Frontend dependencies installed"
        
        # Install PM2
        echo ""
        read -p "Install PM2 for production? (y/n): " install_pm2
        if [ "$install_pm2" = "y" ]; then
            sudo npm install -g pm2
            print_success "PM2 installed"
        fi
        
        # Test database connection
        echo ""
        echo "Testing database connection..."
        cd server
        node -e "const {pool} = require('./src/config/database'); pool.query('SELECT 1').then(() => {console.log('✓ Database connected'); process.exit(0);}).catch((e) => {console.error('✗ Database connection failed:', e.message); process.exit(1);});"
        
        if [ $? -eq 0 ]; then
            print_success "Database connection successful"
        else
            print_error "Database connection failed"
            echo "Please check your database credentials in server/.env"
            exit 1
        fi
        cd ..
        
        echo ""
        echo "🎉 Installation Complete!"
        echo ""
        echo "To start the application:"
        echo ""
        echo "Terminal 1 - Backend:"
        echo "  cd server"
        echo "  npm run dev"
        echo ""
        echo "Terminal 2 - Frontend:"
        echo "  npm run dev"
        echo ""
        echo "Or use PM2 for production:"
        echo "  cd server && pm2 start src/server.js --name riskradar-api"
        echo "  npm run build && serve -s dist -l 3000"
        echo ""
        echo "Default credentials:"
        echo "  Email:     admin@riskradar.bd"
        echo "  Password:  admin123"
        echo ""
        print_warning "IMPORTANT: Change the default password after first login!"
        ;;
        
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "📚 Documentation:"
echo "  - README.md - Project overview"
echo "  - PRODUCTION_DEPLOYMENT.md - Deployment guide"
echo "  - API_TESTING_GUIDE.md - API reference"
echo "  - database/README.md - Database setup"
echo ""
echo "Need help? Check the documentation or visit GitHub"
echo ""
