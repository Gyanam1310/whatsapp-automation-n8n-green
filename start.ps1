Write-Host ""
Write-Host "Starting Gaurakshan WhatsApp Automation..." -ForegroundColor Cyan
Write-Host ""

docker compose up -d

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All containers started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Open in browser:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Frontend   ->  http://localhost" -ForegroundColor White
Write-Host "  Backend    ->  http://localhost:5000/health" -ForegroundColor White
Write-Host "  n8n        ->  http://localhost:5678" -ForegroundColor White
Write-Host "  n8n (nginx)->  http://localhost/n8n/" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

docker compose ps --format "table {{.Name}}`t{{.Status}}`t{{.Ports}}"

Write-Host ""
