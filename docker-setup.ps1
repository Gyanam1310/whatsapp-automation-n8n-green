# Gaurakshan Docker Quick Start Script (Windows)
# Run this in PowerShell: .\docker-setup.ps1

# Color functions
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red }

Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Gaurakshan WhatsApp Automation - Docker Quick Start (Windows)" -ForegroundColor Cyan
Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Success "Docker is installed"
} catch {
    Write-Error "Docker is not installed"
    Write-Host "Please install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
}

# Check if Docker Compose is installed
try {
    docker compose version | Out-Null
    Write-Success "Docker Compose is installed"
} catch {
    Write-Error "Docker Compose is not installed"
    Write-Host "Please update Docker Desktop"
    exit 1
}

Write-Host ""

# Check if backend/.env exists
if (Test-Path "backend/.env") {
    Write-Success "backend/.env exists"
} else {
    Write-Warning "backend/.env not found"
    Write-Host "Creating from .env.docker template..."
    Copy-Item ".env.docker" "backend/.env"
    Write-Success "Created backend/.env"
    Write-Host ""
    Write-Host "Please edit backend/.env with your credentials:"
    Write-Host "  notepad backend\.env"
    Write-Host ""
    Read-Host "Press Enter to continue..."
}

# Check if service-account.json exists
if (Test-Path "backend/service-account.json") {
    Write-Success "backend/service-account.json exists"
} else {
    Write-Warning "backend/service-account.json not found"
    Write-Host "You'll need to download this from Google Cloud Console"
    Write-Host "See .env.docker for instructions"
    Write-Host ""
    Read-Host "Press Enter to continue..."
}

Write-Host ""
Write-Host "Starting Docker containers..."
Write-Host ""

# Start containers
docker compose up -d

# Wait for services
Write-Host ""
Write-Host "Waiting for services to start (30-60 seconds)..."
Start-Sleep -Seconds 10

# Show status
Write-Host ""
Write-Host "Container Status:"
docker compose ps

# Show URLs
Write-Host ""
Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Success "Docker stack is running!"
Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Access the application at:"
Write-Host ""
Write-Host "  Frontend:       http://localhost:3000" -ForegroundColor Green
Write-Host "  Backend API:    http://localhost:5000" -ForegroundColor Green
Write-Host "  Backend Health: http://localhost:5000/health" -ForegroundColor Green
Write-Host "  n8n Workflows:  http://localhost:5678" -ForegroundColor Green
Write-Host ""

Write-Host "Useful commands:"
Write-Host ""
Write-Host "  View logs:"
Write-Host "    docker compose logs -f"
Write-Host "    docker compose logs -f backend"
Write-Host ""
Write-Host "  Access container:"
Write-Host "    docker compose exec backend sh"
Write-Host ""
Write-Host "  Stop all services:"
Write-Host "    docker compose down"
Write-Host ""
Write-Host "  Restart a service:"
Write-Host "    docker compose restart backend"
Write-Host ""

Write-Host "Checking service health..."
Write-Host ""

# Frontend health
try {
    Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing | Out-Null
    Write-Success "Frontend is healthy"
} catch {
    Write-Warning "Frontend may not be ready yet"
}

# Backend health
try {
    Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing | Out-Null
    Write-Success "Backend is healthy"
} catch {
    Write-Warning "Backend may not be ready yet"
}

# n8n health
try {
    Invoke-WebRequest -Uri "http://localhost:5678/healthz" -UseBasicParsing | Out-Null
    Write-Success "n8n is healthy"
} catch {
    Write-Warning "n8n may not be ready yet"
}

Write-Host ""
Write-Host "For detailed documentation, see: DOCKER_SETUP.md"
Write-Host ""
