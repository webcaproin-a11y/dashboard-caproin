
if (Test-Path "temp_invoices.json") {
    $f = Get-Item "temp_invoices.json"
    Write-Host "File exists, size: $($f.Length)"
} else {
    Write-Host "File NOT found"
    exit
}

$raw = Get-Content "temp_invoices.json" -Raw
Write-Host "Raw content length: $($raw.Length)"

try {
    $json = $raw | ConvertFrom-Json
    Write-Host "JSON parsed successfully"
    Write-Host "Invoices count: $($json.invoices.Count)"
} catch {
    Write-Host "JSON parse FAILED: $_"
}
