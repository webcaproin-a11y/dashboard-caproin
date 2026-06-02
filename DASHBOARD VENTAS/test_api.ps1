
try {
    $response = Invoke-RestMethod -Uri "https://ponypro.ibla.co:31406/all/invoice" -Method Post -ContentType "application/json" -Headers @{ "token" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2OTEzNWEwNmQzYTFkOGE2MTBkNTU5NGEiLCJpYXQiOjE3ODAzMjA4MDIsImV4cCI6MTc4MTYxNjgwMn0.yo7Kbt97Qkp-IVKFaf4UhVjflg_SRZwph3-d1ymHJJs" } -Body '{"fechainicial":"2026-04-01","fechafinal":"2026-04-30"}'
    Write-Host "API Status: OK, Fetched $($response.invoices.count) invoices."
} catch {
    Write-Host "API Error: $_"
}
