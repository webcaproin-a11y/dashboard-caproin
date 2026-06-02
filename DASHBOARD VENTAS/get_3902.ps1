$json = Get-Content 'temp_invoices.json' | ConvertFrom-Json
$inv = $json.invoices | ForEach-Object { $_.factura } | Where-Object { $_.NUMERO -eq '3902' }
$total = 0
foreach ($it in $inv.items) { $total += [double]$it.SUBTOTAL }
Write-Host "Inv 3902 Subtotal: $total"
