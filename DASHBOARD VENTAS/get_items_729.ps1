$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$inv = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -eq '729' }
$inv.items | Select-Object SUBTOTAL
