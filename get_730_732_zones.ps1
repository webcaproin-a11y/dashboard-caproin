$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$invs = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -match "730|731|732" }
$invs | Select-Object NUMERO, ID_ZONA, NOMBRE_VENDEDOR
