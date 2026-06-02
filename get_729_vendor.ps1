$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$inv = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -eq '729' }
Write-Host "Vendor: $($inv.NOMBRE_VENDEDOR)"
Write-Host "Client: $($inv.NOMBRE_TERCERO)"
