#!/bin/bash

echo ""
echo "Starting Gaurakshan WhatsApp Automation..."
echo ""

docker compose up -d

echo ""
echo "========================================"
echo "  All containers started!"
echo "========================================"
echo ""
echo "  Open in browser:"
echo ""
echo "  Frontend    ->  http://localhost"
echo "  Backend     ->  http://localhost:5000/health"
echo "  n8n         ->  http://localhost:5678"
echo "  n8n (nginx) ->  http://localhost/n8n/"
echo ""
echo "========================================"
echo ""

docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
