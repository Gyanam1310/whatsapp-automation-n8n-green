#!/bin/bash
# Gaurakshan Docker Quick Start Script
# This script helps you set up and run the Docker environment

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Gaurakshan WhatsApp Automation - Docker Quick Start"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Check if backend/.env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠ backend/.env not found${NC}"
    echo "Creating from .env.docker template..."
    cp .env.docker backend/.env
    echo -e "${GREEN}✓ Created backend/.env${NC}"
    echo ""
    echo "Please edit backend/.env with your credentials:"
    echo "  nano backend/.env"
    echo ""
    read -p "Press Enter to continue, or Ctrl+C to edit first..."
else
    echo -e "${GREEN}✓ backend/.env exists${NC}"
fi

# Check if service-account.json exists
if [ ! -f "backend/service-account.json" ]; then
    echo -e "${YELLOW}⚠ backend/service-account.json not found${NC}"
    echo "You'll need to download this from Google Cloud Console"
    echo "See .env.docker for instructions"
    echo ""
    read -p "Press Enter to continue without it (workflows won't work), or Ctrl+C to add it..."
else
    echo -e "${GREEN}✓ backend/service-account.json exists${NC}"
fi

echo ""
echo "Starting Docker containers..."
echo ""

# Start containers
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "Waiting for services to start (this may take 30-60 seconds)..."
sleep 10

# Check if all containers are running
echo ""
echo "Container Status:"
docker-compose ps

# Show access URLs
echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ Docker stack is running!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Access the application at:"
echo ""
echo -e "  ${GREEN}Frontend:${NC}       http://localhost:3000"
echo -e "  ${GREEN}Backend API:${NC}    http://localhost:5000"
echo -e "  ${GREEN}Backend Health:${NC} http://localhost:5000/health"
echo -e "  ${GREEN}n8n Workflows:${NC}  http://localhost:5678"
echo ""

# Show useful commands
echo "Useful commands:"
echo ""
echo "  View logs:"
echo "    docker compose logs -f"
echo "    docker compose logs -f backend"
echo ""
echo "  SSH into container:"
echo "    docker compose exec backend sh"
echo ""
echo "  Stop all services:"
echo "    docker compose down"
echo ""
echo "  Restart a service:"
echo "    docker compose restart backend"
echo ""

# Check if services are healthy
echo "Checking service health..."
echo ""

# Frontend health check
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is healthy${NC}"
else
    echo -e "${YELLOW}⚠ Frontend may not be ready yet${NC}"
fi

# Backend health check
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${YELLOW}⚠ Backend may not be ready yet${NC}"
fi

# n8n health check
if curl -s http://localhost:5678/healthz > /dev/null 2>&1; then
    echo -e "${GREEN}✓ n8n is healthy${NC}"
else
    echo -e "${YELLOW}⚠ n8n may not be ready yet${NC}"
fi

echo ""
echo "For detailed documentation, see: DOCKER_SETUP.md"
echo ""
