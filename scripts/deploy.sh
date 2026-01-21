#!/bin/bash

# ===========================================
# Ludo Multiplayer - Deployment Script
# ===========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${GREEN}==>${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

print_error() {
    echo -e "${RED}Error:${NC} $1"
}

# Check if .env exists
check_env() {
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        echo ""
        echo "Create a .env file with these required variables:"
        echo "  DB_USER=ludo"
        echo "  DB_PASSWORD=your_secure_password"
        echo "  DB_NAME=ludo_db"
        echo "  DATABASE_URL=postgresql://\${DB_USER}:\${DB_PASSWORD}@postgres:5432/\${DB_NAME}"
        echo "  JWT_SECRET=\$(openssl rand -hex 32)"
        echo "  API_URL=https://api.yourdomain.com"
        echo "  WS_URL=wss://api.yourdomain.com"
        exit 1
    fi
}

# Run tests before deploying
run_tests() {
    print_step "Running tests..."
    pnpm test
    if [ $? -ne 0 ]; then
        print_error "Tests failed! Fix them before deploying."
        exit 1
    fi
    echo -e "${GREEN}✓ All tests passed${NC}"
}

# Build and deploy with Docker Compose
deploy_docker() {
    print_step "Building Docker images..."
    docker-compose -f docker/docker-compose.prod.yml build

    print_step "Starting services..."
    docker-compose -f docker/docker-compose.prod.yml up -d

    print_step "Running database migrations..."
    sleep 5  # Wait for postgres to be ready
    docker-compose -f docker/docker-compose.prod.yml exec game-service \
        npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma

    print_step "Deployment complete!"
    echo ""
    echo "Services running:"
    docker-compose -f docker/docker-compose.prod.yml ps
}

# Deploy to Kubernetes
deploy_k8s() {
    print_step "Deploying to Kubernetes..."
    
    # Apply in order
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/secrets.yaml
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/redis.yaml
    kubectl apply -f k8s/game-service.yaml
    kubectl apply -f k8s/web.yaml
    kubectl apply -f k8s/ingress.yaml

    print_step "Waiting for pods to be ready..."
    kubectl -n ludo wait --for=condition=ready pod -l app=game-service --timeout=120s
    kubectl -n ludo wait --for=condition=ready pod -l app=web --timeout=120s

    print_step "Deployment complete!"
    kubectl -n ludo get pods
}

# Show usage
usage() {
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  docker    Deploy using Docker Compose (for VPS)"
    echo "  k8s       Deploy to Kubernetes cluster"
    echo "  test      Run tests only"
    echo "  build     Build all packages"
    echo "  stop      Stop Docker Compose services"
    echo "  logs      Show Docker Compose logs"
    echo ""
}

# Main
case "$1" in
    docker)
        check_env
        run_tests
        deploy_docker
        ;;
    k8s)
        check_env
        run_tests
        deploy_k8s
        ;;
    test)
        run_tests
        ;;
    build)
        print_step "Building all packages..."
        pnpm build
        ;;
    stop)
        print_step "Stopping services..."
        docker-compose -f docker/docker-compose.prod.yml down
        ;;
    logs)
        docker-compose -f docker/docker-compose.prod.yml logs -f
        ;;
    *)
        usage
        exit 1
        ;;
esac
