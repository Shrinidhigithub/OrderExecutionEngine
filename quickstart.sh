#!/bin/bash
# Quick start script for Order Execution Engine

set -e  # Exit on error

echo "Order Execution Engine - Quick Start"
echo "========================================"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Docker Compose not found. Attempting to use 'docker compose'..."
fi

echo ""
echo "Starting services with Docker Compose..."
docker compose up -d

echo "Waiting for services to be healthy..."
sleep 5

# Check service health
echo "Services started:"
docker compose ps

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Building TypeScript..."
npm run build

echo ""
echo "Setup complete!"
echo ""
echo "Usage:"
echo "  Development:  npm run dev"
echo "  Tests:        npm run test"
echo "  Build:        npm run build"
echo "  Production:   npm start"
echo ""
echo "API Endpoint: http://localhost:3000"
echo "Documentation: See SETUP_AND_TEST_GUIDE.md"
echo ""
echo "Next steps:"
echo "  1. Run: npm run dev"
echo "  2. Open another terminal"
echo "  3. Submit an order: curl -X POST http://localhost:3000/api/orders/execute -H 'Content-Type: application/json' -d '{\"tokenIn\":\"SOL\",\"tokenOut\":\"USDC\",\"amount\":10}'"
echo "  4. Connect WebSocket: node ws-client.js <orderId>"
echo ""
