$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$inv = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -eq '3899' }
$inv.items | Select-Object SUBTOTAL
