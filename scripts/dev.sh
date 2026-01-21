#!/bin/bash

# Ludo Development Startup Script
# Usage: ./scripts/dev.sh [command]
# Commands: start, stop, restart, logs, status

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# PID file locations
PID_DIR="$PROJECT_ROOT/.pids"
AUTH_PID="$PID_DIR/auth-service.pid"
GAME_PID="$PID_DIR/game-service.pid"
WEB_PID="$PID_DIR/web.pid"

# Ensure PID directory exists
mkdir -p "$PID_DIR"

# Check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is required but not installed."
        exit 1
    fi
}

# Wait for a port to be available
wait_for_port() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=0
    
    while ! nc -z localhost "$port" 2>/dev/null; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            log_error "$name on port $port failed to start"
            return 1
        fi
        sleep 1
    done
    log_success "$name is ready on port $port"
}

# Ensure Docker is running
ensure_docker() {
    if ! docker info &>/dev/null; then
        log_warn "Docker is not running. Attempting to start..."
        
        # Try Colima first (macOS)
        if command -v colima &>/dev/null; then
            log_info "Starting Colima..."
            colima start 2>/dev/null || true
            sleep 3
        # Try Docker Desktop
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            open -a Docker 2>/dev/null || true
            sleep 5
        fi
        
        # Wait for Docker to be ready
        local attempts=0
        while ! docker info &>/dev/null; do
            attempts=$((attempts + 1))
            if [ $attempts -ge 30 ]; then
                log_error "Docker failed to start. Please start Docker manually and try again."
                exit 1
            fi
            sleep 2
        done
        log_success "Docker is running"
    fi
}

# Start Docker containers
start_docker() {
    ensure_docker
    log_info "Starting Docker containers..."
    
    cd "$PROJECT_ROOT/docker"
    docker-compose -f docker-compose.dev.yml up -d postgres redis 2>&1 | grep -v "obsolete" || true
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    local max_attempts=30
    local attempt=0
    while ! docker exec ludo-postgres pg_isready -U ludo -d ludo_db &>/dev/null; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            log_error "PostgreSQL failed to start"
            exit 1
        fi
        sleep 1
    done
    log_success "PostgreSQL is ready on port 5433"
    
    # Wait for Redis
    wait_for_port 6379 "Redis"
    
    cd "$PROJECT_ROOT"
}

# Push database schema
push_database() {
    log_info "Pushing database schema..."
    cd "$PROJECT_ROOT/packages/database"
    DATABASE_URL="postgresql://ludo:ludo_password@localhost:5433/ludo_db?schema=public" \
        npx prisma db push --accept-data-loss --skip-generate
    log_success "Database schema pushed"
    cd "$PROJECT_ROOT"
}

# Start auth service
start_auth_service() {
    log_info "Starting auth service..."
    
    # Kill existing process if any
    if [ -f "$AUTH_PID" ]; then
        kill "$(cat "$AUTH_PID")" 2>/dev/null || true
        rm "$AUTH_PID"
    fi
    
    cd "$PROJECT_ROOT/services/auth-service"
    nohup pnpm dev > "$PROJECT_ROOT/logs/auth-service.log" 2>&1 &
    echo $! > "$AUTH_PID"
    
    wait_for_port 3002 "Auth service"
    cd "$PROJECT_ROOT"
}

# Start game service
start_game_service() {
    log_info "Starting game service..."
    
    # Kill existing process if any
    if [ -f "$GAME_PID" ]; then
        kill "$(cat "$GAME_PID")" 2>/dev/null || true
        rm "$GAME_PID"
    fi
    
    cd "$PROJECT_ROOT/services/game-service"
    nohup pnpm dev > "$PROJECT_ROOT/logs/game-service.log" 2>&1 &
    echo $! > "$GAME_PID"
    
    wait_for_port 3001 "Game service"
    cd "$PROJECT_ROOT"
}

# Start web frontend
start_web() {
    log_info "Starting web frontend..."
    
    # Kill existing process if any
    if [ -f "$WEB_PID" ]; then
        kill "$(cat "$WEB_PID")" 2>/dev/null || true
        rm "$WEB_PID"
    fi
    
    # Kill any process on port 5173
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    
    cd "$PROJECT_ROOT/apps/web"
    nohup pnpm dev > "$PROJECT_ROOT/logs/web.log" 2>&1 &
    echo $! > "$WEB_PID"
    
    wait_for_port 5173 "Web frontend"
    cd "$PROJECT_ROOT"
}

# Stop all services
stop_services() {
    log_info "Stopping services..."
    
    # Stop Node processes
    for pid_file in "$AUTH_PID" "$GAME_PID" "$WEB_PID"; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
                log_info "Stopped process $pid"
            fi
            rm "$pid_file"
        fi
    done
    
    # Kill any remaining processes on our ports
    for port in 3001 3002 5173; do
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    done
    
    log_success "Services stopped"
}

# Stop Docker containers
stop_docker() {
    log_info "Stopping Docker containers..."
    cd "$PROJECT_ROOT/docker"
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || log_warn "Docker not running or already stopped"
    cd "$PROJECT_ROOT"
    log_success "Docker containers stopped"
}

# Show status
show_status() {
    echo ""
    echo "=== Ludo Development Status ==="
    echo ""
    
    # Docker status
    echo "Docker Containers:"
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "ludo-" 2>/dev/null; then
        :
    else
        echo "  No containers running"
    fi
    echo ""
    
    # Services status
    echo "Services:"
    for port in 3001 3002 5173; do
        if nc -z localhost $port 2>/dev/null; then
            case $port in
                3001) echo -e "  Game Service:  ${GREEN}Running${NC} on port $port" ;;
                3002) echo -e "  Auth Service:  ${GREEN}Running${NC} on port $port" ;;
                5173) echo -e "  Web Frontend:  ${GREEN}Running${NC} on port $port" ;;
            esac
        else
            case $port in
                3001) echo -e "  Game Service:  ${RED}Stopped${NC}" ;;
                3002) echo -e "  Auth Service:  ${RED}Stopped${NC}" ;;
                5173) echo -e "  Web Frontend:  ${RED}Stopped${NC}" ;;
            esac
        fi
    done
    echo ""
}

# Show logs
show_logs() {
    local service=$1
    case $service in
        auth)
            tail -f "$PROJECT_ROOT/logs/auth-service.log"
            ;;
        game)
            tail -f "$PROJECT_ROOT/logs/game-service.log"
            ;;
        web)
            tail -f "$PROJECT_ROOT/logs/web.log"
            ;;
        *)
            tail -f "$PROJECT_ROOT/logs/"*.log
            ;;
    esac
}

# Main start function
start() {
    echo ""
    echo "=========================================="
    echo "   🎲 Ludo Development Environment 🎲"
    echo "=========================================="
    echo ""
    
    # Check prerequisites
    check_command docker
    check_command node
    check_command pnpm
    
    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Start everything
    start_docker
    push_database
    start_auth_service
    start_game_service
    start_web
    
    echo ""
    echo "=========================================="
    echo -e "   ${GREEN}All services started successfully!${NC}"
    echo "=========================================="
    echo ""
    echo "  🌐 Frontend:     http://localhost:5173"
    echo "  🎮 Game API:     http://localhost:3001"
    echo "  🔐 Auth API:     http://localhost:3002"
    echo "  🗄️  PostgreSQL:   localhost:5433"
    echo "  📦 Redis:        localhost:6379"
    echo ""
    echo "  📋 View logs:    ./scripts/dev.sh logs"
    echo "  🛑 Stop:         ./scripts/dev.sh stop"
    echo "  📊 Status:       ./scripts/dev.sh status"
    echo ""
}

# Parse command
case "${1:-start}" in
    start)
        start
        ;;
    stop)
        stop_services
        ;;
    stop-all)
        stop_services
        stop_docker
        ;;
    restart)
        stop_services
        stop_docker
        sleep 2
        start
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$2"
        ;;
    docker)
        start_docker
        ;;
    services)
        ensure_docker
        # Make sure containers are running
        cd "$PROJECT_ROOT/docker"
        docker-compose -f docker-compose.dev.yml up -d postgres redis 2>&1 | grep -v "obsolete" || true
        cd "$PROJECT_ROOT"
        sleep 3
        start_auth_service
        start_game_service
        start_web
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [service]}"
        echo ""
        echo "Commands:"
        echo "  start     - Start all services (default)"
        echo "  stop      - Stop all services and containers"
        echo "  restart   - Restart everything"
        echo "  status    - Show status of all services"
        echo "  logs      - Tail all logs (or specify: auth, game, web)"
        echo "  docker    - Start only Docker containers"
        echo "  services  - Start only Node services (assumes Docker is running)"
        exit 1
        ;;
esac
