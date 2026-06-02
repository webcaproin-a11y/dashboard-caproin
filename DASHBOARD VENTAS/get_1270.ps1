$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$inv = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -eq '1270' }
$inv | Select-Object NUMERO, NOMBRE_VENDEDOR, SUBTOTAL
